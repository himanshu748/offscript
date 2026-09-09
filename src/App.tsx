import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import usePresence from "@convex-dev/presence/react";
import {
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Copy,
  Radio,
  Users,
  LockKeyhole,
  Share2,
  FileText,
  Headphones,
  RotateCcw,
  LoaderCircle,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { Action, Clue, PlayerView } from "../server/engine.mjs";
import { PlayerPanel, type PublicPlayer } from "./PlayerPanel";
import { CaseServices } from "./CaseServices";
import { VoiceCall } from "./VoiceCall";

function storedRoom() {
  try {
    return localStorage.getItem("offscript.room") as Id<"rooms"> | null;
  } catch {
    return null;
  }
}
function errorText(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : "We couldn’t save that. Check your connection, then try again.";
}
function Signal({ paired = false }: { paired?: boolean }) {
  return (
    <div className={`signal ${paired ? "paired" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 420 270" fill="none">
        <ellipse
          cx="210"
          cy="137"
          rx="175"
          ry="76"
          transform="rotate(-28 210 137)"
        />
        <ellipse
          cx="210"
          cy="137"
          rx="125"
          ry="112"
          transform="rotate(34 210 137)"
        />
        <circle cx="210" cy="137" r="45" />
        <path
          className="signal-path"
          d="M25 137h96l8-13 10 27 12-52 13 86 15-120 17 143 17-117 13 85 12-51 11 24 9-12h117"
        />
        <circle className="orbiter" cx="63" cy="182" r="7" />
        <circle cx="326" cy="74" r="4" />
      </svg>
      <span className="signal-caption">
        {paired ? "TWO SIDES. ONE SIGNAL." : "THE SIGNAL NEEDS TWO LISTENERS."}
      </span>
    </div>
  );
}
function ClueCard({ clue, shared = false }: { clue: Clue; shared?: boolean }) {
  return (
    <article className={`clue ${shared ? "shared-clue" : ""}`}>
      <div className="document-meta">
        <FileText size={16} />
        <span>
          {clue.kind === "historical-facts"
            ? "Historical record"
            : "Fictional case evidence"}
        </span>
      </div>
      <h3>{clue.title}</h3>
      <p>{clue.text}</p>
      {clue.sources.length > 0 && (
        <div className="sources">
          <span>Check the original sources</span>
          {clue.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.title}
              <ExternalLink size={13} />
            </a>
          ))}
        </div>
      )}
      <div className="paper-bottom">
        <span>OFFSCRIPT / CASE 001</span>
        <span>{shared ? "SHARED COPY" : "YOUR EYES FIRST"}</span>
      </div>
    </article>
  );
}

function CaseTrail({ view }: { view: PlayerView }) {
  const shared = view.contributions.length === 2;
  const recovered = view.phase !== "investigating";
  const replied = view.phase === "decision" || view.phase === "resolved";
  const stages = view.challenge ? ["Recover dispatch", "Break the cipher", "Find the relay"].map((title, index) => ({
    title, detail: view.challenge!.index > index ? "Recovered" : view.challenge!.index === index ? "At your desks" : "Sealed evidence",
    done: view.challenge!.index > index, current: view.challenge!.index === index,
  })) : [
    {
      title: "Read & share",
      detail: `${view.contributions.length} of 2 clues pinned`,
      done: shared,
      current: !shared,
    },
    {
      title: "Recover dispatch",
      detail: recovered
        ? "Evidence matched"
        : shared
          ? "Ready to solve"
          : "Needs both clues",
      done: recovered,
      current: shared && !recovered,
    },
    {
      title: "Character reply",
      detail: replied ? "Reply acknowledged" : "Not connected yet",
      done: replied,
      current: recovered && !replied,
    },
  ];
  return (
    <ol className="case-trail" aria-label="Case progress">
      {stages.map((stage, index) => (
        <li
          key={stage.title}
          className={
            stage.done ? "complete" : stage.current ? "current" : "locked"
          }
          aria-current={stage.current ? "step" : undefined}
        >
          <span className="stage-marker" aria-hidden="true">
            {stage.done ? (
              <Check size={16} />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </span>
          <div>
            <strong>{stage.title}</strong>
            <span>{stage.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RolePreview() {
  const [selected, setSelected] = useState<"archivist" | "operator">(
    "archivist",
  );
  return (
    <aside
      className={`role-preview preview-${selected}`}
      aria-label="Preview the two roles"
    >
      <div className="preview-case">
        <h2>
          THE LAST
          <br />
          TRANSMISSION.
        </h2>
        <span>
          CASE
          <br />
          <b>01</b>
        </span>
      </div>
      <div className="perspective-papers">
        <article
          className={`preview-paper archive-paper ${selected === "archivist" ? "selected" : ""}`}
        >
          <div className="preview-paper-type">
            <FileText size={17} />
            <span>ARCHIVIST</span>
          </div>
          <h3>
            The launch
            <br />
            manifest.
          </h3>
          <p>This desk holds the historical record.</p>
          <div className="sealed-evidence">
            <LockKeyhole size={15} />
            <span>Clue opens in your room</span>
          </div>
          <span className="paper-index">ONE SIDE OF THE STORY</span>
        </article>
        <article
          className={`preview-paper operator-paper ${selected === "operator" ? "selected" : ""}`}
        >
          <div className="preview-paper-type">
            <Headphones size={17} />
            <span>OPERATOR</span>
          </div>
          <h3>
            The routing
            <br />
            note.
          </h3>
          <p>This desk holds the instruction.</p>
          <div className="sealed-evidence">
            <LockKeyhole size={15} />
            <span>Clue opens in your room</span>
          </div>
          <span className="paper-index">THE OTHER SIDE</span>
        </article>
      </div>
      <div className="role-switch" role="group" aria-label="Preview a role">
        <button
          aria-pressed={selected === "archivist"}
          onClick={() => setSelected("archivist")}
        >
          <FileText size={16} />
          Archivist
        </button>
        <button
          aria-pressed={selected === "operator"}
          onClick={() => setSelected("operator")}
        >
          <Headphones size={16} />
          Operator
        </button>
      </div>
      <p className="preview-description" aria-live="polite">
        {selected === "archivist"
          ? "You bring the facts. Your partner has the missing context."
          : "You know what to look for. Your partner holds the record."}
      </p>
      <p className="preview-disclaimer">
        Role preview · not your case clues
        <br />A fictional mystery. Real space history.
      </p>
    </aside>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const connection = useConvexConnectionState();
  const { signIn } = useAuthActions();
  const createRoom = useMutation(api.rooms.create);
  const joinRoom = useMutation(api.rooms.join);
  const [roomId, setRoomId] = useState<Id<"rooms"> | null>(() =>
    location.hash.startsWith("#join=") ? null : storedRoom(),
  );
  const [invite, setInvite] = useState(() =>
    location.hash.startsWith("#join=") ? location.hash.slice(6) : "",
  );
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [busy, setBusy] = useState(false);
  const [timed, setTimed] = useState(true);
  const [error, setError] = useState("");
  const actionRunning = useRef(false);
  const createArgs = useRef({
    inviteToken: crypto.randomUUID(),
    createKey: crypto.randomUUID(),
  });
  useEffect(() => {
    function openInvitation() {
      if (!location.hash.startsWith("#join=")) return;
      setInvite(location.hash.slice(6));
      setRoomId(null);
      setError("");
    }
    window.addEventListener("hashchange", openInvitation);
    return () => window.removeEventListener("hashchange", openInvitation);
  }, []);
  const room = useQuery(
    api.rooms.get,
    isAuthenticated && roomId ? { roomId } : "skip",
  );
  function remember(id: Id<"rooms">) {
    try {
      localStorage.setItem("offscript.room", id);
    } catch {
      /* session remains usable without persistence */
    }
    setRoomId(id);
    history.replaceState(null, "", location.pathname);
    setInvite("");
  }
  async function start(kind: "create" | "join") {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (!isAuthenticated) await signIn("anonymous");
      setPending(kind);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!pending || !isAuthenticated || actionRunning.current) return;
    actionRunning.current = true;
    (async () => {
      try {
        const id =
          pending === "create"
            ? await createRoom({ ...createArgs.current, timed })
            : await joinRoom({ inviteToken: invite.trim() });
        remember(id);
        createArgs.current = {
          inviteToken: crypto.randomUUID(),
          createKey: crypto.randomUUID(),
        };
      } catch (e) {
        setError(errorText(e));
      } finally {
        setPending(null);
        setBusy(false);
        actionRunning.current = false;
      }
    })();
  }, [pending, isAuthenticated, createRoom, joinRoom, invite, timed]);

  const active = Boolean(roomId);
  return (
    <div className={`app ${active ? "in-case" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="masthead">
        <button
          className="wordmark"
          onClick={() => {
            setRoomId(null);
            setError("");
          }}
          aria-label="OFFSCRIPT home"
        >
          OFFSCRIPT
          <span className="brand-mark" aria-hidden="true">
            /
          </span>
        </button>
        <div className="header-right">
          <span className="edition">COOPERATIVE MYSTERIES</span>
          <PlayerPanel timed={timed} onResume={remember} onAccountSwitch={() => {
            setRoomId(null); setError(""); setInvite("");
            try { localStorage.removeItem("offscript.room"); } catch { /* optional local cache */ }
            history.replaceState(null, "", location.pathname);
          }} onInvite={async (friendPlayerId) => {
            const id = await createRoom({ ...createArgs.current, timed, friendPlayerId });
            remember(id);
            createArgs.current = { inviteToken: crypto.randomUUID(), createKey: crypto.randomUUID() };
          }} onJoin={async (inviteToken) => { remember(await joinRoom({ inviteToken })); }} />
          <span className="connection">
            <i className={connection.isWebSocketConnected ? "connected" : ""} />
            {connection.isWebSocketConnected
              ? "Station connected"
              : "Connecting…"}
          </span>
        </div>
      </header>
      {!connection.isWebSocketConnected && active && (
        <div className="connection-banner" role="status">
          Reconnecting to the station. Wait for the connection before sharing or
          submitting.
        </div>
      )}
      {active ? (
        <main id="main" className="case-main">
          <button className="back-link" onClick={() => setRoomId(null)}>
            <ChevronLeft size={15} />
            Station home
          </button>
          {isLoading || !isAuthenticated || room === undefined ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              <h1>Opening your desk.</h1>
              <p>Restoring your private case from Convex.</p>
              {!isLoading && !isAuthenticated && (
                <button
                  onClick={() => {
                    setRoomId(null);
                    setError(
                      "This browser no longer has the guest identity for that room. Ask your partner to start a new case.",
                    );
                  }}
                >
                  Return to station
                </button>
              )}
            </div>
          ) : room === null ? (
            <div className="loading">
              <LockKeyhole />
              <h1>This room isn’t yours.</h1>
              <p>
                Use the browser you started with, or ask your partner for an
                invitation.
              </p>
              <button
                onClick={() => {
                  setRoomId(null);
                  try {
                    localStorage.removeItem("offscript.room");
                  } catch {
                    /* optional storage */
                  }
                }}
              >
                Return to station
              </button>
            </div>
          ) : !room.view ? (
            <WaitingRoom
              inviteToken={room.inviteToken!}
              expiresAt={room.expiresAt}
              invitedPlayer={room.invitedPlayer}
            />
          ) : (
            <Desk
              key={room.roomId}
              roomId={room.roomId}
              view={room.view}
              players={room.players}
              connected={connection.isWebSocketConnected}
              onReplay={() => { setRoomId(null); void start("create"); }}
            />
          )}
        </main>
      ) : (
        <main id="main">
          <section className="hero">
            <div className="hero-copy">
              <h1>
                YOU HAVE
                <br />
                <span>HALF THE STORY.</span>
              </h1>
              <p className="hero-deck">Your friend has the rest.</p>
              <p className="hero-description">
                Recover a lost dispatch. Break a rotating cipher. Catch the altered
                relay logs. Three challenges, two private desks—and a decision
                neither of you can make alone.
              </p>
              <div className="case-facts">
                <span>
                  <Users size={17} />2 players
                </span>
                <span>
                  <Headphones size={17} />
                  Optional room voice
                </span>
                <span>
                  <LockKeyhole size={17} />
                  Private room
                </span>
              </div>
              <div className="entry-controls">
                {!invite && <div className="mode-picker" role="group" aria-label="Choose a game mode">
                  <button aria-pressed={timed} disabled={busy} onClick={() => setTimed(true)}>Signal window · 8 min</button>
                  <button aria-pressed={!timed} disabled={busy} onClick={() => setTimed(false)}>Practice · no timer</button>
                </div>}
                {!invite && <p className="session-note">{timed ? "Both players ready up. Solve the case and agree on an ending before the eight-minute signal closes." : "Same puzzles, no countdown. Take your time learning the two roles."}</p>}
                {invite && (
                  <p className="invite-intro">
                    Join as the operator. Your partner’s clue stays private
                    until they share it.
                  </p>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="primary"
                  disabled={busy || isLoading}
                  onClick={() => start(invite ? "join" : "create")}
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" size={18} />
                      Connecting your desk…
                    </>
                  ) : (
                    <>
                      {invite
                        ? "Take the operator’s seat"
                        : "Open a private room"}
                      <ArrowUpRight size={22} />
                    </>
                  )}
                </button>
                {invite ? (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setInvite("");
                      history.replaceState(null, "", location.pathname);
                      setError("");
                    }}
                  >
                    Start my own room instead
                  </button>
                ) : (
                  storedRoom() && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setRoomId(storedRoom())}
                    >
                      <RotateCcw size={14} />
                      Return to my last room
                    </button>
                  )
                )}
                <p className="session-note">
                  No email needed. Your guest session stays in this browser.
                </p>
              </div>
            </div>
            <RolePreview />
          </section>
          <section className="how-it-works" aria-labelledby="how-title">
            <h2 id="how-title">
              A case you can’t
              <br />
              solve alone.
            </h2>
            <div>
              <h3>
                <span className="step-number">01</span>Read your side.
              </h3>
              <p>
                Each desk receives a different piece of evidence. Neither player
                sees the whole picture.
              </p>
            </div>
            <div>
              <h3>
                <span className="step-number">02</span>Put it together.
              </h3>
              <p>
                Join room voice or talk in person. Share your clues to pin them to
                both desks.
              </p>
            </div>
            <div>
              <h3>
                <span className="step-number">03</span>Recover the dispatch.
              </h3>
              <p>
                Match the evidence and submit your answer. The case records your
                progress as you go.
              </p>
            </div>
          </section>
          <aside className="build-note">
            <span className="build-tag">THREE-CHALLENGE CASE</span>
            <p>
              New rooms change the cipher and relay evidence. Solve all three
              challenges, then agree on an ending. Optional NASA source checks
              and an AI archivist help you examine shared evidence. Email a
              debrief to your verified address after the case ends.
            </p>
          </aside>
        </main>
      )}
      <footer>
        <span>OFFSCRIPT / AN EXPERIMENT IN PLAYING TOGETHER</span>
        <span>Fictional station. No real emergency.</span>
      </footer>
    </div>
  );
}

function WaitingRoom({
  inviteToken,
  expiresAt,
  invitedPlayer,
}: {
  inviteToken: string;
  expiresAt: number;
  invitedPlayer: PublicPlayer | null;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const link = `${location.origin}${location.pathname}#join=${inviteToken}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Select and copy the invitation below.");
    }
  }
  return (
    <section className="waiting">
      <div>
        <h1>
          ONE DESK OPEN.
          <br />
          <span>ONE FRIEND AWAY.</span>
        </h1>
        <p className="hero-deck">You’re the archivist.</p>
        <p className="hero-description">
          {invitedPlayer ? `Seat reserved for ${invitedPlayer.name} (${invitedPlayer.playerId}). They can join from Players & friends in their own browser.` : "The case opens when your operator arrives. Send this link privately. You can both opt into voice once you’re at your desks."}
        </p>
        <div className="invite-box">
          <label htmlFor="invite-link">Your operator’s invitation</label>
          <div>
            <input
              id="invite-link"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
            <button className="primary" onClick={copy}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p role="status">
            {copyError ||
              (copied
                ? "Copied. Send it to one friend."
                : `One seat only. Invitation expires ${new Date(expiresAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.`)}
          </p>
        </div>
        <div className="privacy-note">
          <LockKeyhole size={18} />
          <p>
            Only your partner needs the link. Your clue is kept on the server
            and only sent to your authenticated session.
          </p>
        </div>
      </div>
      <div className="waiting-instrument">
        <Signal />
        <div className="seat-row">
          <span>
            <FileText size={21} />
            ARCHIVIST
          </span>
          <strong>
            <Check size={15} />
            You’re here
          </strong>
        </div>
        <div className="seat-row empty">
          <span>
            <Headphones size={21} />
            OPERATOR
          </span>
          <strong>Waiting for partner</strong>
        </div>
      </div>
    </section>
  );
}

function useStationClock(roomId: Id<"rooms">, enabled: boolean, connected: boolean) {
  const syncClock = useMutation(api.rooms.syncClock);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled || !connected) { setNow(null); return; }
    let canceled = false;
    let anchor: { server: number; local: number } | null = null;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const sentAt = performance.now();
        const server = await syncClock({ roomId });
        const receivedAt = performance.now();
        const estimatedNow = server + (receivedAt - sentAt) / 2;
        if (!canceled) { anchor = { server: estimatedNow, local: receivedAt }; setNow(estimatedNow); }
      } catch { if (!canceled) setNow(null); }
      finally { syncing = false; }
    };
    void sync();
    const tick = window.setInterval(() => {
      if (anchor) setNow(anchor.server + performance.now() - anchor.local);
      else void sync();
    }, 1000);
    const visible = () => { if (!document.hidden) void sync(); };
    document.addEventListener("visibilitychange", visible);
    return () => { canceled = true; clearInterval(tick); document.removeEventListener("visibilitychange", visible); };
  }, [roomId, enabled, connected, syncClock]);
  return now;
}

function Desk({
  roomId,
  view,
  connected,
  onReplay,
  players,
}: {
  roomId: Id<"rooms">;
  view: PlayerView;
  connected: boolean;
  onReplay: () => void;
  players: { archivist: PublicPlayer | null; operator: PublicPlayer | null };
}) {
  const presence = usePresence(api.presence, roomId, view.role);
  const partner = presence?.find(person => person.userId !== view.role);
  const play = useMutation(api.rooms.play);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mission, setMission] = useState("");
  const [date, setDate] = useState("");
  const [answer, setAnswer] = useState("");
  const serverNow = useStationClock(roomId, Boolean(view.clock), connected);
  const secondsLeft = view.clock?.deadline && serverNow !== null
    ? Math.max(0, Math.min(480, Math.ceil((view.clock.deadline - (view.clock.finishedAt ?? serverNow)) / 1000))) : null;
  const locked = Boolean(view.clock && (!view.clock.deadline || view.clock.expired || serverNow === null || secondsLeft === 0));
  useEffect(() => { setAnswer(""); setMission(""); setDate(""); setError(""); }, [view.challenge?.index]);
  const shared = view.contributions.includes(view.role);
  const bothShared = view.contributions.length === 2;
  async function act(action: Action) {
    if (busy || !connected) return;
    setBusy(true);
    setError("");
    try {
      await play({ roomId, operationId: crypto.randomUUID(), action });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (view.challenge && view.challenge.index > 0)
      void act({ type: "submit-challenge", answer, challengeIndex: view.challenge.index });
    else void act({ type: "submit-solution", mission, launchDate: date, ...(view.challenge ? { challengeIndex: view.challenge.index } : {}) });
  }
  return (
    <>
      <div className="desk-heading">
        <div>
          <h1>THE LAST TRANSMISSION.</h1>
          <p>
            Your desk: <strong>{view.role}</strong>
            <span>Two players · shared case</span>
          </p>
        </div>
        <div className="phase">
          <i />
            {view.clock?.expired ? "Signal lost" : view.phase === "investigating"
            ? "Investigation open"
            : view.phase === "awaiting-reply"
              ? "Dispatch recovered"
              : view.phase === "resolved"
                ? "Case resolved"
                : "Decision open"}
        </div>
      </div>
      <div className="player-roster" aria-label="Players in this room">
        {(["archivist", "operator"] as const).map(role => <div key={role}>
          <span>{role}{view.role === role ? " · You" : " · Partner"}</span>
          <strong>{players[role]?.name ?? "Guest player"}</strong>
          <small>{players[role]?.playerId ?? "Player ID not created yet"}</small>
        </div>)}
        <p>Room actions are attributed to these seats. Voice is optional and private to this room.</p>
      </div>
      <CaseTrail view={view} />
      <VoiceCall key={`voice-${roomId}`} roomId={roomId} connected={connected} />
      {view.clock && <section className={`signal-window ${secondsLeft !== null && secondsLeft <= 60 ? "urgent" : ""}`} aria-label="Signal window">
        <div>
          <span className="timer-label">{view.clock.expired ? "SIGNAL LOST" : view.phase === "resolved" ? "TIME REMAINING AT COMPLETION" : "SIGNAL WINDOW"}</span>
          <strong className="countdown" role="timer" aria-label="Time remaining">{secondsLeft === null ? view.clock.deadline ? "Syncing…" : "08:00" : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`}</strong>
        </div>
        <div className="timer-instructions">
          {!view.clock.deadline ? <>
            <h2>Ready at both desks?</h2>
            <p>The clues open when both players are ready. Eight minutes covers all three puzzles and your joint decision.</p>
            <button className="primary" disabled={busy || !connected || view.clock.ready.includes(view.role)} onClick={() => act({ type: "ready" })}>
              {view.clock.ready.includes(view.role) ? "Ready · waiting for your partner" : "I’m ready"}
            </button>
            <p>{view.clock.ready.length} of 2 players ready</p>
          </> : view.clock.expired ? <>
            <h2>The window closed.</h2>
            <p>The station went silent before you agreed on an ending. Your discoveries are saved, but this attempt is over.</p>
            <button className="primary" disabled={!connected} onClick={onReplay}>Try a fresh case <RotateCcw size={18} /></button>
          </> : <>
            <h2>{view.phase === "resolved" ? "You beat the signal." : secondsLeft !== null && secondsLeft <= 60 ? "Final minute. Make it count." : "Keep the signal alive."}</h2>
            <p>{view.phase === "resolved" ? "Both players agreed before the station closed." : "Solve all three challenges, then agree on an ending. The clock keeps running through disconnects and reloads."}</p>
          </>}
        </div>
      </section>}
      <div className="team-strip" role="status">
        <span><i className={connected && partner?.online ? "live-dot" : "idle-dot"} />
          {!connected ? "Reconnecting · presence unknown" : presence === undefined ? "Checking partner connection…" : partner?.online ? "Partner at their desk" : "Partner away · their progress is saved"}
        </span>
        {view.challenge && <span>Team score {view.challenge.score}/100 · {view.challenge.mistakes} {view.challenge.mistakes === 1 ? "miss" : "misses"} · {view.challenge.hintsUsed} {view.challenge.hintsUsed === 1 ? "hint" : "hints"}</span>}
      </div>
      {view.story && <section className="transmission-record" aria-labelledby="transmission-title">
        <div className="transmission-heading">
          <h2 id="transmission-title">The recovered tape</h2>
          <span>{view.story.recovered} / 3 passages recovered · authored fiction</span>
        </div>
        <div className="tape-segments" aria-hidden="true">
          {[1, 2, 3].map(segment => <span key={segment} className={view.story!.recovered >= segment ? "recovered" : ""} />)}
        </div>
        <div key={view.story.recovered} className="transmission-passage" aria-live="polite">
          <h3>{view.story.passages.at(-1)?.title}</h3>
          <p>{view.story.passages.at(-1)?.text}</p>
        </div>
        {view.story.passages.length > 1 && <details>
          <summary>Read earlier passages</summary>
          {view.story.passages.slice(0, -1).map(passage => <p key={passage.title}><strong>{passage.title}.</strong> {passage.text}</p>)}
        </details>}
        <p className="next-move"><strong>Next:</strong> {view.story.next}</p>
      </section>}
      <div className="case-layout">
        <section className="private-desk" aria-labelledby="your-clue">
          <div className="section-heading">
            <h2 id="your-clue">Your side of the story.</h2>
            <LockKeyhole size={17} />
          </div>
          <ClueCard key={view.privateClue.id} clue={view.privateClue} />
          <button
            className={`share-button ${shared ? "is-shared" : ""}`}
            disabled={
              shared || busy || !connected || locked || view.phase !== "investigating"
            }
            onClick={() => act({ type: "contribute", ...(view.challenge ? { challengeIndex: view.challenge.index } : {}) })}
          >
            {shared ? (
              <>
                <Check size={18} />
                Pinned to both desks
              </>
            ) : (
              <>
                <Share2 size={18} />
                Share your clue with your partner
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="desk-hint">
            {shared
              ? "Your partner can now read this clue. Compare the evidence together."
              : "Read this first, then share it. Your partner has something you don’t."}
          </p>
        </section>
        <section className="shared-desk" aria-labelledby="shared-title">
          <div className="section-heading">
            <h2 id="shared-title">The shared desk.</h2>
            <span>{view.contributions.length} / 2 CLUES</span>
          </div>
          {view.sharedClues.length === 0 ? (
            <div className="empty-desk">
              <Share2 size={28} />
              <h3>The middle of the story is missing.</h3>
              <p>
                Share your clue to start connecting the two sides. Your
                partner’s discovery will appear here when they share theirs.
              </p>
            </div>
          ) : (
            <div className="shared-clues">
              {view.sharedClues.map((clue) =>
                clue.id === view.privateClue.id ? (
                  <details key={clue.id} className="shared-own">
                    <summary>
                      <Check size={17} />
                      <span>Your clue is on both desks</span>
                      <span className="disclosure-label">View copy</span>
                    </summary>
                    <ClueCard clue={clue} shared />
                  </details>
                ) : (
                  <ClueCard key={clue.id} clue={clue} shared />
                ),
              )}
              {!bothShared && (
                <p className="waiting-clue">
                  <span className="dot" />
                  One discovery pinned. Waiting for the other player’s clue.
                </p>
              )}
            </div>
          )}
          {view.phase === "investigating" && (
            <form className="dispatch" onSubmit={submit}>
              <div className="dispatch-heading">
                <Radio size={20} />
                <h3>{view.challenge?.title ?? "Reconstruct the dispatch."}</h3>
              </div>
              <p>
                {bothShared
                  ? view.challenge?.prompt ?? "Which mission does the dispatch belong to, and when did it launch? Check both clues before submitting."
                  : "This opens when both players have shared their clue."}
              </p>
              {view.timeline.length > 0 && (
                <p className="dispatch-update" role="status">
                  {view.timeline.at(-1)?.text}
                </p>
              )}
              <fieldset disabled={!bothShared || busy || !connected || locked}>
                {view.challenge && view.challenge.index > 0 ? (
                  <label className="challenge-answer">{view.challenge.index === 1 ? "Access code" : "Relay and reversed seal"}
                    <input required autoComplete="off" maxLength={80} value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder={view.challenge.index === 1 ? "Four digits" : "RELAY-00"} />
                  </label>
                ) : (
                <div className="form-fields">
                  <label>
                    Mission
                    <select
                      required
                      value={mission}
                      onChange={(e) => setMission(e.target.value)}
                    >
                      <option value="">Choose a mission</option>
                      <option value="Voyager 1">Voyager 1</option>
                      <option value="Voyager 2">Voyager 2</option>
                    </select>
                  </label>
                  <label>
                    Launch date
                    <input
                      required
                      type="text"
                      inputMode="text"
                      placeholder="YYYY-MM-DD"
                      pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                      maxLength={10}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      aria-describedby="date-format"
                    />
                    <span id="date-format" className="field-hint">
                      Year-month-day, e.g. 2000-01-31
                    </span>
                  </label>
                </div>
                )}
                <button className="primary" type="submit">
                  {busy ? "Checking the evidence…" : view.challenge && view.challenge.index > 0 ? "Check the answer" : "Check the dispatch"}
                  <ArrowRight size={18} />
                </button>
              </fieldset>
              {view.challenge && <div className="hint-panel">
                {view.challenge.hint ? <p role="status">Hint: {view.challenge.hint}</p> :
                  <button type="button" className="text-button" disabled={busy || !connected || locked}
                    onClick={() => act({ type: "request-hint", challengeIndex: view.challenge!.index })}>Open a shared hint (−10 points)</button>}
              </div>}
            </form>
          )}
          {view.phase === "awaiting-reply" && (
            <div className="chapter-end" role="status">
              <Check size={26} />
              <h3>You found the right dispatch.</h3>
              <p>
                Your joint progress is saved. The next chapter needs a character
                email reply, and that integration isn’t connected yet.
              </p>
              <p className="honest-status">
                <LockKeyhole size={15} />
                No email was sent. The final decision stays locked.
              </p>
            </div>
          )}
          {view.phase === "decision" && (
            <div className="dispatch">
              <h3>Decide together.</h3>
              <p>
                {view.story ? "Broadcast Mara’s confession and expose the witness’s identity, or keep the evidence private and leave the public log uncorrected. There is no cost-free ending. Both players must agree; the score does not reward either choice." : "Broadcasting exposes the cover-up but reveals private testimony. Preserving protects the witness but leaves the public record unchanged. Both players must agree."}
              </p>
              <div className="decision-buttons">
                <button
                  disabled={busy || !connected || locked}
                  onClick={() =>
                    act({ type: "vote-ending", choice: "broadcast" })
                  }
                >
                  Broadcast{" "}
                  {view.ownVote === "broadcast" && <Check size={16} />}
                </button>
                <button
                  disabled={busy || !connected || locked}
                  onClick={() =>
                    act({ type: "vote-ending", choice: "preserve" })
                  }
                >
                  Preserve {view.ownVote === "preserve" && <Check size={16} />}
                </button>
              </div>
              <p>
                {view.otherPlayerHasVoted
                  ? "Your partner has voted. You can revise your choice until you agree."
                  : "Waiting for your partner’s choice."}
              </p>
            </div>
          )}
          {view.phase === "resolved" && (
            <div className="chapter-end">
              <h3>
                {view.story?.outcome?.title ?? (view.ending === "broadcast"
                  ? "The recording is out."
                  : "The archive stays sealed.")}
              </h3>
              <p>
                {view.story?.outcome?.text ?? "You agreed on an ending together. This concludes the fictional case."}
              </p>
              {view.story?.outcome && <p><strong>{view.story.outcome.cost}</strong></p>}
              {view.challenge && <>
                <p>Three challenges solved. Team score: {view.challenge.score}/100.
                  New rooms vary the cipher and relay, not the dispatch warm-up.</p>
                <button className="primary" disabled={!connected} onClick={onReplay}>Open a fresh case <RotateCcw size={18} /></button>
                <p className="field-hint">Creates a new room and invitation. Your partner must join again. Five rooms per guest per day.</p>
              </>}
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <CaseServices key={roomId} roomId={roomId} connected={connected} timed={Boolean(view.clock && view.phase !== "resolved" && !view.clock.expired)} />
      <section className="timeline" aria-labelledby="timeline-title">
        <h2 id="timeline-title">Case record.</h2>
        <div aria-live="polite">
          {view.timeline.length === 0 ? (
            <p>
              Both roles are filled. Your first discovery starts the record.
            </p>
          ) : (
            <ol>
              {view.timeline.map((event, index) => (
                <li key={`${event.revision}-${index}`}>
                  <span>{String(event.revision).padStart(2, "0")}</span>
                  {event.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </>
  );
}
