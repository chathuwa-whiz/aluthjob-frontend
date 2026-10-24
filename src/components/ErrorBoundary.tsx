import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";

/** A bug in one screen should show a plain message and a way out, never a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="auth">
        <div className="auth__column">
          <Alert
            kind="bad"
            title="Something went wrong on this page"
            actions={
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                Reload the page
              </Button>
            }
          >
            Nothing you approved was sent because of this. Reloading usually fixes it.
          </Alert>
        </div>
      </div>
    );
  }
}
