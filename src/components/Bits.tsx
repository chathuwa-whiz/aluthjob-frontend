import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { SCORE_LABEL, scoreTier } from "../lib/format";

export function PageHead({ title, children, actions }: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head__text">
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, actions, center }: { icon?: ReactNode; title: string; children?: ReactNode; actions?: ReactNode; center?: boolean }) {
  return (
    <div className={cx("empty", center && "empty--center")}>
      {icon && <div className="empty__icon">{icon}</div>}
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {actions && <div className="action-bar">{actions}</div>}
    </div>
  );
}

export function Skeleton({ height = "1rem", width = "100%" }: { height?: string; width?: string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

/** Placeholder rows shaped like the list they stand in for, so the page does not jump when data arrives. */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <ul className="rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="match-row">
          <div className="skeleton" style={{ width: "2.75rem", height: "2.75rem" }} aria-hidden="true" />
          <div className="match-row__main">
            <Skeleton height="1.1rem" width="60%" />
            <Skeleton width="40%" />
            <Skeleton width="75%" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The match score with its plain-words meaning for screen readers; the number alone says nothing to them. */
export function Score({ value }: { value: number }) {
  const tier = scoreTier(value);
  return (
    <span className={cx("score", tier === "strong" && "score--strong", tier === "good" && "score--good")}>
      <span aria-hidden="true">{value}</span>
      <span className="visually-hidden">
        {SCORE_LABEL[tier]}, {value} out of 100
      </span>
    </span>
  );
}
