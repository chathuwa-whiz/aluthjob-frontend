import { del, get, patch, post, put, request } from "./client";
import type {
  AlertActionPreview,
  AlertActionResult,
  AlertFrequency,
  AlertPreferences,
  Application,
  Candidate,
  CandidateSummary,
  EmailPreview,
  MailAccount,
  MailboxInput,
  Match,
  AnalysisProgress,
  RunProgress,
  MatchStatus,
  Profile,
  QueueResult,
  User,
} from "./types";

export const auth = {
  // a 401 here just means "nobody is signed in", so it must not trigger the expired-session handler
  me: () => get<{ user: User }>("/auth/me", { answers401: true }).then((data) => data.user),
  login: (email: string, password: string) => post<{ user: User }>("/auth/login", { email, password }, { answers401: true }),
  register: (email: string, password: string) => post<{ message: string }>("/auth/register", { email, password }, { answers401: true }),
  logout: () => post<{ signedOut: boolean }>("/auth/logout", undefined, { answers401: true }),
  verifyEmail: (token: string) => post<{ verified: boolean }>("/auth/verify-email", { token }, { answers401: true }),
  resendVerification: () => post<{ sent: boolean }>("/auth/resend-verification"),
  forgotPassword: (email: string) => post<{ message: string }>("/auth/forgot-password", { email }, { answers401: true }),
  resetPassword: (token: string, newPassword: string) =>
    post<{ reset: boolean; message: string }>("/auth/reset-password", { token, newPassword }, { answers401: true }),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ changed: boolean }>("/auth/change-password", { currentPassword, newPassword }, { answers401: true }),
  deleteAccount: (password: string) => del<{ deleted: boolean }>("/auth/account", { password }, { answers401: true }),
};

export interface MatchRunOptions {
  minScore?: number;
  limit?: number;
  enrichTop?: number;
  draftTop?: number;
}

export const candidates = {
  list: () => get<CandidateSummary[]>("/candidates"),
  get: (id: number) => get<Candidate>(`/candidates/${id}`),
  upload: (file: File) => {
    const form = new FormData();
    form.append("resume", file);
    return request<AnalysisProgress>("POST", "/resumes/analyze", { form });
  },
  analysis: () => get<AnalysisProgress | null>("/resumes/analyze"),
  saveProfile: (id: number, profile: Profile) => put<Candidate>(`/candidates/${id}/profile`, profile),
  resumeUrl: (id: number) => `/api/v1/candidates/${id}/resume`,

  /** Starts a search in the background; follow it with run(). */
  runMatching: (id: number, options: MatchRunOptions = {}) => post<RunProgress>(`/candidates/${id}/matches/run`, options),
  run: (id: number) => get<RunProgress | null>(`/candidates/${id}/matches/run`),
  matches: (id: number, status?: MatchStatus) =>
    get<Match[]>(`/candidates/${id}/matches?limit=200${status ? `&status=${status}` : ""}`),

  applications: (id: number) => get<Application[]>(`/candidates/${id}/applications`),
  queue: (id: number, matchIds?: number[]) => post<QueueResult>(`/candidates/${id}/applications/queue`, matchIds ? { matchIds } : {}),

  mailbox: (id: number) => get<MailAccount>(`/candidates/${id}/mail-account`),
  connectMailbox: (id: number, input: MailboxInput) => put<MailAccount>(`/candidates/${id}/mail-account`, input),
  disconnectMailbox: (id: number) => del<{ removed: boolean }>(`/candidates/${id}/mail-account`),
};

export const matches = {
  get: (id: number) => get<Match>(`/matches/${id}`),
  writeLetter: (id: number) => post<Match>(`/matches/${id}/cover-letter`, {}),
  save: (id: number, edits: { subject?: string; coverLetter?: string }) => patch<Match>(`/matches/${id}`, edits),
  approve: (id: number) => post<Match>(`/matches/${id}/approve`, {}),
  markAppliedOnSite: (id: number) => post<Match>(`/matches/${id}/applied-on-site`, {}),
  reject: (id: number) => post<Match>(`/matches/${id}/reject`, {}),
  preview: (id: number) => get<EmailPreview>(`/matches/${id}/email-preview`),
  confirmAddress: (id: number, address: string) => post<Match>(`/matches/${id}/confirm-address`, { address }),
  /** `again` is the person's explicit "send it a second time" for an application that was already sent. */
  send: (id: number, again = false) => post<Application>(`/matches/${id}/send`, again ? { again: true } : {}),
};

export const applications = {
  cancel: (id: number) => post<Application>(`/applications/${id}/cancel`, {}),
  retry: (id: number) => post<Application>(`/applications/${id}/retry`, {}),
};

export const alerts = {
  preferences: () => get<AlertPreferences>("/alerts/preferences"),
  savePreferences: (change: { frequency?: AlertFrequency; minScore?: number; paused?: boolean }) => put<AlertPreferences>("/alerts/preferences", change),

  // The buttons in an alert email work signed in or not: the signed token in the link is the authority
  preview: (token: string) => post<AlertActionPreview>("/alerts/preview", { token }, { answers401: true }),
  act: (token: string) => post<AlertActionResult>("/alerts/act", { token }, { answers401: true }),
};
