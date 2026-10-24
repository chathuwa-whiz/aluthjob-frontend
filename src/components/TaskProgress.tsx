import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { Elapsed } from "./Elapsed";
import { PixelLoader } from "./PixelLoader";

export interface TaskStep {
  id: string;
  label: string;
  state: "done" | "current" | "pending";
}

interface Props {
  title: string;
  /** One line saying what is happening right now. */
  headline: ReactNode;
  steps: TaskStep[];
  /** 0 to 1, or null when how far along it is cannot be known. */
  fraction: number | null;
  elapsedMs: number;
  receivedAt: number;
  running?: boolean;
  /** Details of the step in progress: sites, the advert being read, counts. */
  children?: ReactNode;
}

/**
 * The frame shared by every long task: what is being done, how long it has taken, which of the steps
 * is under way, and room for the particulars of that step. Screen readers hear only the title and the
 * current step (when it changes), not every counter ticking over.
 */
export function TaskProgress({ title, headline, steps, fraction, elapsedMs, receivedAt, running = true, children }: Props) {
  const current = steps.find((step) => step.state === "current");
  const percent = fraction === null ? null : Math.round(Math.min(Math.max(fraction, 0), 1) * 100);

  return (
    <section className="well task" aria-label={title}>
      <div className="task__head">
        <PixelLoader />
        <div className="task__title">
          <h2>{title}</h2>
          <p className="task__now">{headline}</p>
        </div>
        <Elapsed elapsedMs={elapsedMs} receivedAt={receivedAt} running={running} />
      </div>

      {percent === null ? (
        <div className="progress" aria-hidden="true" />
      ) : (
        <div className="bar" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="bar__fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      <ol className="track">
        {steps.map((step) => (
          <li key={step.id} className={cx("track__step", `track__step--${step.state}`)} aria-current={step.state === "current" ? "step" : undefined}>
            <span className="track__mark" aria-hidden="true">
              {step.state === "done" ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      {children && <div className="task__body">{children}</div>}

      <p className="visually-hidden" role="status" aria-live="polite">
        {title}
        {current ? `: ${current.label}` : ""}
      </p>
    </section>
  );
}

/** A labelled figure in the details area: "Vacancies compared  1,424". */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
