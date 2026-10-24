import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { messageOf } from "../api/client";
import { applications as applicationApi, candidates } from "../api/endpoints";
import { keys, useApplications, useMatches } from "../api/queries";
import type { Application, QueueResult } from "../api/types";
import { useResumes } from "../auth/ResumeProvider";
import { Alert } from "../components/Alert";
import { EmptyState, PageHead, SkeletonRows } from "../components/Bits";
import { Button, buttonClass } from "../components/Button";
import { Pill } from "../components/Pill";
import { useToast } from "../components/Toast";
import { APPLICATION_STATUS_LABEL, formatDateTime, timeAgo } from "../lib/format";
import { useReadyToSend } from "../lib/useReadyToSend";
import { usePageTitle } from "../lib/usePageTitle";

const STATUS_KIND = { sent: "ok", failed: "bad", queued: "primary", sending: "primary", cancelled: undefined } as const;

export function ApplicationsPage() {
  usePageTitle("Applications");
  const { active } = useResumes();
  const applications = useApplications(active?.id);
  const matches = useMatches(active?.id);
  const ready = useReadyToSend();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [result, setResult] = useState<QueueResult | null>(null);

  // Applications know only their match; the job's title and company come from the matches list
  const titles = useMemo(() => new Map((matches.data ?? []).map((match) => [match.id, match])), [matches.data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.applications(active!.id) });

  const queue = useMutation({
    mutationFn: () => candidates.queue(active!.id),
    onSuccess: async (queued) => {
      setResult(queued);
      await refresh();
      if (queued.queued.length > 0) toast(`${queued.queued.length} queued for sending`);
    },
  });
  const cancel = useMutation({ mutationFn: (id: number) => applicationApi.cancel(id), onSuccess: refresh });
  const retry = useMutation({ mutationFn: (id: number) => applicationApi.retry(id), onSuccess: refresh });

  if (!active) {
    return (
      <>
        <PageHead title="Applications" />
        <div className="panel">
          <EmptyState icon={<Send size={22} aria-hidden="true" />} title="Nothing here yet" actions={<Link className={buttonClass("primary")} to="/resume">Upload your CV</Link>}>
            Once you have a CV, matches, and approved letters, the applications you send are tracked here.
          </EmptyState>
        </div>
      </>
    );
  }

  const list = applications.data ?? [];
  const busy = (applications.isPending || matches.isPending) && !applications.data;

  return (
    <>
      <PageHead title="Applications">Emails go out one at a time, spaced apart, from your own address. This keeps your mailbox from being flagged as spam.</PageHead>

      {ready.length > 0 && (
        <section className="panel" aria-labelledby="ready-heading">
          <div className="panel__head">
            <div>
              <h2 id="ready-heading">Approved and ready to send</h2>
              <p className="muted small">You have read and approved these. Sending queues them; you can still cancel any that have not gone out.</p>
            </div>
            <Button variant="primary" icon={<Send size={16} aria-hidden="true" />} busy={queue.isPending} onClick={() => queue.mutate()}>
              Send all {ready.length}
            </Button>
          </div>
          <ul>
            {ready.map((match) => (
              <li key={match.id} className="ready-row" style={{ borderTop: "1px solid var(--line)" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="wrap">
                    <strong>{match.job.title}</strong>
                  </div>
                  <div className="muted small wrap">
                    {match.job.company ?? "Unknown employer"} · to {match.job.applyEmail}
                  </div>
                </div>
                <Link className={buttonClass("ghost", "sm")} to={`/matches/${match.id}`}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {queue.isError && <Alert kind="bad" title="Could not queue your applications">{messageOf(queue.error)}</Alert>}

      {result && result.skipped.length > 0 && (
        <Alert kind="warn" title={`${result.skipped.length} approved ${result.skipped.length === 1 ? "match was" : "matches were"} not queued`}>
          <ul className="problem-list">
            {result.skipped.map((skipped) => (
              <li key={skipped.matchId}>
                <Link to={`/matches/${skipped.matchId}`}>{skipped.title}</Link>: {skipped.reason}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {(cancel.isError || retry.isError) && <Alert kind="bad">{messageOf(cancel.error ?? retry.error)}</Alert>}

      <section aria-labelledby="sent-heading" className="stack" style={{ gap: "var(--s-3)" }}>
        <h2 id="sent-heading">Sent and waiting</h2>

        {busy && <SkeletonRows count={3} />}
        {!busy && list.length === 0 && ready.length > 0 && <p className="muted">Nothing has been sent yet. Applications you send appear here, with how each one went.</p>}
        {applications.isError && <Alert kind="bad" title="We could not load your applications">{messageOf(applications.error)}</Alert>}

        {!busy && list.length === 0 && ready.length === 0 && (
          <div className="panel">
            <EmptyState icon={<Send size={22} aria-hidden="true" />} title="No applications yet" actions={<Link className={buttonClass("primary")} to="/">Review your matches</Link>}>
              Open a match, read the letter, and approve it. Approved applications that have an email address appear above, ready to send.
            </EmptyState>
          </div>
        )}

        {list.length > 0 && (
          <ul className="rows">
            {list.map((application) => (
              <li key={application.id}>
                <ApplicationRow
                  application={application}
                  title={titles.get(application.matchId)?.job.title ?? "Application"}
                  company={titles.get(application.matchId)?.job.company ?? null}
                  onCancel={() => cancel.mutate(application.id)}
                  onRetry={() => retry.mutate(application.id)}
                  working={cancel.isPending || retry.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ApplicationRow({ application, title, company, onCancel, onRetry, working }: { application: Application; title: string; company: string | null; onCancel: () => void; onRetry: () => void; working: boolean }) {
  const when =
    application.status === "sent"
      ? `Sent ${timeAgo(application.sentAt)}`
      : application.status === "queued"
        ? `Next attempt ${timeAgo(application.nextAttemptAt)}`
        : `Updated ${formatDateTime(application.updatedAt)}`;

  return (
    <div className="app-row">
      <div className="app-row__main">
        <Link to={`/matches/${application.matchId}`} className="wrap">
          <strong>{title}</strong>
        </Link>
        <span className="muted small wrap">
          {[company, `to ${application.toEmail}`].filter(Boolean).join(" · ")}
        </span>
      </div>

      <div className="stack" style={{ gap: 2 }}>
        <span className="small">{when}</span>
        {application.error && application.status !== "sent" && <span className="small" style={{ color: application.status === "failed" ? "var(--bad-ink)" : "var(--muted)" }}>{application.error}</span>}
      </div>

      <Pill kind={STATUS_KIND[application.status]}>{APPLICATION_STATUS_LABEL[application.status]}</Pill>

      <div className="action-bar">
        {application.status === "queued" && (
          <Button size="sm" variant="ghost" disabled={working} onClick={onCancel}>
            Cancel
          </Button>
        )}
        {application.status === "failed" && (
          <Button size="sm" disabled={working} onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
