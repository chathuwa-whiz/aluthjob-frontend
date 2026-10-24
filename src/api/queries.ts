import { QueryClient, useQuery } from "@tanstack/react-query";
import { ApiError } from "./client";
import { auth, candidates, matches } from "./endpoints";
import type { AnalysisProgress, RunProgress } from "./types";

// Client errors (400-499) are answers, not glitches: retrying them only delays the message
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

export const keys = {
  me: ["me"] as const,
  candidates: ["candidates"] as const,
  candidate: (id: number) => ["candidate", id] as const,
  matches: (candidateId: number) => ["matches", candidateId] as const,
  match: (id: number) => ["match", id] as const,
  preview: (id: number) => ["preview", id] as const,
  mailbox: (candidateId: number) => ["mailbox", candidateId] as const,
  applications: (candidateId: number) => ["applications", candidateId] as const,
  run: (candidateId: number) => ["run", candidateId] as const,
  analysis: ["analysis"] as const,
};

/** How often a running search or CV reading is asked for its progress (tests make it short). */
export const polling = { ms: 1000 };

/** Null when nobody is signed in. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await auth.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export const useCandidates = (enabled = true) => useQuery({ queryKey: keys.candidates, queryFn: candidates.list, enabled });

export const useCandidate = (id: number | undefined) =>
  useQuery({ queryKey: keys.candidate(id ?? 0), queryFn: () => candidates.get(id!), enabled: id !== undefined });

export const useMatches = (candidateId: number | undefined) =>
  useQuery({ queryKey: keys.matches(candidateId ?? 0), queryFn: () => candidates.matches(candidateId!), enabled: candidateId !== undefined });

export const useMatch = (id: number) => useQuery({ queryKey: keys.match(id), queryFn: () => matches.get(id) });

export const useEmailPreview = (id: number, enabled: boolean) =>
  useQuery({ queryKey: keys.preview(id), queryFn: () => matches.preview(id), enabled });

/** Null when no mailbox is connected yet (the server answers 404). */
export function useMailbox(candidateId: number | undefined) {
  return useQuery({
    queryKey: keys.mailbox(candidateId ?? 0),
    enabled: candidateId !== undefined,
    queryFn: async () => {
      try {
        return await candidates.mailbox(candidateId!);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

/** Refreshes itself while anything is still waiting to be sent. */
export function useApplications(candidateId: number | undefined) {
  return useQuery({
    queryKey: keys.applications(candidateId ?? 0),
    enabled: candidateId !== undefined,
    queryFn: () => candidates.applications(candidateId!),
    refetchInterval: (query) => (query.state.data?.some((a) => a.status === "queued" || a.status === "sending") ? 4000 : false),
  });
}


/** The latest job search of a CV. While it runs, the server is asked for its progress every second. */
export const useRun = (candidateId: number | undefined) =>
  useQuery<RunProgress | null>({
    queryKey: keys.run(candidateId ?? 0),
    enabled: candidateId !== undefined,
    queryFn: () => candidates.run(candidateId!),
    refetchInterval: (query) => (query.state.data?.status === "running" ? polling.ms : false),
    // progress is only meaningful fresh
    staleTime: 0,
  });

/** The latest CV the person uploaded, polled while it is being read. */
export const useAnalysis = () =>
  useQuery<AnalysisProgress | null>({
    queryKey: keys.analysis,
    queryFn: candidates.analysis,
    refetchInterval: (query) => (query.state.data?.status === "running" ? polling.ms : false),
    staleTime: 0,
  });
