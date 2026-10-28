import { useMemo } from "react";
import { useApplications, useMatches } from "../api/queries";
import { useResumes } from "../auth/ResumeProvider";
import type { Match } from "../api/types";

/**
 * Matches the person has approved that can go out by email but have not been queued yet.
 * These are the applications waiting only for the final "send" decision.
 */
export function useReadyToSend(): Match[] {
  const { active } = useResumes();
  const matches = useMatches(active?.id);
  const applications = useApplications(active?.id);

  return useMemo(() => {
    const queued = new Set(applications.data?.map((application) => application.matchId));
    return (matches.data ?? []).filter((match) => match.status === "approved" && match.applyMethod === "email" && !match.appliedOnSiteAt && !queued.has(match.id));
  }, [matches.data, applications.data]);
}
