import { Briefcase, FileSearch, FileText, LogOut, Mail, Menu, PenLine, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useResumes } from "../auth/ResumeProvider";
import { useReadyToSend } from "../lib/useReadyToSend";
import { Button } from "./Button";

export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="brand">
      <img className="brand__mark" src="/logo.png" alt="" width={30} height={30} />
      AluthJob
    </Link>
  );
}

const PITCH = [
  { icon: FileSearch, text: "Reads your CV and finds the vacancies that fit you" },
  { icon: PenLine, text: "Drafts a cover letter for each one" },
  { icon: ShieldCheck, text: "Sends from your own mailbox, only after you approve" },
] as const;

/** Frame for sign-in, sign-up and the pages reached from emailed links */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth auth--split">
      <aside className="auth__aside">
        <img className="auth__watermark" src="/logo.png" alt="" aria-hidden="true" />
        <div className="auth__pitch">
          <p className="auth__tagline">Apply to more jobs. Approve every email first.</p>
          <ul className="auth__points">
            {PITCH.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={20} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth__column" id="main">
        <Brand />
        <div className="panel auth__panel">{children}</div>
        <p className="auth__assurance">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Nothing is ever sent in your name until you have read it and approved it.</span>
        </p>
      </main>
    </div>
  );
}

const NAV = [
  { to: "/", label: "Matches", icon: Briefcase, end: true },
  { to: "/applications", label: "Applications", icon: Send },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/mailbox", label: "Mailbox", icon: Mail },
] as const;

export function AppShell() {
  const { user, signOut } = useAuth();
  const { active } = useResumes();
  const ready = useReadyToSend();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // After choosing a destination on a phone the menu gets out of the way
  useEffect(() => setOpen(false), [location.pathname]);

  // In a single-page app the browser does not move focus when the page changes, so without this a keyboard or
  // screen-reader user stays on the link they pressed. Skipped on the very first render (nothing was navigated).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Opening the drawer moves focus into it; closing returns focus to the button that opened it
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) menuButton.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <div className="topbar">
        <Brand />
        <Button ref={menuButton} variant="ghost" size="sm" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="site-nav" icon={<Menu size={18} aria-hidden="true" />}>
          Menu
        </Button>
      </div>

      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className="sidebar" id="site-nav" data-open={open}>
        <div className="action-bar">
          <Brand />
          {open && (
            <Button ref={closeButton} variant="ghost" size="sm" className="action-bar__grow" onClick={() => setOpen(false)} aria-label="Close menu" icon={<X size={18} aria-hidden="true" />} />
          )}
        </div>

        <nav aria-label="Main">
          <ul className="nav">
            {NAV.map(({ to, label, icon: Icon, ...rest }) => (
              <li key={to}>
                <NavLink to={to} end={"end" in rest} className="nav__link">
                  <Icon size={18} aria-hidden="true" />
                  {label}
                  {to === "/applications" && ready.length > 0 && (
                    <span className="nav__count">
                      {ready.length}
                      <span className="visually-hidden"> ready to send</span>
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__foot">
          {active && (
            <div className="sidebar__who">
              <div className="muted small">Working with</div>
              <div className="wrap">
                <strong>{active.fullName ?? active.fileName}</strong>
              </div>
            </div>
          )}
          <ul className="nav">
            <li>
              <NavLink to="/account" className="nav__link">
                <UserRound size={18} aria-hidden="true" />
                <span className="wrap">Account</span>
              </NavLink>
            </li>
            <li>
              <button type="button" className="nav__link nav__button" onClick={() => void signOut()}>
                <LogOut size={18} aria-hidden="true" />
                Sign out
              </button>
            </li>
          </ul>
          <div className="muted small wrap" style={{ padding: "0 var(--s-2)" }}>
            {user?.email}
          </div>
        </div>
      </aside>

      <main className="main" id="main" tabIndex={-1}>
        <div className="main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
