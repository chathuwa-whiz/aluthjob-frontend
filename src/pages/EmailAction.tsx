import { CheckCircle2, MailQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { messageOf } from "../api/client";
import { alerts } from "../api/endpoints";
import type { AlertActionPreview, AlertActionResult } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Alert } from "../components/Alert";
import { Skeleton } from "../components/Bits";
import { Button } from "../components/Button";
import { AuthLayout } from "../components/Layouts";
import { clearHash, tokenFromHash } from "../lib/url";
import { usePageTitle } from "../lib/usePageTitle";

// React in development mounts components twice; remembering the answer per token keeps it to one request
const previews = new Map<string, Promise<AlertActionPreview>>();
const previewOnce = (token: string) => {
  let attempt = previews.get(token);
  if (!attempt) {
    attempt = alerts.preview(token);
    previews.set(token, attempt);
  }
  return attempt;
};

type State =
  | { status: "loading" }
  | { status: "ask"; preview: AlertActionPreview }
  | { status: "working"; preview: AlertActionPreview }
  | { status: "done"; result: AlertActionResult }
  | { status: "failed"; message: string };

/**
 * The page the buttons in a job-alert email open ("Not for me", "Weekly", "Pause", "Unsubscribe"). It says what
 * the button will do and waits for one more click: mail scanners and link previews open every link in a message,
 * so opening this page must never change anything by itself.
 */
export function EmailAction() {
  usePageTitle("Email updates");
  const { user } = useAuth();
  const [token] = useState(() => {
    const found = tokenFromHash(window.location.hash);
    if (found) clearHash();
    return found;
  });
  const [state, setState] = useState<State>(
    token ? { status: "loading" } : { status: "failed", message: "This link is incomplete. Open it from the email exactly as it was sent." },
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    previewOnce(token).then(
      (preview) => !cancelled && setState({ status: "ask", preview }),
      (error: unknown) => !cancelled && setState({ status: "failed", message: messageOf(error) }),
    );

    return () => {
      cancelled = true;
    };
  }, [token]);

  const confirm = async (preview: AlertActionPreview) => {
    if (!token) return;
    setState({ status: "working", preview });

    try {
      setState({ status: "done", result: await alerts.act(token) });
    } catch (error) {
      setState({ status: "failed", message: messageOf(error) });
    }
  };

  return (
    <AuthLayout>
      {state.status === "loading" && (
        <>
          <h1>One moment…</h1>
          <Skeleton height="2.5rem" />
        </>
      )}

      {(state.status === "ask" || state.status === "working") && (
        <>
          <div className="auth__intro">
            <h1>{titleOf(state.preview)}</h1>
            {state.preview.jobTitle && (
              <p>
                <strong className="wrap">{state.preview.jobTitle}</strong>
              </p>
            )}
            <p>{state.preview.summary}</p>
          </div>

          <div className="form">
            <Button variant={state.preview.action === "off" ? "danger" : "primary"} size="lg" block busy={state.status === "working"} onClick={() => void confirm(state.preview)}>
              {state.preview.confirmLabel}
            </Button>
            <Link className="btn btn--ghost btn--block" to="/">
              Never mind
            </Link>
          </div>
        </>
      )}

      {state.status === "done" && (
        <>
          <div className="empty__icon">
            <CheckCircle2 size={22} aria-hidden="true" />
          </div>
          <div className="auth__intro">
            <h1>Done</h1>
            <p>{state.result.message}</p>
          </div>
          <div className="form">
            <Link className="btn btn--primary btn--lg btn--block" to="/">
              {user ? "Back to your matches" : "Open AluthJob"}
            </Link>
            <Link className="btn btn--ghost btn--block" to="/account#alerts">
              Change email updates
            </Link>
          </div>
        </>
      )}

      {state.status === "failed" && (
        <>
          <div className="empty__icon">
            <MailQuestion size={22} aria-hidden="true" />
          </div>
          <div className="auth__intro">
            <h1>We could not do that</h1>
          </div>
          <Alert kind="bad">{state.message}</Alert>
          <p className="muted small">You can change what we email you at any time in Account, under email updates.</p>
          <Link className="btn btn--primary btn--lg btn--block" to="/account#alerts">
            Open settings
          </Link>
        </>
      )}
    </AuthLayout>
  );
}

function titleOf(preview: AlertActionPreview): string {
  switch (preview.action) {
    case "hide":
      return "Hide this job?";
    case "off":
      return "Unsubscribe from job emails?";
    case "pause":
      return "Pause job emails?";
    case "daily":
      return "Switch to daily emails?";
    case "weekly":
      return "Switch to weekly emails?";
  }
}
