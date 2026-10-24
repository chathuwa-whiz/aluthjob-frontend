import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export type AlertKind = "info" | "ok" | "warn" | "bad";

const ICON = { info: Info, ok: CheckCircle2, warn: AlertTriangle, bad: AlertCircle } as const;

interface Props {
  kind?: AlertKind;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Errors are announced to screen readers immediately; everything else politely. */
export function Alert({ kind = "info", title, children, actions, className }: Props) {
  const Icon = ICON[kind];

  return (
    <div role={kind === "bad" ? "alert" : "status"} className={cx("alert", `alert--${kind}`, className)}>
      <Icon size={18} aria-hidden="true" />
      <div className="alert__body">
        {title && <p className="alert__title">{title}</p>}
        {children && <div>{children}</div>}
        {actions && <div className="alert__actions">{actions}</div>}
      </div>
    </div>
  );
}
