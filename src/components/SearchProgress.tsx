import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { RunProgress } from "../api/types";
import { SOURCE_LABEL } from "../lib/format";
import { finishedSites, searchFraction, searchSteps } from "../lib/progress";
import { Fact, TaskProgress } from "./TaskProgress";

const nameOf = (source: string) => SOURCE_LABEL[source as keyof typeof SOURCE_LABEL] ?? source;
const count = (value: number) => value.toLocaleString();

function headline(run: RunProgress): string {
  switch (run.phase) {
    case "collecting":
      return `Reading the job sites: ${finishedSites(run)} of ${run.sites.length} finished`;
    case "ranking":
      return "Comparing your CV with every saved vacancy";
    case "reading":
      return `Reading the full advert ${Math.min(run.adverts.done + 1, run.adverts.total)} of ${run.adverts.total}`;
    case "drafting":
      return `Writing cover letter ${Math.min(run.letters.done + 1, run.letters.total)} of ${run.letters.total}`;
    default:
      return "Getting started";
  }
}

/** What a running job search is doing, read from the server a second at a time. */
export function SearchProgress({ run, receivedAt }: { run: RunProgress; receivedAt: number }) {
  const advert = run.phase === "drafting" ? run.letters : run.adverts;
  const now = advert.current;
  const recent = run.activity.slice(-4).reverse();

  return (
    <TaskProgress
      title="Searching jobs for you"
      headline={headline(run)}
      steps={searchSteps(run)}
      fraction={searchFraction(run)}
      elapsedMs={run.elapsedMs}
      receivedAt={receivedAt}
      running={run.status === "running"}
    >
      {run.sites.length > 0 && (
        <ul className="sites" aria-label="Job sites">
          {run.sites.map((site) => (
            <li key={site.source} className={`site site--${site.state}`}>
              {site.state === "done" ? (
                <Check size={14} aria-hidden="true" />
              ) : site.state === "failed" ? (
                <AlertTriangle size={14} aria-hidden="true" />
              ) : (
                <Loader2 size={14} className="spin" aria-hidden="true" />
              )}
              <span className="site__name">{nameOf(site.source)}</span>
              <span className="site__count">
                {site.state === "failed" ? "Could not be read" : `${count(site.fetched)} ${site.fetched === 1 ? "vacancy" : "vacancies"}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {now && (
        <div className="now">
          <span className="now__label">{run.phase === "drafting" ? "Writing a letter for" : "Reading now"}</span>
          <strong className="wrap now__title">{now.title}</strong>
          <span className="muted small wrap">{[now.company, nameOf(now.source)].filter(Boolean).join(" · ")}</span>
        </div>
      )}

      <dl className="facts">
        {run.considered !== null && <Fact label="Vacancies compared">{count(run.considered)}</Fact>}
        {run.matched !== null && <Fact label="Matches kept">{count(run.matched)}</Fact>}
        {run.adverts.total > 0 && <Fact label="Adverts read">{`${run.adverts.done} of ${run.adverts.total}`}</Fact>}
        {run.sites.length > 0 && <Fact label="Vacancies collected">{count(run.sites.reduce((sum, site) => sum + site.fetched, 0))}</Fact>}
      </dl>

      {recent.length > 0 && (
        <ul className="activity" aria-label="Latest activity">
          {recent.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>{entry.text}</li>
          ))}
        </ul>
      )}

      <p className="muted small">You can leave this page; the search keeps running and you will find it here when you come back.</p>
    </TaskProgress>
  );
}
