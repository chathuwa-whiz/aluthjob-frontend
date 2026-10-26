// Shapes returned by the API (server/src). Kept in one file so a change on the server shows up here first.

export interface User {
  id: number;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  emailVerified: boolean;
}

export interface Profile {
  personalInfo: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    portfolio: string | null;
  };
  skills: string[];
  education: { institution: string | null; degree: string | null; field: string | null; startDate: string | null; endDate: string | null }[];
  experience: {
    company: string | null;
    position: string | null;
    startDate: string | null;
    endDate: string | null;
    responsibilities: string[];
  }[];
  certifications: string[];
  achievements: { description: string }[];
}

export interface CandidateSummary {
  id: number;
  fileName: string;
  fullName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: number;
  fileName: string;
  mimeType: string;
  profile: Profile;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResult {
  candidateId: number;
  profile: Profile;
  metadata: { fileName: string; extractedCharacters: number; processedAt: string };
}

export type JobSource = "topjobs" | "observerjobs" | "jobpal" | "governmentjobs" | "rooster" | "dreamjobs" | "ikman" | "xpress";

export interface Job {
  id: number;
  source: JobSource;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  jobType: string | null;
  salary: string | null;
  category: string | null;
  postedAt: string | null;
  closingAt: string | null;
  applyEmail: string | null;
  applyEmailSource: "page" | "image" | null;
  applyUrl: string | null;
}

export type MatchStatus = "suggested" | "approved" | "rejected";

export interface Match {
  id: number;
  candidateId: number;
  jobId: number;
  score: number;
  details: {
    breakdown: { skills: number; title: number; content: number; experience: number; location: number };
    matchedSkills: string[];
    reasons: string[];
    warnings: string[];
  };
  status: MatchStatus;
  subject: string | null;
  coverLetter: string | null;
  draftedAt: string | null;
  decidedAt: string | null;
  confirmedEmail: string | null;
  createdAt: string;
  updatedAt: string;
  /** "email": the advert gives an address we can send to. "portal": apply on the employer's own site. */
  applyMethod: "email" | "portal";
  job: Job;
}

export interface MatchRunSummary {
  considered: number;
  matched: number;
  enriched: number;
  drafted: number;
  topScore: number | null;
  /** Vacancies collected from the job sites as part of this search (only on a first search, when there were none). */
  collected: number;
  /** Job sites that could not be read during that collection. */
  sourcesFailed: number;
}

export interface SiteProgress {
  source: JobSource;
  state: "reading" | "done" | "failed";
  /** Vacancies found so far (while reading) or in total (when done). */
  fetched: number;
  error?: string;
}

export interface RunJobRef {
  title: string;
  company: string | null;
  source: string;
}

export interface RunStep {
  done: number;
  total: number;
  current: RunJobRef | null;
}

export type RunPhase = "starting" | "collecting" | "ranking" | "reading" | "drafting" | "done" | "failed";

/** One job search, as the server reports it while it runs. */
export interface RunProgress {
  candidateId: number;
  status: "running" | "done" | "failed";
  phase: RunPhase;
  startedAt: string;
  elapsedMs: number;
  sites: SiteProgress[];
  considered: number | null;
  adverts: RunStep;
  letters: RunStep;
  matched: number | null;
  topScore: number | null;
  activity: { at: string; text: string }[];
  summary: MatchRunSummary | null;
  error: string | null;
}

export type AnalysisPhase = "reading" | "understanding" | "saving" | "done" | "failed";

/** One CV being read, as the server reports it while it works. */
export interface AnalysisProgress {
  status: "running" | "done" | "failed";
  phase: AnalysisPhase;
  fileName: string;
  startedAt: string;
  elapsedMs: number;
  characters: number | null;
  links: number | null;
  skills: number | null;
  reused: boolean;
  /** 0 to 1, estimated from how much the model has written. */
  writing: number;
  result: UploadResult | null;
  error: string | null;
}

export interface EmailPreview {
  message: {
    from: string;
    to: string;
    subject: string;
    body: string;
    attachment: { fileName: string; bytes: number };
    addressSource: "page" | "image";
    verifyAt: string | null;
    addressConfirmed: boolean;
  };
  problems: string[];
}

export interface MailAccount {
  candidateId: number;
  email: string;
  fromName: string | null;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  verifiedAt: string;
}

export type ApplicationStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

export interface Application {
  id: number;
  matchId: number;
  candidateId: number;
  toEmail: string;
  status: ApplicationStatus;
  attempts: number;
  nextAttemptAt: string;
  error: string | null;
  messageId: string | null;
  sentSubject: string | null;
  sentBody: string | null;
  queuedAt: string;
  sentAt: string | null;
  updatedAt: string;
}

export interface QueueResult {
  queued: Application[];
  skipped: { matchId: number; title: string; reason: string }[];
}

export interface MailboxInput {
  email: string;
  password: string;
  fromName?: string;
  host?: string;
  port?: number;
  secure?: boolean;
}

// ---- job-alert emails ----

export type AlertFrequency = "daily" | "weekly" | "off";

export interface AlertPreferences {
  frequency: AlertFrequency;
  /** Only matches scoring at least this are announced by email. */
  minScore: number;
  pausedUntil: string | null;
  lastSentAt: string | null;
}

export type AlertAction = "hide" | "off" | "pause" | "daily" | "weekly";

/** What a button in an alert email will do, shown before anything changes. */
export interface AlertActionPreview {
  action: AlertAction;
  summary: string;
  confirmLabel: string;
  jobTitle: string | null;
}

export interface AlertActionResult {
  action: AlertAction;
  message: string;
}
