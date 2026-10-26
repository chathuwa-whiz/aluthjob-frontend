import { ChevronDown, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { buttonClass } from "./Button";
import { Alert } from "./Alert";
import { Tabs, panelId } from "./Tabs";

// Why steps and links instead of a GIF or video: the pages being described belong to Google and Yahoo, and they
// rearrange them often. A recording goes stale and cannot be searched, translated or read aloud; a short list with
// a button that opens the right page stays correct, and costs nothing to load.

export type Provider = "gmail" | "yahoo" | "outlook" | "other";

const TABS: { id: Provider; label: string }[] = [
  { id: "gmail", label: "Gmail" },
  { id: "yahoo", label: "Yahoo" },
  { id: "outlook", label: "Outlook" },
  { id: "other", label: "Other" },
];

/** The provider an address belongs to, or undefined when there is nothing to go on yet. */
export function providerOf(domain: string): Provider | undefined {
  if (domain === "gmail.com" || domain === "googlemail.com") return "gmail";
  if (domain === "yahoo.com" || domain === "ymail.com") return "yahoo";
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return "outlook";
  return domain.includes(".") ? "other" : undefined;
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={buttonClass("secondary", "sm")} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink size={14} aria-hidden="true" />
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="guide__steps">{children}</ol>;
}

function Step({ n, title, children }: { n: number; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="step">
      <span className="step__mark" aria-hidden="true">
        {n}
      </span>
      <div className="stack" style={{ gap: "var(--s-2)" }}>
        <span className="step__title">{title}</span>
        {children}
      </div>
    </li>
  );
}

function Gmail() {
  return (
    <>
      <p className="muted small">Google does not let other apps use your normal password. You make a separate 16-letter one that can only send mail.</p>
      <Steps>
        <Step n={1} title="Turn on 2-Step Verification, if it is not on yet">
          <div>
            <LinkButton href="https://myaccount.google.com/signinoptions/twosv">Open 2-Step Verification</LinkButton>
          </div>
        </Step>
        <Step n={2} title="Open the app passwords page">
          <div>
            <LinkButton href="https://myaccount.google.com/apppasswords">Open app passwords</LinkButton>
          </div>
          <p className="muted small">Google may ask for your password once more.</p>
        </Step>
        <Step n={3} title={<>Type a name, for example "AluthJob", then press Create</>} />
        <Step n={4} title="Copy the 16 letters Google shows and paste them into the App password box">
          <p className="muted small">Google shows them only once. Spaces do not matter.</p>
          <p className="guide__example">
            <code className="guide__code">abcd efgh ijkl mnop</code>
            <span className="muted small">An example of what it looks like</span>
          </p>
        </Step>
      </Steps>
      <p className="guide__note small">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>It is not your Google password. You can delete it any time on the same page, and Google removes it if you change your Google password.</span>
      </p>
      <details className="guide__more small">
        <summary>I cannot see the app passwords option</summary>
        <ul>
          <li>2-Step Verification has to be on first (step 1).</li>
          <li>Work and school accounts may be blocked by an administrator.</li>
          <li>Accounts that use only a security key, or Google's Advanced Protection, may not get app passwords.</li>
        </ul>
      </details>
    </>
  );
}

function Yahoo() {
  return (
    <>
      <p className="muted small">Yahoo needs a separate password for apps like this one. It can only be used to send mail.</p>
      <Steps>
        <Step n={1} title="Open your Yahoo account security page">
          <div>
            <LinkButton href="https://login.yahoo.com/account/security">Open Yahoo security</LinkButton>
          </div>
        </Step>
        <Step n={2} title={<>Choose "Create app password" (also called "Generate app password")</>} />
        <Step n={3} title={<>Type a name, for example "AluthJob", then press Create</>} />
        <Step n={4} title="Copy the password Yahoo shows and paste it into the Password box">
          <p className="muted small">Yahoo shows it once. If you lose it, make a new one.</p>
        </Step>
      </Steps>
      <p className="muted small">If you do not see the option, sign in from a browser you use often, not a private window.</p>
    </>
  );
}

function Outlook() {
  return (
    <>
      <Alert kind="warn" title="Outlook and Hotmail may not work">
        Microsoft has been switching off password sign-in for mail apps on personal Outlook, Hotmail and Live accounts, so an app password may be refused.
      </Alert>
      <p className="small">
        The simplest fix is to connect a <strong>Gmail</strong> or <strong>Yahoo</strong> address instead. Employers only see the address you send from. If you do have an app password for your Microsoft account, you can still try it below.
      </p>
      <p className="muted small">On a Microsoft 365 work or school account, ask your administrator to allow SMTP sign-in for your mailbox.</p>
    </>
  );
}

function Other() {
  return (
    <>
      <p className="small">Look in your email provider's security settings for "app password", "application-specific password" or "SMTP password", and create one named AluthJob.</p>
      <p className="muted small">Then enter the password below with your provider's mail server (SMTP). Your provider's help page lists the server name and port.</p>
    </>
  );
}

const BODY: Record<Provider, () => ReactNode> = { gmail: Gmail, yahoo: Yahoo, outlook: Outlook, other: Other };

/**
 * A short, closed-by-default walkthrough for getting an app password. It follows the address being typed
 * (`domain`) until the person picks a provider themselves.
 */
export function AppPasswordGuide({ domain = "", defaultOpen = false }: { domain?: string; defaultOpen?: boolean }) {
  const detected = providerOf(domain);
  const [picked, setPicked] = useState<Provider | null>(null);
  const provider = picked ?? detected ?? "gmail";

  // typing a different address hands the choice back to the address
  useEffect(() => setPicked(null), [detected]);

  const Body = BODY[provider];

  return (
    <details className="guide" open={defaultOpen || undefined}>
      <summary>
        <KeyRound size={16} aria-hidden="true" />
        <span>How do I get an app password?</span>
        <ChevronDown size={16} aria-hidden="true" className="guide__chevron" />
      </summary>

      <div className="guide__body">
        <Tabs label="Email provider" tabs={TABS} value={provider} onChange={setPicked} />
        <div role="tabpanel" id={panelId(provider)} aria-labelledby={`tab-${provider}`} className="guide__panel">
          <Body />
        </div>
      </div>
    </details>
  );
}
