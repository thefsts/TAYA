import { createRoot } from "react-dom/client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import App from "./App";
import "./index.css";
import "./auth.css";

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Root error boundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      // HOTFIX (production no-go, BLOCKER 2 §3): the last-resort boundary
      // renders client-safe language — never raw error text or stack
      // traces. Full diagnostics go to the browser console only.
      return (
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            background: "#faf5ff",
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <h1
              style={{
                color: "#86198f",
                fontSize: "1.25rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
              }}
            >
              Something went wrong
            </h1>
            <p style={{ color: "#581c87", fontSize: "0.95rem", lineHeight: 1.6 }}>
              We're sorry — we hit an unexpected problem and can't show your dashboard right now. Your website and
              your saved work are safe. Please try again in a few minutes, or contact your FSTS support team if it
              keeps happening.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: "1.25rem",
                padding: "0.5rem 1.25rem",
                borderRadius: "9999px",
                border: "1px solid #d8b4fe",
                background: "white",
                color: "#86198f",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.state.error === null ? this.props.children : null;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
