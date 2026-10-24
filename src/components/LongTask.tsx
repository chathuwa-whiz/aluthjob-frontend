import { useEffect, useState, type ReactNode } from "react";
import { formatElapsed } from "../lib/format";

/**
 * Shown while something slow runs (reading a CV, searching adverts, writing a letter). These take from
 * half a minute to a few minutes on a small local model, so the person gets a running clock and an honest
 * explanation instead of a spinner they might mistake for a hang.
 */
export function LongTask({ title, children }: { title: string; children: ReactNode }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="well run-banner" role="status" aria-live="polite">
      <div className="progress" aria-hidden="true" />
      <div className="action-bar">
        <strong>{title}</strong>
        <span className="muted small nowrap" aria-label={`${seconds} seconds elapsed`}>
          {formatElapsed(seconds)}
        </span>
      </div>
      <p className="muted small">{children}</p>
    </div>
  );
}
