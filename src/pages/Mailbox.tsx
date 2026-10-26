import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { messageOf } from "../api/client";
import { candidates } from "../api/endpoints";
import { keys, useMailbox } from "../api/queries";
import type { MailAccount } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { useResumes } from "../auth/ResumeProvider";
import { Alert } from "../components/Alert";
import { AppPasswordGuide } from "../components/AppPasswordGuide";
import { EmptyState, PageHead, Skeleton } from "../components/Bits";
import { Button, buttonClass } from "../components/Button";
import { PasswordField, TextField } from "../components/Field";
import { useToast } from "../components/Toast";
import { formatDate } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

// Providers the server knows the settings of; anyone else enters their mail server by hand
const KNOWN_DOMAINS = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "zoho.com"];

const domainOf = (email: string) => email.split("@")[1]?.trim().toLowerCase() ?? "";

/** Google prints an app password as four groups of four letters; the spaces are only for reading. */
const tidyAppPassword = (value: string) => (/^[a-z]{4}( [a-z]{4}){3}$/i.test(value.trim()) ? value.replace(/\s+/g, "") : value);

function providerHelp(domain: string): string {
  if (domain === "gmail.com" || domain === "googlemail.com") return "Paste the 16-letter app password from the steps above. It is not your normal Gmail password.";
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) {
    return "Microsoft may refuse app passwords on personal accounts. If the login fails, connect a Gmail or Yahoo address instead.";
  }
  if (domain === "yahoo.com") return "Paste the app password from the steps above. It is not your normal Yahoo password.";
  return "Use the password you sign in to this email account with. If your provider offers app passwords, an app password is safer.";
}

export function MailboxPage() {
  usePageTitle("Mailbox");
  const { active } = useResumes();
  const mailbox = useMailbox(active?.id);
  const [editing, setEditing] = useState(false);

  if (!active) {
    return (
      <>
        <PageHead title="Mailbox" />
        <div className="panel">
          <EmptyState icon={<Mail size={22} aria-hidden="true" />} title="Upload your CV first" actions={<Link className={buttonClass("primary")} to="/resume">Upload your CV</Link>}>
            Your mailbox is connected to a CV, because each CV sends its own applications.
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Mailbox">Applications are sent from your own email address, so employers reply straight to you and the message sits in your Sent folder.</PageHead>

      {mailbox.isPending && <Skeleton height="8rem" />}
      {mailbox.isError && <Alert kind="bad" title="We could not check your mailbox">{messageOf(mailbox.error)}</Alert>}

      {mailbox.data && !editing && <Connected candidateId={active.id} account={mailbox.data} onChange={() => setEditing(true)} />}

      {(mailbox.data === null || editing) && (
        <ConnectForm candidateId={active.id} existing={mailbox.data ?? null} defaultName={active.fullName} onDone={() => setEditing(false)} onCancel={mailbox.data ? () => setEditing(false) : undefined} />
      )}

      <section className="well" aria-labelledby="safety-heading">
        <h2 id="safety-heading" className="small" style={{ marginBottom: "var(--s-2)" }}>
          <Lock size={14} aria-hidden="true" style={{ display: "inline", marginRight: 6 }} />
          How your password is handled
        </h2>
        <p className="small muted">
          We check the login before saving it, store it encrypted, and use it only to send applications you have approved. Nothing is sent to anyone you did not choose. Disconnect at any time to delete it.
        </p>
      </section>
    </>
  );
}

function Connected({ candidateId, account, onChange }: { candidateId: number; account: MailAccount; onChange: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const disconnect = useMutation({
    mutationFn: () => candidates.disconnectMailbox(candidateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.mailbox(candidateId) });
      toast("Mailbox disconnected");
    },
  });

  return (
    <section className="panel" aria-labelledby="connected-heading">
      <div className="panel__head">
        <h2 id="connected-heading">
          <CheckCircle2 size={18} aria-hidden="true" style={{ display: "inline", marginRight: 8, color: "var(--ok-solid)" }} />
          Connected
        </h2>
        <div className="action-bar">
          <Button size="sm" onClick={onChange}>
            Change
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
            Disconnect
          </Button>
        </div>
      </div>
      <div className="panel__body">
        <dl className="meta-list">
          <dt>Sends from</dt>
          <dd>
            {account.fromName ? `${account.fromName} ` : ""}&lt;{account.email}&gt;
          </dd>
          <dt>Mail server</dt>
          <dd>
            {account.host}:{account.port}
          </dd>
          <dt>Checked</dt>
          <dd>{formatDate(account.verifiedAt)}</dd>
        </dl>

        {confirming && (
          <Alert
            kind="warn"
            title="Disconnect this mailbox?"
            actions={
              <>
                <Button size="sm" variant="danger" busy={disconnect.isPending} onClick={() => disconnect.mutate()}>
                  Yes, disconnect
                </Button>
                <Button size="sm" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </>
            }
          >
            Applications waiting to be sent will be cancelled until you connect a mailbox again.
          </Alert>
        )}
        {disconnect.isError && <Alert kind="bad">{messageOf(disconnect.error)}</Alert>}
      </div>
    </section>
  );
}

function ConnectForm({ candidateId, existing, defaultName, onDone, onCancel }: { candidateId: number; existing: MailAccount | null; defaultName: string | null; onDone: () => void; onCancel?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [email, setEmail] = useState(existing?.email ?? user?.email ?? "");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState(existing?.fromName ?? defaultName ?? "");
  const [host, setHost] = useState(existing?.host ?? "");
  const [port, setPort] = useState(String(existing?.port ?? 587));
  const [secure, setSecure] = useState(existing?.secure ?? false);
  const [customServer, setCustomServer] = useState(false);

  const domain = domainOf(email);
  const needsServer = Boolean(domain) && !KNOWN_DOMAINS.includes(domain);
  const showServer = needsServer || customServer;

  const connect = useMutation({
    mutationFn: () =>
      candidates.connectMailbox(candidateId, {
        email: email.trim(),
        password: tidyAppPassword(password),
        ...(fromName.trim() && { fromName: fromName.trim() }),
        ...(showServer && { host: host.trim(), port: Number(port) || 587, secure }),
      }),
    onSuccess: async () => {
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: keys.mailbox(candidateId) });
      toast("Mailbox connected");
      onDone();
    },
  });

  return (
    <section className="panel" aria-labelledby="connect-heading">
      <div className="panel__head">
        <h2 id="connect-heading">{existing ? "Change mailbox" : "Connect your mailbox"}</h2>
      </div>
      <form
        className="panel__body form"
        onSubmit={(event) => {
          event.preventDefault();
          connect.mutate();
        }}
        noValidate
      >
        {connect.isError && (
          <Alert kind="bad" title="We could not log in to that mailbox">
            {messageOf(connect.error)}
          </Alert>
        )}

        <TextField label="Email address" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <AppPasswordGuide domain={domain} defaultOpen={!existing} />
        <PasswordField label={domain === "gmail.com" || domain === "googlemail.com" ? "App password" : "Password"} autoComplete="off" required value={password} onChange={(event) => setPassword(event.target.value)} hint={providerHelp(domain)} />
        <TextField label="Name shown to employers" optional value={fromName} onChange={(event) => setFromName(event.target.value)} hint="Appears as the sender's name, for example your full name." />

        {!needsServer && (
          <label className="check">
            <input type="checkbox" checked={customServer} onChange={(event) => setCustomServer(event.target.checked)} />
            <span>My provider needs different server settings</span>
          </label>
        )}

        {showServer && (
          <fieldset className="form" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field__label" style={{ marginBottom: "var(--s-2)" }}>
              Mail server (SMTP)
            </legend>
            {needsServer && <p className="muted small">We do not know the settings for {domain}. Your provider lists them as the "SMTP" or "outgoing mail" server.</p>}
            <div className="form-row">
              <TextField label="Server" placeholder="smtp.example.com" required value={host} onChange={(event) => setHost(event.target.value)} autoComplete="off" />
              <TextField label="Port" inputMode="numeric" required value={port} onChange={(event) => setPort(event.target.value)} />
            </div>
            <label className="check">
              <input type="checkbox" checked={secure} onChange={(event) => { setSecure(event.target.checked); if (event.target.checked && port === "587") setPort("465"); }} />
              <span>Use a secure connection from the start (usually port 465). Leave off for port 587.</span>
            </label>
          </fieldset>
        )}

        <div className="form-actions">
          <Button type="submit" variant="primary" busy={connect.isPending} disabled={!email || !password || (showServer && !host)}>
            Check login and connect
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
