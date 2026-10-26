import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { StrictMode, type ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { App } from "../App";
import { ApiError } from "../api/client";
import type { AnalysisProgress, Application, Job, Match, RunProgress, User } from "../api/types";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../components/Toast";

// ---- a fake API at the fetch level, so tests run the same client code as the browser ----

export interface Reply {
  status?: number;
  data?: unknown;
  message?: string;
  code?: string;
  headers?: Record<string, string>;
}
type Handler = Reply | ((call: Call) => Reply | Promise<Reply>);
export interface Call {
  method: string;
  path: string;
  body: unknown;
  form?: FormData;
}

export interface FakeApi {
  calls: Call[];
  /** Calls made to routes matching, e.g. calls("POST", "/matches/1/approve") */
  called: (method: string, path: string) => Call[];
  /** Replace or add a route while a test runs */
  set: (route: string, handler: Handler) => void;
}

/**
 * Routes are keyed "METHOD /path" (without /api/v1 and without a query string). A route that is not
 * defined answers 404 and is recorded, so a test cannot silently depend on an endpoint it forgot about.
 */
export function fakeApi(routes: Record<string, Handler>): FakeApi {
  const table = new Map(Object.entries(routes));
  const calls: Call[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const body = init?.body;
      const call: Call = {
        method,
        path,
        body: typeof body === "string" ? JSON.parse(body) : undefined,
        ...(body instanceof FormData && { form: body }),
      };
      calls.push(call);

      const handler = table.get(`${method} ${path}`);
      const reply: Reply = handler === undefined ? { status: 404, message: `No fake for ${method} ${path}` } : typeof handler === "function" ? await handler(call) : handler;
      const status = reply.status ?? 200;

      return new Response(JSON.stringify({ success: status < 400, data: reply.data, message: reply.message, code: reply.code }), {
        status,
        headers: { "content-type": "application/json", ...reply.headers },
      });
    }),
  );

  return {
    calls,
    called: (method, path) => calls.filter((call) => call.method === method && call.path === path),
    set: (route, handler) => void table.set(route, handler),
  };
}

// ---- fixtures ----

export const user = (overrides: Partial<User> = {}): User => ({ id: 1, email: "ama@example.com", role: "user", createdAt: "2026-10-01T00:00:00.000Z", emailVerified: true, ...overrides });

export const job = (overrides: Partial<Job> = {}): Job => ({
  id: 10,
  source: "rooster",
  url: "https://rooster.jobs/jobs/10",
  title: "Full Stack Developer",
  company: "Acme Software",
  location: "Colombo",
  description: "Build web apps with React and Node.js.",
  jobType: "full-time",
  salary: null,
  category: "Information Technology",
  postedAt: "2026-10-20T00:00:00.000Z",
  closingAt: null,
  applyEmail: "careers@acme.lk",
  applyEmailSource: "page",
  applyUrl: "https://rooster.jobs/jobs/10",
  ...overrides,
});

export const match = (overrides: Partial<Match> = {}): Match => ({
  id: 1,
  candidateId: 7,
  jobId: 10,
  score: 72,
  details: {
    breakdown: { skills: 0.8, title: 0.6, content: 0.5, experience: 0.7, location: 1 },
    matchedSkills: ["React", "Node.js"],
    reasons: ["Ad mentions 2 of your skills: React, Node.js"],
    warnings: [],
  },
  status: "suggested",
  subject: null,
  coverLetter: null,
  draftedAt: null,
  decidedAt: null,
  confirmedEmail: null,
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:00:00.000Z",
  applyMethod: "email",
  job: job(),
  ...overrides,
});

export const application = (overrides: Partial<Application> = {}): Application => ({
  id: 1,
  matchId: 1,
  candidateId: 7,
  toEmail: "careers@acme.lk",
  status: "queued",
  attempts: 0,
  nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
  error: null,
  messageId: null,
  sentSubject: null,
  sentBody: null,
  queuedAt: "2026-10-24T00:00:00.000Z",
  sentAt: null,
  updatedAt: "2026-10-24T00:00:00.000Z",
  ...overrides,
});

export const CANDIDATE = { id: 7, fileName: "ama-cv.pdf", fullName: "Ama Perera", createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" };

export const PROFILE = {
  personalInfo: { fullName: "Ama Perera", email: "ama@example.com", phone: "+94 77 123 4567", location: "Colombo, Sri Lanka", linkedin: null, portfolio: null },
  skills: ["React", "Node.js"],
  education: [{ institution: "SLIIT", degree: "BSc (Hons) Information Technology", field: null, startDate: "2022", endDate: "Present" }],
  experience: [{ company: "Webminds", position: "Full Stack Developer Intern", startDate: "Dec 2024", endDate: "Jun 2025", responsibilities: ["Built web apps"] }],
  certifications: [],
  achievements: [],
};

/** Routes every signed-in screen needs. Spread into a test's routes and override what matters. */
export const signedIn = (overrides: Record<string, Handler> = {}): Record<string, Handler> => ({
  "GET /auth/me": { data: { user: user() } },
  "GET /candidates": { data: [CANDIDATE] },
  [`GET /candidates/${CANDIDATE.id}/matches`]: { data: [] },
  [`GET /candidates/${CANDIDATE.id}/applications`]: { data: [] },
  [`GET /candidates/${CANDIDATE.id}/mail-account`]: { status: 404, message: "No mailbox connected" },
  [`GET /candidates/${CANDIDATE.id}/matches/run`]: { data: null },
  "GET /resumes/analyze": { data: null },
  "GET /alerts/preferences": { data: { frequency: "daily", minScore: 55, pausedUntil: null, lastSentAt: null } },
  ...overrides,
});

// ---- progress of long tasks, as the server reports them ----

export const run = (overrides: Partial<RunProgress> = {}): RunProgress => ({
  candidateId: 7,
  status: "running",
  phase: "starting",
  startedAt: "2026-10-24T10:00:00.000Z",
  elapsedMs: 0,
  sites: [],
  considered: null,
  adverts: { done: 0, total: 0, current: null },
  letters: { done: 0, total: 0, current: null },
  matched: null,
  topScore: null,
  activity: [],
  summary: null,
  error: null,
  ...overrides,
});

export const finishedRun = (summary: Partial<NonNullable<RunProgress["summary"]>> = {}, overrides: Partial<RunProgress> = {}): RunProgress =>
  run({
    status: "done",
    phase: "done",
    elapsedMs: 83_000,
    summary: { considered: 898, matched: 18, enriched: 12, drafted: 0, topScore: 76, collected: 0, sourcesFailed: 0, ...summary },
    ...overrides,
  });

export const analysis = (overrides: Partial<AnalysisProgress> = {}): AnalysisProgress => ({
  status: "running",
  phase: "reading",
  fileName: "cv.pdf",
  startedAt: "2026-10-24T10:00:00.000Z",
  elapsedMs: 0,
  characters: null,
  links: null,
  skills: null,
  reused: false,
  writing: 0,
  result: null,
  error: null,
  ...overrides,
});

/**
 * Answers a polled progress route with one snapshot per call, in order, and then keeps answering the last.
 * A test reads like the story of the task: "it was collecting, then comparing, then done".
 */
export const frames = <T,>(...snapshots: T[]): (() => Reply) => {
  let next = 0;
  return () => ({ data: snapshots[Math.min(next++, snapshots.length - 1)] });
};

// ---- rendering ----

export function renderApp(path = "/", options: { strict?: boolean } = {}) {
  window.history.replaceState(null, "", path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });

  const tree: ReactElement = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { client, ...render(options.strict ? <StrictMode>{tree}</StrictMode> : tree) };
}

export { ApiError };

export const MAILBOX = { candidateId: 7, email: "ama@gmail.com", fromName: "Ama Perera", host: "smtp.gmail.com", port: 465, secure: true, username: "ama@gmail.com", verifiedAt: "2026-10-22T00:00:00.000Z" };

export const LETTER = "Dear Hiring Manager,\n\nI am writing to apply for the Full Stack Developer position.\n\nSincerely,\nAma Perera";

export const preview = (overrides: { message?: Partial<import("../api/types").EmailPreview["message"]>; problems?: string[] } = {}): import("../api/types").EmailPreview => ({
  message: {
    from: "Ama Perera <ama@gmail.com>",
    to: "careers@acme.lk",
    subject: "Application for Full Stack Developer - Ama Perera",
    body: LETTER,
    attachment: { fileName: "ama-cv.pdf", bytes: 154115 },
    addressSource: "page",
    verifyAt: null,
    addressConfirmed: true,
    ...overrides.message,
  },
  problems: overrides.problems ?? [],
});

/** A match that already has a drafted letter */
export const withLetter = (overrides: Partial<Match> = {}): Match =>
  match({ subject: "Application for Full Stack Developer - Ama Perera", coverLetter: LETTER, draftedAt: "2026-10-24T01:00:00.000Z", ...overrides });
