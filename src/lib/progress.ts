import type { AnalysisProgress, RunProgress } from "../api/types";
import type { TaskStep } from "../components/TaskProgress";

// ---- a job search ----

const SEARCH_ORDER = ["collecting", "ranking", "reading", "drafting"] as const;

const searchStage = (run: RunProgress) => (run.status === "done" ? SEARCH_ORDER.length : Math.max(SEARCH_ORDER.indexOf(run.phase as (typeof SEARCH_ORDER)[number]), 0));

/** Job sites that have finished, one way or the other. */
export const finishedSites = (run: RunProgress) => run.sites.filter((site) => site.state !== "reading").length;

export function searchSteps(run: RunProgress): TaskStep[] {
  const stage = searchStage(run);
  const state = (index: number): TaskStep["state"] => (index < stage ? "done" : index === stage ? "current" : "pending");

  // Fresh vacancies are only collected when the saved ones are missing or old, and letters only when asked for
  const wantsCollecting = run.sites.length > 0 || run.phase === "collecting";
  const wantsReading = run.adverts.total > 0 || run.status === "running";
  const wantsLetters = run.letters.total > 0 || run.phase === "drafting";

  return [
    wantsCollecting && { id: "collecting", label: "Collect new vacancies", state: state(0) },
    { id: "ranking", label: "Compare with your CV", state: state(1) },
    wantsReading && { id: "reading", label: "Read the best adverts", state: state(2) },
    wantsLetters && { id: "drafting", label: "Write cover letters", state: state(3) },
  ].filter((step): step is TaskStep => Boolean(step));
}

/** How far along the whole search is, 0 to 1. Collecting, comparing and reading carry the weight they usually take. */
export function searchFraction(run: RunProgress): number {
  if (run.status === "done") return 1;

  const collecting = run.sites.length > 0 || run.phase === "collecting";
  const shares = { collecting: collecting ? 0.4 : 0, ranking: 0.05, reading: collecting ? 0.55 : 0.95 };
  const ratio = (done: number, total: number) => (total > 0 ? Math.min(done / total, 1) : 0);

  switch (run.phase) {
    case "starting":
      return 0;
    case "collecting":
      return shares.collecting * ratio(finishedSites(run), run.sites.length);
    case "ranking":
      return shares.collecting + shares.ranking * 0.5;
    case "reading":
    case "drafting":
      return shares.collecting + shares.ranking + shares.reading * ratio(run.phase === "reading" ? run.adverts.done : run.adverts.total, run.adverts.total);
    default:
      return 0;
  }
}

// ---- reading a CV ----

const ANALYSIS_ORDER = ["sending", "reading", "understanding", "saving"] as const;

/** `uploading` is the moment before the server has answered: the file is still travelling. */
export function analysisStage(analysis: AnalysisProgress | null): number {
  if (!analysis) return 0;
  if (analysis.status === "done") return ANALYSIS_ORDER.length;
  return Math.max(ANALYSIS_ORDER.indexOf(analysis.phase as (typeof ANALYSIS_ORDER)[number]), 1);
}

export function analysisSteps(analysis: AnalysisProgress | null): TaskStep[] {
  const stage = analysisStage(analysis);
  const state = (index: number): TaskStep["state"] => (index < stage ? "done" : index === stage ? "current" : "pending");

  return [
    { id: "sending", label: "Receive your file", state: state(0) },
    { id: "reading", label: "Read the text", state: state(1) },
    { id: "understanding", label: analysis?.reused ? "Recognise this CV" : "Understand your experience", state: state(2) },
    { id: "saving", label: "Save your profile", state: state(3) },
  ];
}

export function analysisFraction(analysis: AnalysisProgress | null): number {
  if (!analysis) return 0.02;
  if (analysis.status === "done") return 1;

  switch (analysis.phase) {
    case "reading":
      return 0.1;
    case "understanding":
      // the model's share is estimated from how much it has written; it never reaches the end before the end
      return analysis.reused ? 0.9 : 0.15 + 0.75 * analysis.writing;
    case "saving":
      return 0.95;
    default:
      return 0;
  }
}
