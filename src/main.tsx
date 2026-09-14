import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import App from "./App";
import "./styles.css";
import "./controls.css";

class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="setup">
        <h1>The connection slipped.</h1>
        <p>Your saved actions are still on the server. Reload to reconnect.</p>
        <button onClick={() => location.reload()}>Reload my desk</button>
        <button
          onClick={() => {
            try { localStorage.removeItem("offscript.room"); } catch { /* optional storage */ }
            location.reload();
          }}
        >
          Forget this room and start over
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const url = import.meta.env.VITE_CONVEX_URL;
createRoot(document.getElementById("root")!).render(
  <Boundary>
    {url ? (
      <ConvexAuthProvider client={new ConvexReactClient(url)}>
        <App />
      </ConvexAuthProvider>
    ) : (
      <main className="setup">
        <h1>The station is not connected.</h1>
        <p>
          Set VITE_CONVEX_URL to your Convex deployment and restart the app. No
          local simulation is running.
        </p>
      </main>
    )}
  </Boundary>,
);
