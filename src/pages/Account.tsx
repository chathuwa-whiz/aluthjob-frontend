import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { messageOf } from "../api/client";
import { auth } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { Alert } from "../components/Alert";
import { PageHead } from "../components/Bits";
import { Button } from "../components/Button";
import { PasswordField } from "../components/Field";
import { Pill } from "../components/Pill";
import { useToast } from "../components/Toast";
import { formatDate } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export function AccountPage() {
  usePageTitle("Account");
  const { user, signOut } = useAuth();

  return (
    <>
      <PageHead title="Account" actions={<Button onClick={() => void signOut()}>Sign out</Button>} />

      <div className="stack narrow">
        <section className="panel">
          <div className="panel__head">
            <h2>Your details</h2>
          </div>
          <div className="panel__body">
            <dl className="meta-list">
              <dt>Email</dt>
              <dd>
                {user?.email} {user?.emailVerified ? <Pill kind="ok">Confirmed</Pill> : <Pill kind="warn">Not confirmed</Pill>}
              </dd>
              <dt>Member since</dt>
              <dd>{formatDate(user?.createdAt)}</dd>
            </dl>
          </div>
        </section>

        <ChangePassword />
        <DeleteAccount />
      </div>
    </>
  );
}

function ChangePassword() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const change = useMutation({
    mutationFn: () => auth.changePassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setAgain("");
      toast("Password changed. Other devices were signed out.");
    },
  });

  return (
    <section className="panel" aria-labelledby="pw-heading">
      <div className="panel__head">
        <h2 id="pw-heading">Change password</h2>
      </div>
      <form
        className="panel__body form"
        onSubmit={(event) => {
          event.preventDefault();
          if (next !== again) return setMismatch(true);
          setMismatch(false);
          change.mutate();
        }}
        noValidate
      >
        {change.isError && <Alert kind="bad">{messageOf(change.error)}</Alert>}
        <PasswordField label="Current password" autoComplete="current-password" required value={current} onChange={(event) => setCurrent(event.target.value)} />
        <PasswordField label="New password" autoComplete="new-password" required value={next} onChange={(event) => setNext(event.target.value)} hint="At least 10 characters. Every other device will be signed out." />
        <PasswordField label="Type the new password again" autoComplete="new-password" required value={again} onChange={(event) => setAgain(event.target.value)} error={mismatch ? "The two passwords are not the same." : null} />
        <div className="form-actions">
          <Button type="submit" variant="primary" busy={change.isPending} disabled={!current || !next || !again}>
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}

function DeleteAccount() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);

  const remove = useMutation({
    mutationFn: () => auth.deleteAccount(password),
    // the account and its session are gone: clearing the screen's state sends the person to sign-in
    onSuccess: () => void signOut(),
  });

  return (
    <section className="panel" aria-labelledby="delete-heading">
      <div className="panel__head">
        <h2 id="delete-heading">Delete your account</h2>
      </div>
      <div className="panel__body">
        <p className="muted">Removes your CVs, matches, letters, mailbox connection and application history from our server. This cannot be undone.</p>

        {!open ? (
          <div>
            <Button variant="danger" onClick={() => setOpen(true)}>
              Delete my account…
            </Button>
          </div>
        ) : (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              remove.mutate();
            }}
          >
            <Alert kind="warn" title="This is permanent">
              Anything waiting to be sent will not be sent.
            </Alert>
            {remove.isError && <Alert kind="bad">{messageOf(remove.error)}</Alert>}
            <PasswordField label="Confirm with your password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <label className="check">
              <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
              <span>I understand that all my data will be deleted for good.</span>
            </label>
            <div className="form-actions">
              <Button type="submit" variant="danger" busy={remove.isPending} disabled={!password || !understood}>
                Delete everything
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
