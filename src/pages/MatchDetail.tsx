import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, Mail, Paperclip, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, messageOf } from "../api/client";
import { matches as matchApi } from "../api/endpoints";
import { keys, useApplications, useEmailPreview, useMailbox, useMatch } from "../api/queries";
import type { Match } from "../api/types";
import { Alert } from "../components/Alert";
import { EmptyState, Score, Skeleton } from "../components/Bits";
import { Button, buttonClass } from "../components/Button";
import { TextAreaField, TextField } from "../components/Field";
import { LongTask } from "../components/LongTask";
import { Pill } from "../components/Pill";
import { useToast } from "../components/Toast";
import { APPLICATION_STATUS_LABEL, BREAKDOWN_LABEL, formatBytes, formatDate, MATCH_STATUS_LABEL, SCORE_LABEL, scoreTier, SOURCE_LABEL } from "../lib/format";
import { safeHttpUrl } from "../lib/url";
import { usePageTitle } from "../lib/usePageTitle";

export function MatchDetail() {
  const id = Number(useParams().id);
  const query = useMatch(id);

  if (query.isPending) {
    return (
      <div className="stack">
        <Skeleton width="8rem" />
        <Skeleton height="2rem" width="60%" />
        <Skeleton height="18rem" />
      </div>
    );
  }

  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="panel">
        <EmptyState
          title={missing ? "We cannot find that match" : "We could not load this match"}
          actions={
            <Link className={buttonClass("secondary")} to="/">
              Back to matches
            </Link>
          }
        >
          {missing ? "It may have been removed after a new search." : messageOf(query.error)}
        </EmptyState>
      </div>
    );
  }

  return <MatchView match={query.data} />;
}

function MatchView({ match }: { match: Match }) {
  const { job, details } = match;
  usePageTitle(job.title);
  const advertUrl
 = safeHttpUrl(job.url);
  const tier = scoreTier(match.score);
  const where = [job.company, job.location].filter(Boolean).join(" · ");
  // Whether the letter on screen differs from the saved one. Approving or sending is blocked meanwhile, so the
  // text a person approves is always exactly the text they can see.
  const [unsaved, setUnsaved] = useState(false);

  return (
    <>
      <Link to="/" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> All matches
      </Link>

      <header className="job-title">
        <div className="job-title__row">
          <Score value={match.score} />
          <h1>{job.title}</h1>
        </div>
        <p className="muted wrap">{[where, SOURCE_LABEL[job.source], job.closingAt ? `Closes ${formatDate(job.closingAt)}` : null].filter(Boolean).join(" · ")}</p>
        <div className="action-bar">
          <Pill kind={match.status === "approved" ? "ok" : match.status === "rejected" ? undefined : "primary"}>{MATCH_STATUS_LABEL[match.status]}</Pill>
          <span className="muted small">{SCORE_LABEL[tier]}</span>
          {advertUrl && (
            <a className="small" href={advertUrl} target="_blank" rel="noopener noreferrer">
              Read the original advert <ExternalLink size={13} aria-hidden="true" style={{ display: "inline" }} />
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </header>

      <div className="detail">
        <div className="stack">
          <LetterPanel match={match} onUnsavedChange={setUnsaved} />
          {match.applyMethod === "email" ? <SendPanel match={match} unsaved={unsaved} /> : <PortalPanel match={match} advertUrl={advertUrl} />}
        </div>

        <aside className="detail__aside" aria-label="About this job">
          <section className="panel">
            <div className="panel__head">
              <h2>Why it matched</h2>
            </div>
            <div className="panel__body">
              {details.reasons.length > 0 ? (
                <ul className="stack" style={{ gap: "var(--s-2)" }}>
                  {details.reasons.map((reason) => (
                    <li key={reason} className="small">
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">No strong signals: the advert shares little wording with your CV.</p>
              )}

              {details.matchedSkills.length > 0 && (
                <div className="stack" style={{ gap: "var(--s-2)" }}>
                  <h3 className="small">Your skills it asks for</h3>
                  <ul className="chips">
                    {details.matchedSkills.map((skill) => (
                      <li key={skill} className="chip chip--match">
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {details.warnings.map((warning) => (
                <Alert key={warning} kind="warn">
                  {warning}
                </Alert>
              ))}

              <div className="stack" style={{ gap: "var(--s-2)" }}>
                <h3 className="small">How the score is made</h3>
                {(Object.keys(BREAKDOWN_LABEL) as (keyof typeof BREAKDOWN_LABEL)[]).map((part) => {
                  const percent = Math.round(details.breakdown[part] * 100);
                  return (
                    <div key={part} className="meter">
                      <span>{BREAKDOWN_LABEL[part]}</span>
                      <span className="meter__track" aria-hidden="true">
                        <span className="meter__fill" style={{ display: "block", width: `${percent}%` }} />
                      </span>
                      <span className="meter__value">{percent}%</span>
                      <span className="visually-hidden">{`${BREAKDOWN_LABEL[part]}: ${percent} percent`}</span>
                    </div>
                  );
                })}
                <p className="muted small">The score compares the words and dates in your CV with the advert. It is a guide, not a promise: read the advert before you send.</p>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>The advert</h2>
            </div>
            <div className="panel__body">
              <dl className="meta-list">
                {job.jobType && (
                  <>
                    <dt>Type</dt>
                    <dd>{job.jobType}</dd>
                  </>
                )}
                {job.salary && (
                  <>
                    <dt>Pay</dt>
                    <dd>{job.salary}</dd>
                  </>
                )}
                {job.category && (
                  <>
                    <dt>Field</dt>
                    <dd>{job.category}</dd>
                  </>
                )}
                {job.postedAt && (
                  <>
                    <dt>Posted</dt>
                    <dd>{formatDate(job.postedAt)}</dd>
                  </>
                )}
                <dt>Source</dt>
                <dd>{SOURCE_LABEL[job.source]}</dd>
              </dl>

              {job.description ? (
                <>
                  <div className="description">{job.description}</div>
                  {job.source === "topjobs" && (
                    <p className="muted small">Many TopJobs adverts are pictures. This text was read from the picture automatically, so it may contain mistakes.</p>
                  )}
                </>
              ) : (
                <p className="muted small">We could only read a short teaser of this advert. Open the original to see everything.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

// ---- the cover letter ------------------------------------------------------------------

function LetterPanel({ match, onUnsavedChange }: { match: Match; onUnsavedChange: (unsaved: boolean) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [subject, setSubject] = useState(match.subject ?? "");
  const [body, setBody] = useState(match.coverLetter ?? "");
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  const savedSubject = match.subject ?? "";
  const savedBody = match.coverLetter ?? "";
  const dirty = subject !== savedSubject || body !== savedBody;

  useEffect(() => {
    onUnsavedChange(dirty);
    return () => onUnsavedChange(false);
  }, [dirty, onUnsavedChange]);

  // When the server's copy changes (a new draft, a save), the editor shows it
  useEffect(() => {
    setSubject(match.subject ?? "");
    setBody(match.coverLetter ?? "");
  }, [match.subject, match.coverLetter, match.updatedAt]);

  const accept = async (updated: Match) => {
    queryClient.setQueryData(keys.match(match.id), updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.matches(match.candidateId) }),
      queryClient.invalidateQueries({ queryKey: keys.preview(match.id) }),
    ]);
  };

  const write = useMutation({
    mutationFn: () => matchApi.writeLetter(match.id),
    onSuccess: async (updated) => {
      setConfirmingReplace(false);
      await accept(updated);
      toast("New draft written");
    },
  });

  const save = useMutation({
    mutationFn: () => matchApi.save(match.id, { subject: subject.trim(), coverLetter: body.trim() }),
    onSuccess: async (updated) => {
      await accept(updated);
      toast(match.status === "approved" ? "Saved. Approve it again to send this version." : "Saved");
    },
  });

  const hasLetter = Boolean(match.coverLetter);

  const requestNewDraft = () => {
    if (dirty) setConfirmingReplace(true);
    else write.mutate();
  };

  return (
    <section className="panel" aria-labelledby="letter-heading">
      <div className="panel__head">
        <h2 id="letter-heading">Cover letter</h2>
        {hasLetter && !write.isPending && (
          <Button size="sm" variant="secondary" icon={<Sparkles size={15} aria-hidden="true" />} onClick={requestNewDraft}>
            Write a new draft
          </Button>
        )}
      </div>

      <div className="panel__body">
        {write.isPending && (
          <LongTask title="Writing your letter">
            A model running on this server drafts it using only facts from your CV. It does not see the advert, so it cannot invent duties or requirements. This usually takes 30 to 90 seconds.
          </LongTask>
        )}

        {write.isError && (
          <Alert kind="bad" title="The letter could not be written">
            {messageOf(write.error)}
          </Alert>
        )}

        {confirmingReplace && (
          <Alert
            kind="warn"
            title="Replace your edits?"
            actions={
              <>
                <Button size="sm" variant="primary" onClick={() => write.mutate()}>
                  Yes, write a new draft
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmingReplace(false)}>
                  Keep my edits
                </Button>
              </>
            }
          >
            You changed this letter and have not saved it. A new draft will replace what is here.
          </Alert>
        )}

        {!hasLetter && !write.isPending && (
          <div className="well stack" style={{ gap: "var(--s-3)" }}>
            <p>There is no letter for this job yet. We can draft one from your CV, and you can change every word before approving it.</p>
            <div>
              <Button variant="primary" icon={<Sparkles size={16} aria-hidden="true" />} onClick={() => write.mutate()}>
                Write the letter
              </Button>
            </div>
          </div>
        )}

        {hasLetter && !write.isPending && (
          <>
            <TextField label="Email subject" value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} />
            <TextAreaField label="Letter" className="letter-body" rows={14} value={body} onChange={(event) => setBody(event.target.value)} />

            {match.status === "approved" && (
              <p className="muted small">You approved this version. If you change it, your approval is withdrawn so you always approve the final text.</p>
            )}

            <div className="action-bar">
              <Button variant={dirty ? "primary" : "secondary"} busy={save.isPending} disabled={!dirty || !body.trim() || !subject.trim()} onClick={() => save.mutate()}>
                Save changes
              </Button>
              {dirty && <span className="muted small">You have unsaved changes.</span>}
            </div>
            {save.isError && <Alert kind="bad">{messageOf(save.error)}</Alert>}
          </>
        )}
      </div>
    </section>
  );
}

// ---- approving and sending by email ----------------------------------------------------

function SendPanel({ match, unsaved }: { match: Match; unsaved: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const hasLetter = Boolean(match.coverLetter);

  const preview = useEmailPreview(match.id, hasLetter);
  const mailbox = useMailbox(match.candidateId);
  const applications = useApplications(match.candidateId);
  const application = applications.data?.find((item) => item.matchId === match.id);

  const refreshAll = async (updated?: Match) => {
    if (updated) queryClient.setQueryData(keys.match(match.id), updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.matches(match.candidateId) }),
      queryClient.invalidateQueries({ queryKey: keys.preview(match.id) }),
      queryClient.invalidateQueries({ queryKey: keys.applications(match.candidateId) }),
    ]);
  };

  const approve = useMutation({
    mutationFn: () => matchApi.approve(match.id),
    onSuccess: async (updated) => {
      await refreshAll(updated);
      toast("Approved");
    },
  });
  const reject = useMutation({
    mutationFn: () => matchApi.reject(match.id),
    onSuccess: async (updated) => {
      await refreshAll(updated);
      toast("Skipped. You can find it under Skipped.");
    },
  });
  const send = useMutation({
    mutationFn: () => matchApi.send(match.id),
    onSuccess: async () => {
      await refreshAll();
      toast("Queued. It will be sent shortly.");
    },
  });

  const data = preview.data;
  const problems = data?.problems ?? [];
  const approved = match.status === "approved";
  const needsAddressCheck = Boolean(data && data.message.addressSource === "image" && !data.message.addressConfirmed);
  const mailboxMissing = mailbox.isSuccess && !mailbox.data;
  // the server states every reason in words; the ones the screen already handles with a control are not repeated
  const otherProblems = problems.filter((problem) => !/Approve the match first|read from a picture|Connect your mailbox/i.test(problem));

  return (
    <section className="panel" aria-labelledby="send-heading">
      <div className="panel__head">
        <h2 id="send-heading">Approve and send</h2>
        {application && <Pill kind={application.status === "sent" ? "ok" : application.status === "failed" ? "bad" : "primary"}>{APPLICATION_STATUS_LABEL[application.status]}</Pill>}
      </div>

      <div className="panel__body">
        {!hasLetter && <p className="muted">Write the cover letter first. You will see the exact email here before anything is sent.</p>}

        {hasLetter && preview.isPending && <Skeleton height="10rem" />}
        {preview.isError && (
          <Alert kind="bad" title="We could not prepare the email preview">
            {messageOf(preview.error)}
          </Alert>
        )}

        {data && (
          <>
            <div className="stack" style={{ gap: "var(--s-3)" }}>
              <h3 className="small">This is exactly what will be sent</h3>
              <dl className="meta-list">
                <dt>From</dt>
                <dd>{data.message.from}</dd>
                <dt>To</dt>
                <dd>{data.message.to}</dd>
                <dt>Subject</dt>
                <dd>{data.message.subject}</dd>
                <dt>Attached</dt>
                <dd>
                  <Paperclip size={14} aria-hidden="true" style={{ display: "inline", marginRight: 4 }} />
                  {data.message.attachment.fileName} ({formatBytes(data.message.attachment.bytes)})
                </dd>
              </dl>
              <div className="paper">{data.message.body}</div>
            </div>

            {unsaved && (
              <Alert kind="warn" title="Save your changes first">
                The email above shows the last saved letter. Save your edits so that what you approve is exactly what you can see.
              </Alert>
            )}

            {needsAddressCheck && <ConfirmAddress match={match} address={data.message.to} verifyAt={safeHttpUrl(data.message.verifyAt)} onDone={refreshAll} />}

            {mailboxMissing && (
              <Alert
                kind="warn"
                title="Connect your mailbox first"
                actions={
                  <Link className={buttonClass("secondary", "sm")} to="/mailbox">
                    Connect mailbox
                  </Link>
                }
              >
                Applications are sent from your own email address.
              </Alert>
            )}

            {otherProblems.length > 0 && (
              <Alert kind="warn" title="Before this can be sent">
                <ul className="problem-list">
                  {otherProblems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </>
        )}

        {application && (
          <Alert kind={application.status === "failed" ? "bad" : application.status === "sent" ? "ok" : "info"} title={APPLICATION_STATUS_LABEL[application.status]}>
            {application.status === "sent" && `Sent to ${application.toEmail} on ${formatDate(application.sentAt)}.`}
            {application.status === "queued" && `Waiting its turn: applications go out one at a time, spaced apart, to protect your mailbox's reputation.`}
            {application.status === "sending" && "Being sent right now."}
            {application.status === "failed" && (application.error ?? "It could not be sent.")}
            {application.status === "cancelled" && "You cancelled this application."}{" "}
            <Link to="/applications">See all applications</Link>
          </Alert>
        )}

        {(approve.isError || reject.isError || send.isError) && <Alert kind="bad">{messageOf(approve.error ?? reject.error ?? send.error)}</Alert>}

        {hasLetter && !application && (
          <div className="action-bar">
            {!approved ? (
              <Button variant="primary" icon={<Check size={16} aria-hidden="true" />} busy={approve.isPending} disabled={unsaved} onClick={() => approve.mutate()}>
                Approve this letter
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<Send size={16} aria-hidden="true" />}
                busy={send.isPending}
                disabled={problems.length > 0 || mailboxMissing || unsaved}
                onClick={() => send.mutate()}
              >
                Send application
              </Button>
            )}
            {match.status !== "rejected" && (
              <Button variant="ghost" busy={reject.isPending} onClick={() => reject.mutate()}>
                Skip this job
              </Button>
            )}
          </div>
        )}

        {hasLetter && approved && !application && problems.length === 0 && !mailboxMissing && (
          <p className="muted small">Nothing is sent until you press Send application.</p>
        )}
        {match.status === "rejected" && <p className="muted small">You skipped this job. Approve the letter if you change your mind.</p>}
      </div>
    </section>
  );
}

/**
 * An address read from a picture can contain a misread letter, and a CV sent to a wrong address is gone.
 * So the person looks at the original advert and types the address back, which is what catches a slip.
 */
function ConfirmAddress({ match, address, verifyAt, onDone }: { match: Match; address: string; verifyAt: string | null; onDone: () => Promise<void> }) {
  const [typed, setTyped] = useState("");
  const toast = useToast();

  const confirm = useMutation({
    mutationFn: () => matchApi.confirmAddress(match.id, typed.trim()),
    onSuccess: async () => {
      await onDone();
      toast("Address confirmed");
    },
  });

  return (
    <div className="alert alert--warn">
      <AlertTriangle size={18} aria-hidden="true" />
      <form
        className="alert__body"
        onSubmit={(event) => {
          event.preventDefault();
          confirm.mutate();
        }}
      >
        <p className="alert__title">Check this address against the original advert</p>
        <p>
          This advert shows its email address as a picture, so we read it automatically and a letter may be wrong. We found <strong className="wrap">{address}</strong>.
        </p>
        {verifyAt && (
          <p>
            <a href={verifyAt} target="_blank" rel="noopener noreferrer">
              Open the original advert <span className="visually-hidden">(opens in a new tab)</span>
            </a>
          </p>
        )}
        <TextField
          label="Type the address exactly as it appears in the advert"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          onChange={(event) => setTyped(event.target.value)}
          error={confirm.isError ? messageOf(confirm.error) : null}
        />
        <div className="alert__actions">
          <Button type="submit" variant="primary" size="sm" busy={confirm.isPending} disabled={!typed.trim()}>
            Confirm address
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---- jobs that take applications on their own site -------------------------------------

function PortalPanel({ match, advertUrl }: { match: Match; advertUrl: string | null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const target = safeHttpUrl(match.job.applyUrl) ?? advertUrl;

  const reject = useMutation({
    mutationFn: () => matchApi.reject(match.id),
    onSuccess: async (updated) => {
      queryClient.setQueryData(keys.match(match.id), updated);
      await queryClient.invalidateQueries({ queryKey: keys.matches(match.candidateId) });
      toast("Skipped");
    },
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(match.coverLetter ?? "");
      toast("Letter copied");
    } catch {
      toast("Copying was blocked. Select the letter above and copy it by hand.", "bad");
    }
  };

  return (
    <section className="panel" aria-labelledby="portal-heading">
      <div className="panel__head">
        <h2 id="portal-heading">Apply on their site</h2>
        <Pill>
          <ExternalLink size={13} aria-hidden="true" /> No email address
        </Pill>
      </div>
      <div className="panel__body">
        <p>
          This employer takes applications on its own website or portal, so there is no address we can email. Open the advert, apply there, and paste in your letter if the form has room for one.
        </p>
        <div className="action-bar">
          {target && (
            <a className={buttonClass("primary")} href={target} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} aria-hidden="true" /> Open the advert <span className="visually-hidden">(opens in a new tab)</span>
            </a>
          )}
          {match.coverLetter && (
            <Button variant="secondary" icon={<Copy size={16} aria-hidden="true" />} onClick={() => void copy()}>
              Copy the letter
            </Button>
          )}
          {match.status !== "rejected" && (
            <Button variant="ghost" busy={reject.isPending} onClick={() => reject.mutate()}>
              Skip this job
            </Button>
          )}
        </div>
        {reject.isError && <Alert kind="bad">{messageOf(reject.error)}</Alert>}
        <p className="muted small">
          <Mail size={14} aria-hidden="true" style={{ display: "inline", marginRight: 4 }} />
          Jobs that publish an email address can be sent from here, with your CV attached.
        </p>
      </div>
    </section>
  );
}
