import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { messageOf } from "../api/client";
import { candidates } from "../api/endpoints";
import { keys, useAnalysis, useCandidate } from "../api/queries";
import type { Candidate, Profile } from "../api/types";
import { useResumes } from "../auth/ResumeProvider";
import { Alert } from "../components/Alert";
import { PageHead, Skeleton } from "../components/Bits";
import { Button, buttonClass } from "../components/Button";
import { TextAreaField, TextField } from "../components/Field";
import { ResumeProgress } from "../components/ResumeProgress";
import { useToast } from "../components/Toast";
import { formatDate } from "../lib/format";
import { checkResumeFile, clean, normalizeProfile } from "../lib/resumeProfile";
import { usePageTitle } from "../lib/usePageTitle";

export function ResumePage() {
  usePageTitle("Your resume");
  const { resumes, active, setActive, loading } = useResumes();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [fresh, setFresh] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Reading a CV runs on the server; this follows it, and keeps following after the person leaves and returns
  const analysis = useAnalysis();
  const [sending, setSending] = useState<{ name: string; at: number } | null>(null);
  const [followed, setFollowed] = useState<string | null>(null);
  const handled = useRef<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => candidates.upload(file),
    onSuccess: (progress) => {
      setFollowed(progress.startedAt);
      queryClient.setQueryData(keys.analysis, progress);
    },
    onSettled: () => setSending(null),
  });

  const current = analysis.data;
  const running = upload.isPending || current?.status === "running";

  // A reading we saw start (here, or before leaving the page) is acted on once when it ends; an old finished one is not
  useEffect(() => {
    if (current?.status === "running") setFollowed(current.startedAt);
  }, [current?.status, current?.startedAt]);

  useEffect(() => {
    if (!current || current.status !== "done" || !current.result || followed !== current.startedAt || handled.current === current.startedAt) return;
    handled.current = current.startedAt;

    const result = current.result;
    void (async () => {
      await queryClient.invalidateQueries({ queryKey: keys.candidates });
      queryClient.removeQueries({ queryKey: keys.candidate(result.candidateId) });
      setActive(result.candidateId);
      setFresh(true);
      toast("CV read");
    })();
  }, [current, followed, queryClient, setActive, toast]);

  const choose = (file: File | undefined) => {
    if (!file) return;
    const problem = checkResumeFile(file);
    setFileError(problem);
    if (!problem) {
      setFresh(false);
      setSending({ name: file.name, at: Date.now() });
      upload.mutate(file);
    }
  };

  const hasResumes = (resumes?.length ?? 0) > 0;

  return (
    <>
      <PageHead title="Your resume">
        {hasResumes
          ? "This is what we know about you. Matching and cover letters use it, so fix anything that is wrong."
          : "Upload your CV and we will read it to learn your skills and experience. The reading happens on our own server."}
      </PageHead>

      {running && (
        <ResumeProgress
          analysis={current?.status === "running" ? current : null}
          fileName={sending?.name ?? current?.fileName ?? "your CV"}
          receivedAt={analysis.dataUpdatedAt}
          startedLocallyAt={sending?.at ?? Date.now()}
        />
      )}

      {(fileError || upload.isError || (current?.status === "failed" && followed === current.startedAt)) && (
        <Alert kind="bad" title="That CV could not be used">
          {fileError ?? (upload.isError ? messageOf(upload.error) : current?.error)}
        </Alert>
      )}

      {fresh && !running && (
        <Alert kind="ok" title="We have read your CV">
          Look through what we found below and correct anything that is wrong, then go back to Matches and search.
        </Alert>
      )}

      {loading ? (
        <Skeleton height="12rem" />
      ) : (
        <UploadZone compact={hasResumes} busy={running} onFile={choose} />
      )}

      {resumes && resumes.length > 1 && (
        <fieldset className="panel" style={{ padding: 0, margin: 0 }}>
          <legend className="visually-hidden">Which CV should we use?</legend>
          <div className="panel__head">
            <h2>Your CVs</h2>
            <span className="muted small">Choose the one to work with</span>
          </div>
          <ul>
            {resumes.map((resume) => (
              <li key={resume.id} className="resume-card" style={{ borderTop: "1px solid var(--line)" }}>
                <label className="check">
                  <input type="radio" name="active-resume" checked={active?.id === resume.id} onChange={() => setActive(resume.id)} />
                  <span>
                    <strong className="wrap">{resume.fullName ?? resume.fileName}</strong>
                    <span className="muted small"> · {resume.fileName} · added {formatDate(resume.createdAt)}</span>
                  </span>
                </label>
                <a className={buttonClass("ghost", "sm")} href={candidates.resumeUrl(resume.id)} download>
                  <Download size={14} aria-hidden="true" /> Download
                </a>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {active && <ProfileLoader candidateId={active.id} />}
    </>
  );
}

function UploadZone({ compact, busy, onFile }: { compact: boolean; busy: boolean; onFile: (file: File | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    onFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      className={compact ? "dropzone dropzone--compact" : "dropzone"}
      data-over={over}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <Upload size={compact ? 22 : 30} aria-hidden="true" color="var(--primary)" />
      <div>
        <strong>{compact ? "Upload another CV" : "Drop your CV here"}</strong>
        <p className="muted small">PDF or Word, up to 5 MB. {compact ? "Useful if you apply for different kinds of work." : ""}</p>
      </div>
      <Button variant={compact ? "secondary" : "primary"} size={compact ? "md" : "lg"} busy={busy} icon={<FileText size={16} aria-hidden="true" />} onClick={() => input.current?.click()}>
        Choose a file
      </Button>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        tabIndex={-1}
        aria-label="CV file"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = ""; // so choosing the same file again still fires
        }}
      />
    </div>
  );
}

function ProfileLoader({ candidateId }: { candidateId: number }) {
  const query = useCandidate(candidateId);

  if (query.isPending) return <Skeleton height="20rem" />;
  if (query.isError) return <Alert kind="bad" title="We could not load your profile">{messageOf(query.error)}</Alert>;

  // keyed by id and timestamp so the editor starts fresh whenever a different CV or a new save arrives
  return <ProfileEditor key={`${query.data.id}-${query.data.updatedAt}`} candidate={query.data} />;
}

// ---- profile editor --------------------------------------------------------------------

const lines = (text: string) => text.split("\n");
const joinLines = (items: string[]) => items.join("\n");

function ProfileEditor({ candidate }: { candidate: Candidate }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const original = candidate.profile;
  const [draft, setDraft] = useState<Profile>(structuredClone(original));
  const dirty = JSON.stringify(normalizeProfile(draft)) !== JSON.stringify(normalizeProfile(original));

  const save = useMutation({
    mutationFn: () => candidates.saveProfile(candidate.id, normalizeProfile(draft)),
    onSuccess: async (updated) => {
      queryClient.setQueryData(keys.candidate(candidate.id), updated);
      await queryClient.invalidateQueries({ queryKey: keys.candidates });
      toast("Profile saved. Search again to refresh your matches.");
    },
  });

  const info = (field: keyof Profile["personalInfo"]) => ({
    value: draft.personalInfo[field] ?? "",
    onChange: (event: { target: { value: string } }) => setDraft({ ...draft, personalInfo: { ...draft.personalInfo, [field]: event.target.value } }),
  });

  const patchJob = (index: number, patch: Partial<Profile["experience"][number]>) =>
    setDraft({ ...draft, experience: draft.experience.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const patchSchool = (index: number, patch: Partial<Profile["education"][number]>) =>
    setDraft({ ...draft, education: draft.education.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  return (
    <form
      className="editor"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <section className="panel" aria-labelledby="about-heading">
        <div className="panel__head">
          <h2 id="about-heading">About you</h2>
          <a className={buttonClass("ghost", "sm")} href={candidates.resumeUrl(candidate.id)} download>
            <Download size={14} aria-hidden="true" /> Download CV
          </a>
        </div>
        <div className="panel__body">
          <div className="form-row">
            <TextField label="Full name" autoComplete="name" {...info("fullName")} />
            <TextField label="Location" hint="Used to rank jobs near you." {...info("location")} />
          </div>
          <div className="form-row">
            <TextField label="Email" type="email" {...info("email")} />
            <TextField label="Phone" type="tel" {...info("phone")} />
          </div>
          <div className="form-row">
            <TextField label="LinkedIn" optional {...info("linkedin")} />
            <TextField label="Portfolio or website" optional {...info("portfolio")} />
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="skills-heading">
        <div className="panel__head">
          <h2 id="skills-heading">Skills</h2>
          <span className="muted small">Matching counts how many of these an advert asks for</span>
        </div>
        <div className="panel__body">
          <SkillsEditor skills={draft.skills} onChange={(skills) => setDraft({ ...draft, skills })} />
        </div>
      </section>

      <section className="panel" aria-labelledby="work-heading">
        <div className="panel__head">
          <h2 id="work-heading">Work experience</h2>
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setDraft({ ...draft, experience: [...draft.experience, { company: "", position: "", startDate: "", endDate: "", responsibilities: [] }] })}>
            Add a job
          </Button>
        </div>
        <div className="panel__body">
          {draft.experience.length === 0 && <p className="muted">No jobs listed. Add any work, internships or volunteering you want counted.</p>}
          {draft.experience.map((job, index) => (
            <div key={index} className="repeat">
              <div className="repeat__head">
                <strong>{job.position || job.company || `Job ${index + 1}`}</strong>
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} aria-hidden="true" />} aria-label={`Remove ${job.position || `job ${index + 1}`}`} onClick={() => setDraft({ ...draft, experience: draft.experience.filter((_, i) => i !== index) })}>
                  Remove
                </Button>
              </div>
              <div className="form-row">
                <TextField label="Job title" value={job.position ?? ""} onChange={(event) => patchJob(index, { position: event.target.value })} />
                <TextField label="Company" value={job.company ?? ""} onChange={(event) => patchJob(index, { company: event.target.value })} />
              </div>
              <div className="form-row">
                <TextField label="Started" hint="For example 2023-06 or Jun 2023" value={job.startDate ?? ""} onChange={(event) => patchJob(index, { startDate: event.target.value })} />
                <TextField label="Ended" hint="Write Present if you still work there" value={job.endDate ?? ""} onChange={(event) => patchJob(index, { endDate: event.target.value })} />
              </div>
              <TextAreaField label="What you did" hint="One short point per line." rows={3} value={joinLines(job.responsibilities)} onChange={(event) => patchJob(index, { responsibilities: lines(event.target.value) })} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="study-heading">
        <div className="panel__head">
          <h2 id="study-heading">Education</h2>
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setDraft({ ...draft, education: [...draft.education, { institution: "", degree: "", field: "", startDate: "", endDate: "" }] })}>
            Add education
          </Button>
        </div>
        <div className="panel__body">
          {draft.education.length === 0 && <p className="muted">No education listed.</p>}
          {draft.education.map((school, index) => (
            <div key={index} className="repeat">
              <div className="repeat__head">
                <strong>{school.degree || school.institution || `Education ${index + 1}`}</strong>
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} aria-hidden="true" />} aria-label={`Remove ${school.degree || `education ${index + 1}`}`} onClick={() => setDraft({ ...draft, education: draft.education.filter((_, i) => i !== index) })}>
                  Remove
                </Button>
              </div>
              <div className="form-row">
                <TextField label="Qualification" value={school.degree ?? ""} onChange={(event) => patchSchool(index, { degree: event.target.value })} />
                <TextField label="Field of study" optional value={school.field ?? ""} onChange={(event) => patchSchool(index, { field: event.target.value })} />
              </div>
              <TextField label="School, college or university" value={school.institution ?? ""} onChange={(event) => patchSchool(index, { institution: event.target.value })} />
              <div className="form-row">
                <TextField label="Started" optional value={school.startDate ?? ""} onChange={(event) => patchSchool(index, { startDate: event.target.value })} />
                <TextField label="Finished" optional value={school.endDate ?? ""} onChange={(event) => patchSchool(index, { endDate: event.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="extra-heading">
        <div className="panel__head">
          <h2 id="extra-heading">Certificates and achievements</h2>
        </div>
        <div className="panel__body">
          <TextAreaField label="Certificates" optional hint="One per line." rows={3} value={joinLines(draft.certifications)} onChange={(event) => setDraft({ ...draft, certifications: lines(event.target.value) })} />
          <TextAreaField
            label="Awards and achievements"
            optional
            hint="One per line. Only things you actually achieved: they can appear in your cover letters."
            rows={3}
            value={joinLines(draft.achievements.map((item) => item.description))}
            onChange={(event) => setDraft({ ...draft, achievements: lines(event.target.value).map((description) => ({ description })) })}
          />
        </div>
      </section>

      {save.isError && <Alert kind="bad" title="Your changes could not be saved">{messageOf(save.error)}</Alert>}

      <div className="savebar" role="region" aria-label="Save changes">
        <span className={dirty ? undefined : "muted"}>{dirty ? "You have unsaved changes." : "Everything is saved."}</span>
        <div className="action-bar">
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(structuredClone(original))}>
              Discard changes
            </Button>
          )}
          <Button type="submit" variant="primary" busy={save.isPending} disabled={!dirty}>
            Save profile
          </Button>
          {!dirty && (
            <Button variant="secondary" onClick={() => navigate("/")}>
              Back to matches
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function SkillsEditor({ skills, onChange }: { skills: string[]; onChange: (skills: string[]) => void }) {
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const incoming = raw.split(/[,;\n]/).map(clean).filter(Boolean);
    if (incoming.length === 0) return;

    const known = new Set(skills.map((skill) => skill.toLowerCase()));
    onChange([...skills, ...incoming.filter((skill) => !known.has(skill.toLowerCase()))]);
    setText("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault(); // Enter must not submit the whole profile form
      add(text);
    } else if (event.key === "Backspace" && !text && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  };

  return (
    <div className="stack" style={{ gap: "var(--s-3)" }}>
      {skills.length > 0 ? (
        <ul className="chips" aria-label="Your skills">
          {skills.map((skill) => (
            <li key={skill} className="chip">
              {skill}
              <button type="button" className="chip__remove" onClick={() => onChange(skills.filter((item) => item !== skill))} aria-label={`Remove ${skill}`}>
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No skills yet. Add the tools, languages and abilities you want to be matched on.</p>
      )}

      <TextField
        label="Add a skill"
        hint="Press Enter after each one, or paste a comma-separated list."
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(text)}
        autoComplete="off"
      />
    </div>
  );
}
