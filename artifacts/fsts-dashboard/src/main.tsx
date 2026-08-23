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
      const err = this.state.error as Error;
      return (
        <div style={{ fontFamily: "monospace", padding: "2rem", background: "#fff1f2", minHeight: "100dvh" }}>
          <h1 style={{ color: "#b91c1c", fontSize: "1.25rem", marginBottom: "1rem" }}>
            App failed to start
          </h1>
          <pre style={{ color: "#991b1b", whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.8rem" }}>
            {err.message}
            {"\n\n"}
            {err.stack}
          </pre>
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
