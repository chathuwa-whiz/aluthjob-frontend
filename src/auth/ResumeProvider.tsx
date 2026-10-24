import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useCandidates } from "../api/queries";
import type { CandidateSummary } from "../api/types";
import { useAuth } from "./AuthProvider";

interface ResumeState {
  /** Every CV this account uploaded, newest first; undefined while loading */
  resumes: CandidateSummary[] | undefined;
  /** The CV that matching, letters and sending currently work with */
  active: CandidateSummary | undefined;
  setActive: (id: number) => void;
  loading: boolean;
  error: Error | null;
}

const ResumeContext = createContext<ResumeState | undefined>(undefined);

/**
 * An account can hold several CVs (say, one per kind of job). Everything else in the app works on the
 * "active" one, remembered per account in this browser.
 */
export function ResumeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = `aj.activeResume.${user?.id ?? 0}`;
  const query = useCandidates();

  const [chosen, setChosen] = useState<number | undefined>(() => {
    try {
      return Number(window.localStorage.getItem(storageKey)) || undefined;
    } catch {
      return undefined; // storage blocked: fall back to the newest CV
    }
  });

  const setActive = useCallback(
    (id: number) => {
      setChosen(id);
      try {
        window.localStorage.setItem(storageKey, String(id));
      } catch {
        /* not worth failing for */
      }
    },
    [storageKey],
  );

  const value = useMemo<ResumeState>(() => {
    const resumes = query.data;
    return {
      resumes,
      active: resumes?.find((resume) => resume.id === chosen) ?? resumes?.[0],
      setActive,
      loading: query.isPending,
      error: query.error,
    };
  }, [query.data, query.isPending, query.error, chosen, setActive]);

  return <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>;
}

export function useResumes(): ResumeState {
  const context = useContext(ResumeContext);
  if (!context) throw new Error("useResumes must be used inside ResumeProvider");
  return context;
}
