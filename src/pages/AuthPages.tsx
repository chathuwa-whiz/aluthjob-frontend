import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { messageOf } from "../api/client";
import { auth } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { PasswordField, TextField } from "../components/Field";
import { clearHash, tokenFromHash } from "../lib/url";
import { usePageTitle } from "../lib/usePageTitle";

const MIN_PASSWORD = 10;

function useSubmit<T>(action: () => Promise<T>, onDone: (result: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await action());
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, setError, submit };
}

// ---- sign in ---------------------------------------------------------------------------

export function Login() {
  usePageTitle("Sign in");
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; notice?: string } | null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, submit } = useSubmit(
    () => signIn(email.trim(), password),
    () => navigate(state?.from ?? "/", { replace: true }),
  );

  return (
    <>
      <div className="auth__intro">
        <h1>Sign in</h1>
        <p>Pick up your job search where you left it.</p>
      </div>

      {state?.notice && <Alert kind="ok">{state.notice}</Alert>}
      {error && <Alert kind="bad">{error}</Alert>}

      <form className="form" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" autoComplete="username" inputMode="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} />
        <PasswordField label="Password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <Button type="submit" variant="primary" size="lg" block busy={busy} disabled={!email || !password}>
          Sign in
        </Button>
      </form>

      <div className="auth__links">
        <Link to="/forgot-password">Forgot your password?</Link>
        <Link to="/register">Create an account</Link>
      </div>
    </>
  );
}

// ---- sign up ---------------------------------------------------------------------------

export function Register() {
  usePageTitle("Create your account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const { busy, error, submit } = useSubmit(
    async () => {
      if (password.length < MIN_PASSWORD) {
        setFieldError(`Use at least ${MIN_PASSWORD} characters.`);
        throw new Error("Please choose a longer password.");
      }
      setFieldError(null);
      return auth.register(email.trim(), password);
    },
    (result) => setSent(result.message),
  );

  if (sent) {
    return (
      <>
        <div className="empty__icon">
          <MailCheck size={22} aria-hidden="true" />
        </div>
        <div className="auth__intro">
          <h1>Check your email</h1>
          <p>{sent}</p>
        </div>
        <Alert kind="info">
          The link works for 24 hours. Nothing arrived after a few minutes? Look in your spam folder, then try signing in: you can ask for a new link from there.
        </Alert>
        <div className="auth__links">
          <Link to="/login">Go to sign in</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="auth__intro">
        <h1>Create your account</h1>
        <p>Upload your CV once. We find the jobs that fit and prepare the applications, and you approve every one.</p>
      </div>

      {error && !fieldError && <Alert kind="bad">{error}</Alert>}

      <form className="form" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} hint="We send a confirmation link here." />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldError}
          hint={`At least ${MIN_PASSWORD} characters. A few unrelated words make a strong, easy-to-remember password.`}
        />
        <Button type="submit" variant="primary" size="lg" block busy={busy} disabled={!email || !password}>
          Create account
        </Button>
      </form>

      <div className="auth__links">
        <span className="muted">Already have an account?</span>
        <Link to="/login">Sign in</Link>
      </div>
    </>
  );
}

// ---- forgot and reset ------------------------------------------------------------------

export function ForgotPassword() {
  usePageTitle("Reset your password");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, submit } = useSubmit(() => auth.forgotPassword(email.trim()), (result) => setSent(result.message));

  if (sent) {
    return (
      <>
        <div className="empty__icon">
          <MailCheck size={22} aria-hidden="true" />
        </div>
        <div className="auth__intro">
          <h1>Check your email</h1>
          <p>{sent}</p>
        </div>
        <Alert kind="info">The link works once and expires in an hour. If nothing arrives, check your spam folder before asking again.</Alert>
        <div className="auth__links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="auth__intro">
        <h1>Reset your password</h1>
        <p>Enter your email and we will send a link to choose a new one.</p>
      </div>

      {error && <Alert kind="bad">{error}</Alert>}

      <form className="form" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Button type="submit" variant="primary" size="lg" block busy={busy} disabled={!email}>
          Send reset link
        </Button>
      </form>

      <div className="auth__links">
        <Link to="/login">Back to sign in</Link>
      </div>
    </>
  );
}

export function ResetPassword() {
  usePageTitle("Choose a new password");
  const navigate = useNavigate();
  // The token arrives in the URL fragment of the emailed link. It is read once and then removed from the
  // address bar, so it does not linger in the browser history.
  const [token] = useState(() => {
    const found = tokenFromHash(window.location.hash);
    if (found) clearHash();
    return found;
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { busy, error, submit } = useSubmit(
    async () => {
      if (password !== confirm) {
        setFieldError("The two passwords are not the same.");
        throw new Error("Please type the same password twice.");
      }
      setFieldError(null);
      return auth.resetPassword(token!, password);
    },
    () => navigate("/login", { replace: true, state: { notice: "Your password was changed and every device was signed out. Sign in with the new password." } }),
  );

  if (!token) {
    return (
      <>
        <div className="auth__intro">
          <h1>This link is incomplete</h1>
          <p>Open the link from the email exactly as it was sent, or ask for a new one.</p>
        </div>
        <Link className="btn btn--primary btn--lg btn--block" to="/forgot-password">
          Send me a new link
        </Link>
      </>
    );
  }

  const expired = error?.toLowerCase().includes("invalid or has expired");

  return (
    <>
      <div className="auth__intro">
        <h1>Choose a new password</h1>
        <p>You will be signed out everywhere else once it is changed.</p>
      </div>

      {error && !fieldError && (
        <Alert kind="bad" actions={expired ? <Link to="/forgot-password">Send me a new link</Link> : undefined}>
          {error}
        </Alert>
      )}

      <form className="form" onSubmit={submit} noValidate>
        <PasswordField label="New password" autoComplete="new-password" required autoFocus value={password} onChange={(event) => setPassword(event.target.value)} hint={`At least ${MIN_PASSWORD} characters.`} />
        <PasswordField label="Type it again" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} error={fieldError} />
        <Button type="submit" variant="primary" size="lg" block busy={busy} disabled={!password || !confirm}>
          Change password
        </Button>
      </form>
    </>
  );
}
