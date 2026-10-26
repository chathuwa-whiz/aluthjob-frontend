import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Briefcase, Check, ExternalLink, FileText, Mail, Search, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { messageOf } from "../api/client";
import { candidates } from "../api/endpoints";
import { keys, useApplications, useMailbox, useMatches, useRun } from "../api/queries";
import type { Application, Match, MatchRunSummary, MatchStatus, RunProgress } from "../api/types";
import { useResumes } from "../auth/ResumeProvider";
import { Alert } from "../components/Alert";
import { AppPasswordGuide } from "../components/AppPasswordGuide";
import { EmptyState, PageHead, Score, SkeletonRows } from "../components/Bits";
import { Button, buttonClass } from "../components/Button";
import { Pill } from "../components/Pill";
import { SearchProgress } from "../components/SearchProgress";
import { Tabs, panelId, tabId } from "../components/Tabs";
import { formatDate, formatElapsed, matchBadge, SOURCE_LABEL } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

type Tab = MatchStatus;

export function Matches() {
  usePageTitle("Job matches");
  const { active, resumes, loading: loadingResumes } = useResumes();
  const matches = useMatches(active?.id);
  const mailbox = useMailbox(active?.id);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("suggested");
  const [emailOnly, setEmailOnly] = useState(false);

  // The search runs on the server; this follows it, and keeps following after the person leaves and returns
  const run = useRun(active?.id);
  const start = useMutation({
    mutationFn: () => candidates.runMatching(active!.id),
    onSuccess: (progress) => queryClient.setQueryData(keys.run(progress.candidateId), progress),
  });
  const status = run.data?.status;
  const running = status === "running";
  const wasRunning = useRef(false);

  // New matches appear in the list the moment a search ends
  useEffect(() => {
    if (wasRunning.current && status !== "running" && active) void queryClient.invalidateQueries({ queryKey: keys.matches(active.id) });
    wasRunning.current = status === "running";
  }, [status, active, queryClient]);

  const all = matches.data;
  const counts = useMemo(() => {
    const result: Record<Tab, number> = { suggested: 0, approved: 0, rejected: 0 };
    for (const match of all ?? []) result[match.status]++;
    return result;
  }, [all]);

  const applications = useApplications(active?.id);
  const applicationOf = useMemo(() => new Map((applications.data ?? []).map((application) => [application.matchId, application])), [applications.data]);

  const shown = useMemo(
    () => (all ?? []).filter((match) => match.status === tab && (!emailOnly || match.applyMethod === "email")),
    [all, tab, emailOnly],
  );

  // ---- first run: nothing uploaded yet ----
  if (loadingResumes) {
    return (
      <>
        <PageHead title="Job matches" />
        <SkeletonRows />
      </>
    );
  }

  if (!resumes || resumes.length === 0 || !active) {
    return (
      <>
        <PageHead title="Welcome">Three steps from your CV to applications that go out in your name, each one approved by you.</PageHead>
        <SetupSteps hasResume={false} hasMailbox={false} />
      </>
    );
  }

  const hasMatches = (all?.length ?? 0) > 0;
  const mailboxReady = Boolean(mailbox.data);

  return (
    <>
      <PageHead
        title="Job matches"
        // while the checklist is showing, its own "Find jobs now" is the one clear next step
        actions={
          hasMatches ? (
            <Button variant="primary" icon={<Search size={16} aria-hidden="true" />} busy={start.isPending || running} onClick={() => start.mutate()}>
              Find new jobs
            </Button>
          ) : undefined
        }
      >
        Ranked against <strong className="wrap">{active.fullName ?? active.fileName}</strong>. Open a match to read the advert, edit the letter and approve it.
      </PageHead>

      {running && run.data && <SearchProgress run={run.data} receivedAt={run.dataUpdatedAt} />}

      {start.isError && <Alert kind="bad" title="The search did not start">{messageOf(start.error)}</Alert>}

      {run.data?.status === "failed" && <Alert kind="bad" title="The search did not finish">{run.data.error}</Alert>}

      {run.data?.status === "done" && run.data.summary && <SearchSummary run={run.data} summary={run.data.summary} />}

      {!mailboxReady && !mailbox.isPending && hasMatches && (
        <Alert
          kind="info"
          title="Connect your mailbox to send applications"
          actions={
            <Link className={buttonClass("secondary", "sm")} to="/mailbox">
              Connect mailbox
            </Link>
          }
        >
          Applications go out from your own email address, so recipients reply to you. You can review and edit letters before connecting it.
        </Alert>
      )}

      {matches.isPending && <SkeletonRows />}

      {matches.isError && (
        <Alert kind="bad" title="We could not load your matches" actions={<Button size="sm" onClick={() => void matches.refetch()}>Try again</Button>}>
          {messageOf(matches.error)}
        </Alert>
      )}

      {matches.isSuccess && !hasMatches && !running && (
        <div className="panel">
          <SetupSteps hasResume hasMailbox={mailboxReady} onFind={() => start.mutate()} finding={start.isPending || running} />
        </div>
      )}

      {hasMatches && (
        <>
          <div className="toolbar">
            <Tabs
              label="Match status"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "suggested", label: "To review", count: counts.suggested },
                { id: "approved", label: "Approved", count: counts.approved },
                { id: "rejected", label: "Skipped", count: counts.rejected },
              ]}
            />
            <label className="check">
              <input type="checkbox" checked={emailOnly} onChange={(event) => setEmailOnly(event.target.checked)} />
              <span>Only jobs I can apply to by email</span>
            </label>
          </div>

          <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
            {shown.length > 0 ? (
              <ul className="rows">
                {shown.map((match) => (
                  <li key={match.id}>
                    <MatchRow match={match} application={applicationOf.get(match.id)} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="panel">
                <EmptyState
                  icon={<Briefcase size={22} aria-hidden="true" />}
                  title={tab === "suggested" ? "Nothing left to review" : tab === "approved" ? "No approved applications yet" : "No skipped jobs"}
                >
                  {tab === "suggested"
                    ? emailOnly
                      ? "No matches here can be applied to by email. Turn that filter off to see the rest, or search again for new jobs."
                      : "You have been through every match. Search again later for newly posted jobs."
                    : tab === "approved"
                      ? "Approve a cover letter on any match and it will wait here until you send it."
                      : "Jobs you skip are kept here, out of your way."}
                </EmptyState>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function SearchSummary({ run, summary }: { run: RunProgress; summary: MatchRunSummary }) {
  return (
    <Alert kind={summary.sourcesFailed > 0 ? "warn" : "ok"} title={`Search finished in ${formatElapsed(Math.round(run.elapsedMs / 1000))}`}>
      {summary.collected > 0 && <>First collected {summary.collected.toLocaleString()} vacancies from the job sites. </>}
      Looked at {summary.considered.toLocaleString()} vacancies and kept {summary.matched} {summary.matched === 1 ? "match" : "matches"}
      {summary.topScore !== null ? `, the best scoring ${summary.topScore} out of 100` : ""}. Read the full advert of {summary.enriched} of them.
      {summary.sourcesFailed > 0 && (
        <>
          {" "}
          {summary.sourcesFailed} {summary.sourcesFailed === 1 ? "job site" : "job sites"} could not be reached this time, so some vacancies may be missing. They are tried again automatically.
        </>
      )}
    </Alert>
  );
}

function MatchRow({ match, application }: { match: Match; application?: Application }) {
  const { job, details } = match;
  const where = [job.company, job.location].filter(Boolean).join(" · ");
  const closes = job.closingAt ? `Closes ${formatDate(job.closingAt)}` : null;
  // An address read from a picture has to be double-checked by the person before anything is sent to it
  const needsAddressCheck = match.applyMethod === "email" && job.applyEmailSource === "image";
  const badge = matchBadge(match.status, application);

  return (
    <Link to={`/matches/${match.id}`} className="match-row">
      <Score value={match.score} />

      <span className="match-row__main">
        <span className="match-row__title">{job.title}</span>
        <span className="match-row__sub">{[where, SOURCE_LABEL[job.source], closes].filter(Boolean).join(" · ")}</span>
        {details.reasons[0] && <span className="match-row__why">{details.reasons[0]}</span>}
        {details.warnings[0] && (
          <span className="match-row__warn">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{details.warnings[0]}</span>
          </span>
        )}
      </span>

      <span className="match-row__side">
        {match.applyMethod === "email" ? (
          <Pill kind="primary">
            <Mail size={13} aria-hidden="true" /> By email
          </Pill>
        ) : (
          <Pill>
            <ExternalLink size={13} aria-hidden="true" /> On their site
          </Pill>
        )}
        {needsAddressCheck && <Pill kind="warn">Check address</Pill>}
        {match.status === "approved" && (
          <Pill kind={badge.kind}>
            {application?.status === "sent" ? <Send size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />} {application ? badge.label : "Approved"}
          </Pill>
        )}
        {match.status === "suggested" && match.coverLetter && <Pill>Letter drafted</Pill>}
      </span>
    </Link>
  );
}

/** The first-run checklist: it names the next action and shows where the person is in the whole path. */
function SetupSteps({ hasResume, hasMailbox, onFind, finding }: { hasResume: boolean; hasMailbox: boolean; onFind?: () => void; finding?: boolean }) {
  const current = !hasResume ? 1 : !hasMailbox ? 2 : 3;

  const status = (n: number) => (n < current ? "step step--done" : n === current ? "step step--current" : "step");

  return (
    <div className="panel__body">
      <ol className="steps">
        <li className={status(1)}>
          <span className="step__mark" aria-hidden="true">
            {hasResume ? <Check size={16} /> : 1}
          </span>
          <div className="stack" style={{ gap: "var(--s-2)" }}>
            <span className="step__title">Upload your CV {hasResume && <span className="muted">(done)</span>}</span>
            <p className="muted small">We read it to learn your skills, experience and the kind of work you want. You can correct anything we get wrong.</p>
            {!hasResume && (
              <div>
                <Link className={buttonClass("primary")} to="/resume">
                  <FileText size={16} aria-hidden="true" /> Upload your CV
                </Link>
              </div>
            )}
          </div>
        </li>

        <li className={status(2)}>
          <span className="step__mark" aria-hidden="true">
            {hasMailbox ? <Check size={16} /> : 2}
          </span>
          <div className="stack" style={{ gap: "var(--s-2)" }}>
            <span className="step__title">
              Connect your email {hasMailbox && <span className="muted">(done)</span>}
              {!hasMailbox && <span className="muted"> (optional until you send)</span>}
            </span>
            <p className="muted small">Applications are sent from your own address, so employers reply straight to you.</p>
            {hasResume && !hasMailbox && (
              <div>
                <Link className={buttonClass("secondary")} to="/mailbox">
                  <Mail size={16} aria-hidden="true" /> Connect mailbox
                </Link>
              </div>
            )}
            {hasResume && !hasMailbox && <AppPasswordGuide />}
          </div>
        </li>

        <li className={status(3)}>
          <span className="step__mark" aria-hidden="true">
            3
          </span>
          <div className="stack" style={{ gap: "var(--s-2)" }}>
            <span className="step__title">Find jobs that fit</span>
            <p className="muted small">We compare your CV with vacancies from Sri Lankan job sites and rank them. Then you read, edit and approve each application.</p>
            {hasResume && onFind && (
              <div>
                <Button variant={current === 3 ? "primary" : "secondary"} icon={<Search size={16} aria-hidden="true" />} busy={finding} onClick={onFind}>
                  Find jobs now
                </Button>
              </div>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}

