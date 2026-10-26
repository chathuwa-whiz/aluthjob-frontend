import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { messageOf } from "../api/client";
import { alerts, auth } from "../api/endpoints";
import { keys, useAlertPreferences } from "../api/queries";
import type { AlertFrequency } from "../api/types";
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

        <EmailAlerts />
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

const FREQUENCIES: { value: AlertFrequency; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "At most one email a day, and only when there is a new match." },
  { value: "weekly", label: "Weekly", hint: "One email a week with your best new matches." },
  { value: "off", label: "Never", hint: "No job emails. Account emails (confirm, reset password) still arrive." },
];

const STRENGTHS = [
  { value: 55, label: "Good matches and better" },
  { value: 65, label: "Strong matches only" },
  { value: 75, label: "Excellent matches only" },
];

function EmailAlerts() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: prefs, isPending, isError, error } = useAlertPreferences();

  // The link "Change what I receive" in an alert email lands here
  useEffect(() => {
    if (prefs && window.location.hash === "#alerts") document.getElementById("alerts")?.scrollIntoView({ block: "start" });
  }, [prefs]);

  const save = useMutation({
    mutationFn: alerts.savePreferences,
    onSuccess: (saved) => {
      queryClient.setQueryData(keys.alertPreferences, saved);
      toast("Saved");
    },
  });

  const pausedUntil = prefs?.pausedUntil && prefs.pausedUntil > new Date().toISOString() ? prefs.pausedUntil : null;

  return (
    <section className="panel" id="alerts" aria-labelledby="alerts-heading">
      <div className="panel__head">
        <h2 id="alerts-heading">Email updates about new jobs</h2>
      </div>
      <div className="panel__body form">
        <p className="muted">
          We email you when new vacancies match your CV, so you do not have to keep checking. One email at a time, never one per job, and nothing when there is nothing new. We never apply for you.
        </p>

        {(isError || save.isError) && <Alert kind="bad">{messageOf(save.error ?? error)}</Alert>}

        {isPending ? (
          <p className="muted">Loading…</p>
        ) : prefs ? (
          <>
            <fieldset className="form" disabled={save.isPending} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field__label">How often</legend>
              {FREQUENCIES.map(({ value, label, hint }) => (
                <label className="check" key={value}>
                  <input type="radio" name="alert-frequency" checked={prefs.frequency === value} onChange={() => save.mutate({ frequency: value })} />
                  <span>
                    <strong>{label}</strong>
                    <br />
                    <span className="muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {prefs.frequency !== "off" && (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="alert-strength">
                    Which matches
                  </label>
                  <select id="alert-strength" className="select" value={prefs.minScore} disabled={save.isPending} onChange={(event) => save.mutate({ minScore: Number(event.target.value) })}>
                    {STRENGTHS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                    {!STRENGTHS.some(({ value }) => value === prefs.minScore) && <option value={prefs.minScore}>Matches of {prefs.minScore}% and better</option>}
                  </select>
                </div>

                <div className="form-actions">
                  {pausedUntil ? (
                    <>
                      <span className="muted">Paused until {formatDate(pausedUntil)}.</span>
                      <Button onClick={() => save.mutate({ paused: false })} disabled={save.isPending}>
                        Resume now
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => save.mutate({ paused: true })} disabled={save.isPending}>
                      Pause for 7 days
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
