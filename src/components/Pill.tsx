import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export function Pill({ kind, children, title }: { kind?: "ok" | "warn" | "bad" | "primary"; children: ReactNode; title?: string }) {
  return (
    <span className={cx("pill", kind && `pill--${kind}`)} title={title}>
      {children}
    </span>
  );
}
