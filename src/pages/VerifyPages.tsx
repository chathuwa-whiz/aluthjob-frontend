import { CheckCircle2, MailWarning } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, messageOf } from "../api/client";
import { auth } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { useToast } from "../components/Toast";
import { Skeleton } from "../components/Bits";
import { AuthLayout } from "../components/Layouts";
import { clearHash, tokenFromHash } from "../lib/url";
import { usePageTitle } from "../lib/usePageTitle";

// A link may be used only once, and React in development mounts components twice. Remembering the
// request per token makes sure the second mount shares the first answer instead of spending the link twice.
const attempts = new Map<string, Promise<void>>();
const verifyOnce = (token: string) => {
  let attempt = attempts.get(token);
  if (!attempt) {
    attempt = auth.verifyEmail(token).then(() => undefined);
    attempts.set(token, attempt);
  }
  return attempt;
};

/** The page an emailed confirmation link opens. */
export function VerifyEmail() {
  usePageTitle("Confirm your email");
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [token] = useState(() => {
    const found = tokenFromHash(window.location.hash);
    if (found) clearHash();
    return found;
  });
  const [state, setState] = useState<{ status: "working" } | { status: "done" } | { status: "failed"; message: string }>(
    token ? { status: "working" } : { status: "failed", message: "This link is incomplete. Open it from the email exactly as it was sent." },
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    verifyOnce(token).then(
      async () => {
        await refresh();
        if (!cancelled) setState({ status: "done" });
      },
      (error: unknown) => !cancelled && setState({ status: "failed", message: messageOf(error) }),
    );

    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  return (
    <AuthLayout>
          {state.status === "working" && (
            <>
              <h1>Confirming your email…</h1>
              <Skeleton height="2.5rem" />
            </>
          )}

          {state.status === "done" && (
            <>
              <div className="empty__icon">
                <CheckCircle2 size={22} aria-hidden="true" />
              </div>
              <div className="auth__intro">
                <h1>Your email is confirmed</h1>
                <p>{user ? "You can start using AluthJob." : "Sign in to start using AluthJob."}</p>
              </div>
              {user ? (
                <Button variant="primary" size="lg" block onClick={() => navigate("/", { replace: true })}>
                  Continue
                </Button>
              ) : (
                <Link className="btn btn--primary btn--lg btn--block" to="/login">
                  Sign in
                </Link>
              )}
            </>
          )}

          {state.status === "failed" && (
            <>
              <div className="auth__intro">
                <h1>We could not confirm your email</h1>
              </div>
              <Alert kind="bad">{state.message}</Alert>
              <p className="muted small">Links work once. If you already used this one, just sign in. Otherwise sign in and ask for a new link.</p>
              <Link className="btn btn--primary btn--lg btn--block" to="/login">
                Go to sign in
              </Link>
            </>
          )}
    </AuthLayout>
  );
}

/** Shown instead of the app to an account whose email address has not been confirmed yet. */
export function ConfirmEmailGate() {
  usePageTitle("Confirm your email");
  const { user, signOut, refresh } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<"resend" | "check" | null>(null);
  const [message, setMessage] = useState<{ kind: "info" | "ok" | "bad"; text: string } | null>(null);

  const resend = async () => {
    setBusy("resend");
    setMessage(null);
    try {
      await auth.resendVerification();
      setMessage({ kind: "ok", text: `A new link is on its way to ${user?.email}. Older links no longer work.` });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await refresh(); // confirmed in the meantime
      else setMessage({ kind: "bad", text: messageOf(error) });
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy("check");
    setMessage(null);
    try {
      await refresh();
      toast("Checked just now");
      setMessage({ kind: "info", text: "Not confirmed yet. Open the link in the email we sent you, then come back here." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthLayout>
          <div className="empty__icon">
            <MailWarning size={22} aria-hidden="true" />
          </div>
          <div className="auth__intro">
            <h1>Confirm your email address</h1>
            <p>
              We sent a link to <strong className="wrap">{user?.email}</strong>. Open it to start using AluthJob. This keeps your account yours and lets you reset your password if you ever forget it.
            </p>
          </div>

          {message && <Alert kind={message.kind}>{message.text}</Alert>}

          <div className="form">
            <Button variant="primary" size="lg" block busy={busy === "check"} onClick={() => void check()}>
              I have confirmed it
            </Button>
            <Button variant="secondary" block busy={busy === "resend"} onClick={() => void resend()}>
              Send me a new link
            </Button>
          </div>

          <div className="auth__links">
            <span className="muted">Wrong address?</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
    </AuthLayout>
  );
}
