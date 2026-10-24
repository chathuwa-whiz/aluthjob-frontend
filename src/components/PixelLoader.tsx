import type { CSSProperties } from "react";

const COLUMNS = 5;
const ROWS = 3;

/**
 * A small grid of squares that light up in a travelling wave. It says "working" without a spinner's
 * dizziness, and the wave keeps moving, so the person can see the page has not frozen. Decorative:
 * the words next to it carry the meaning. With reduced motion it is a still, half-lit grid.
 */
export function PixelLoader({ label }: { label?: string }) {
  return (
    <span className="pixels" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {Array.from({ length: COLUMNS * ROWS }, (_, index) => {
        const column = index % COLUMNS;
        const row = Math.floor(index / COLUMNS);
        // the wave runs along the columns, with a small stagger per row so it reads as a pattern, not a bar
        const delay = column * 120 + row * 60;
        return <span key={index} className="pixels__cell" style={{ "--d": `${delay}ms` } as CSSProperties} />;
      })}
    </span>
  );
}
