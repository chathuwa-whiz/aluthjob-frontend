import { useEffect, useState } from "react";
import { formatElapsed } from "../lib/format";

/**
 * A running clock that starts from the server's own measurement of how long the work has taken, so it
 * is right after a reload or in a second tab, and needs no agreement between the two clocks. Between
 * updates it keeps counting by itself; once the work ends it stops.
 */
export function Elapsed({ elapsedMs, receivedAt, running }: { elapsedMs: number; receivedAt: number; running: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  const total = running ? elapsedMs + Math.max(0, now - receivedAt) : elapsedMs;
  const seconds = Math.floor(total / 1000);

  return (
    <time className="elapsed" aria-label={`${seconds} seconds elapsed`}>
      {formatElapsed(seconds)}
    </time>
  );
}
