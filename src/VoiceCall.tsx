import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// One fixed offerer (archivist), one answerer, full ICE gathering before send.
// No trickle-candidate queue, renegotiation glare, recordings or transcription.
async function description(pc: RTCPeerConnection) {
  if (pc.iceGatheringState !== "complete") await new Promise<void>((resolve, reject) => {
    const finish = () => { clearTimeout(timer); pc.removeEventListener("icegatheringstatechange", check); pc.removeEventListener("connectionstatechange", check); };
    const check = () => {
      if (pc.connectionState === "closed") { finish(); reject(new Error("Call closed")); }
      else if (pc.iceGatheringState === "complete") { finish(); resolve(); }
    };
    const timer = setTimeout(() => { finish(); reject(new Error("Network discovery timed out")); }, 12_000);
    pc.addEventListener("icegatheringstatechange", check);
    pc.addEventListener("connectionstatechange", check);
    check();
  });
  if (!pc.localDescription?.sdp) throw new Error("Missing audio description");
  return pc.localDescription.sdp;
}

function useSpeaking(stream: MediaStream | null, enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!stream || !enabled) { setSpeaking(false); return; }
    let audio: AudioContext | undefined;
    try {
      audio = new AudioContext();
      const source = audio.createMediaStreamSource(stream), analyser = audio.createAnalyser(), silent = audio.createGain();
      analyser.fftSize = 512; silent.gain.value = 0;
      source.connect(analyser); analyser.connect(silent); silent.connect(audio.destination);
      void audio.resume().catch(() => {});
      const samples = new Uint8Array(analyser.fftSize);
      const timer = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
        setSpeaking(rms > .025);
      }, 250);
      return () => { clearInterval(timer); source.disconnect(); void audio?.close(); };
    } catch { void audio?.close(); }
  }, [stream, enabled]);
  return speaking && enabled;
}

export function VoiceCall({ roomId, connected }: { roomId: Id<"rooms">; connected: boolean }) {
  const data = useQuery(api.voice.get, { roomId });
  const getConfig = useAction(api.voice.connectionConfig);
  const [network, setNetwork] = useState<{ relay: boolean; iceServers: RTCIceServer[] } | null>(null);
  const join = useMutation(api.voice.join), leave = useMutation(api.voice.leave);
  const heartbeat = useMutation(api.voice.heartbeat), send = useMutation(api.voice.describe);
  const [clientId, setClientId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false), [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Voice is off"), [error, setError] = useState("");
  const [playBlocked, setPlayBlocked] = useState(false);
  const audio = useRef<HTMLAudioElement>(null), pc = useRef<RTCPeerConnection | null>(null);
  const live = useRef<{ id: string; stream: MediaStream } | null>(null);
  const operation = useRef(0), starting = useRef(false), mutedRef = useRef(false);
  const ownSpeaking = useSpeaking(stream, !muted), peerSpeaking = useSpeaking(remote, status === "Connected");

  function stop() {
    operation.current++;
    const current = live.current; live.current = null;
    current?.stream.getTracks().forEach(track => track.stop());
    pc.current?.close(); pc.current = null;
    if (current) void leave({ roomId, clientId: current.id }).catch(() => {});
    setClientId(null); setNetwork(null); setStream(null); setRemote(null); setMuted(false); mutedRef.current = false;
    setStatus("Voice is off"); setPlayBlocked(false);
  }
  const stopRef = useRef(stop); stopRef.current = stop;
  useEffect(() => () => { stopRef.current(); }, [roomId]);

  async function start() {
    if (starting.current) return;
    starting.current = true; setBusy(true); setError("");
    const revision = ++operation.current;
    let capture: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("unsupported");
      capture = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (revision !== operation.current) { capture.getTracks().forEach(t => t.stop()); return; }
      const id = crypto.randomUUID();
      await join({ roomId, clientId: id });
      if (revision !== operation.current) { capture.getTracks().forEach(t => t.stop()); void leave({ roomId, clientId: id }).catch(() => {}); return; }
      live.current = { id, stream: capture };
      const config = await getConfig({ roomId, clientId: id });
      if (revision !== operation.current) { capture.getTracks().forEach(t => t.stop()); void leave({ roomId, clientId: id }).catch(() => {}); return; }
      setNetwork(config);
      live.current = { id, stream: capture };
      capture.getAudioTracks().forEach(track => { track.onended = () => { stopRef.current(); setError("Your microphone disconnected. Check the device, then join again."); }; });
      setStream(capture); setClientId(id); setStatus("Waiting for your partner to join voice");
    } catch (cause) {
      capture?.getTracks().forEach(t => t.stop());
      if (revision === operation.current) {
        const current = live.current; live.current = null;
        if (current) void leave({ roomId, clientId: current.id }).catch(() => {});
        setNetwork(null);
      }
      if (revision === operation.current) setError(cause instanceof ConvexError && typeof cause.data === "string" ? cause.data : "Microphone unavailable. Allow microphone access on this site and check your device. Voice requires HTTPS or localhost.");
    } finally { starting.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!clientId) return;
    const ping = () => void heartbeat({ roomId, clientId, muted: mutedRef.current }).catch(() => {
      if (live.current?.id !== clientId) return;
      stopRef.current(); setError("Voice lost its room connection. Rejoin when the station reconnects.");
    });
    const timer = setInterval(ping, 15_000);
    const limit = setTimeout(() => { stopRef.current(); setError("The 30-minute voice session ended. You can join again."); }, 30 * 60_000);
    return () => { clearInterval(timer); clearTimeout(limit); };
  }, [clientId, roomId, heartbeat]);

  const peerId = data?.peerId, role = data?.role;
  useEffect(() => {
    if (!clientId || connected) return;
    const timer = setTimeout(() => { stopRef.current(); setError("Station disconnected. Your microphone was stopped; rejoin voice after reconnecting."); }, 10_000);
    return () => clearTimeout(timer);
  }, [clientId, connected]);
  useEffect(() => {
    if (!clientId || !stream || !peerId || !role || !network) {
      if (clientId) setStatus("Waiting for your partner to join voice");
      return;
    }
    let disposed = false;
    const connection = new RTCPeerConnection({ iceServers: network.iceServers });
    pc.current = connection;
    setStatus("Connecting audio…");
    let disconnected: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => fail(), 30_000);
    const fail = () => {
      if (disposed) return;
      stopRef.current(); setError("Audio could not connect. Leave and rejoin voice on both devices, or continue in team chat.");
    };
    connection.onconnectionstatechange = () => {
      if (disposed) return;
      clearTimeout(disconnected);
      if (connection.connectionState === "connected") { clearTimeout(timeout); setStatus("Connected"); }
      else if (connection.connectionState === "disconnected") { setStatus("Audio interrupted · reconnecting…"); disconnected = setTimeout(fail, 10_000); }
      else if (connection.connectionState === "failed") fail();
    };
    connection.ontrack = event => { if (!disposed) setRemote(new MediaStream([event.track])); };
    stream.getTracks().forEach(track => connection.addTrack(track, stream));
    if (role === "archivist") void (async () => {
      await connection.setLocalDescription(await connection.createOffer());
      const sdp = await description(connection);
      if (!disposed) await send({ roomId, clientId, targetId: peerId, sdp });
    })().catch(fail);
    return () => {
      disposed = true; clearTimeout(timeout); clearTimeout(disconnected);
      connection.close(); if (pc.current === connection) pc.current = null; setRemote(null);
    };
  }, [clientId, stream, peerId, role, roomId, send, network]);

  const incoming = data?.description?.sdp;
  useEffect(() => {
    const connection = pc.current;
    if (!connection || !incoming || !clientId || !peerId || connection.remoteDescription) return;
    let disposed = false;
    void (async () => {
      await connection.setRemoteDescription({ type: role === "operator" ? "offer" : "answer", sdp: incoming });
      if (role === "operator") {
        await connection.setLocalDescription(await connection.createAnswer());
        const sdp = await description(connection);
        if (!disposed && pc.current === connection) await send({ roomId, clientId, targetId: peerId, sdp });
      }
    })().catch(() => { if (!disposed && pc.current === connection) { stopRef.current(); setError("The audio handshake failed. Join voice again to retry."); } });
    return () => { disposed = true; };
  }, [incoming, peerId, clientId, role, roomId, send]);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.srcObject = remote;
    if (remote) void element.play().then(() => setPlayBlocked(false)).catch(() => setPlayBlocked(true));
    return () => { element.pause(); element.srcObject = null; };
  }, [remote]);
  function toggleMute() {
    const value = !muted; mutedRef.current = value; setMuted(value);
    stream?.getAudioTracks().forEach(track => { track.enabled = !value; });
    if (clientId) void heartbeat({ roomId, clientId, muted: value }).catch(() => { stopRef.current(); setError("Voice disconnected. Rejoin to continue."); });
  }
  return <section className="voice-call" aria-labelledby="voice-title">
    <div><h2 id="voice-title"><Phone size={16} /> Talk to your partner</h2>
      <p>Both players join to talk.</p>
      <p className="voice-status" role="status">{status}{clientId && !connected ? " · station reconnecting" : ""}</p>
      {clientId && <div className="voice-speakers"><span data-speaking={ownSpeaking}>{muted ? "You · muted" : ownSpeaking ? "You · speaking" : "You · microphone on"}</span><span data-speaking={peerSpeaking}>{!peerId ? "Partner · voice off" : data?.peerMuted ? "Partner · muted" : peerSpeaking ? "Partner · speaking" : "Partner · joining / listening"}</span></div>}
    </div>
    <div className="voice-controls">{clientId ? <><button onClick={toggleMute}>{muted ? <MicOff size={16} /> : <Mic size={16} />}{muted ? "Unmute" : "Mute"}</button><button onClick={stop}><PhoneOff size={16} /> Leave voice</button></> : <button disabled={busy || !connected || !data} onClick={() => void start()}><Mic size={16} />{busy ? "Opening microphone…" : "Join voice"}</button>}
      {busy && <button onClick={() => { stop(); setStatus("Microphone request cancelled"); }}>Cancel</button>}
      {playBlocked && <button onClick={() => void audio.current?.play().then(() => setPlayBlocked(false)).catch(() => setError("Audio playback is blocked. Check your browser’s sound permission."))}>Play partner audio</button>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <details className="voice-disclosure"><summary>Voice connection & privacy</summary><p>{network?.relay ? "Relay fallback is available for restrictive networks." : "Direct connection only until the server relay is configured; some networks may not connect."} Both players must join. Calls end after 30 minutes. Audio is not recorded or sent to AI. Direct connections may reveal your network address to your partner.</p></details>
    <audio ref={audio} autoPlay aria-label="Partner audio" />
  </section>;
}
