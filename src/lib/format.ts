import type { Application, ApplicationStatus, JobSource, MatchStatus } from "../api/types";

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const formatDate = (iso: string | null | undefined) => (iso ? date.format(new Date(iso)) : "");
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : "");

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "2 days ago", "in 3 hours", "just now" */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";

  const diff = new Date(iso).getTime() - now;
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return relative.format(Math.round(diff / size), unit);
  }
  return "just now";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "m:ss" for the running timers shown during long operations */
export function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export type ScoreTier = "strong" | "good" | "possible";

export function scoreTier(score: number): ScoreTier {
  return score >= 65 ? "strong" : score >= 50 ? "good" : "possible";
}

export const SCORE_LABEL: Record<ScoreTier, string> = {
  strong: "Strong match",
  good: "Good match",
  possible: "Possible match",
};

export const SOURCE_LABEL: Record<JobSource, string> = {
  topjobs: "TopJobs",
  observerjobs: "Observer Jobs",
  jobpal: "Jobpal",
  governmentjobs: "Government Jobs",
  rooster: "Rooster",
  dreamjobs: "DreamJobs",
  ikman: "ikman.lk",
  xpress: "Xpress Jobs",
};

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  suggested: "To review",
  approved: "Approved",
  rejected: "Skipped",
};

/**
 * The one status shown for a match. Once an application exists it tells the real story ("Sent"), because
 * "Approved" only means the person approved the letter.
 */
export function matchBadge(status: MatchStatus, application?: Pick<Application, "status"> | null): { label: string; kind: "ok" | "bad" | "primary" | undefined } {
  switch (application?.status) {
    case "sent":
      return { label: "Sent", kind: "ok" };
    case "queued":
    case "sending":
      return { label: APPLICATION_STATUS_LABEL[application.status], kind: "primary" };
    case "failed":
      return { label: "Send failed", kind: "bad" };
  }
  return { label: MATCH_STATUS_LABEL[status], kind: status === "approved" ? "ok" : status === "rejected" ? undefined : "primary" };
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  queued: "Waiting to send",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** The five parts of a match score, in plain words */
export const BREAKDOWN_LABEL = {
  skills: "Skills",
  title: "Job title",
  content: "Wording of the advert",
  experience: "Experience",
  location: "Location",
} as const;
