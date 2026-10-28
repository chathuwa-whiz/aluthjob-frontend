import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Profile } from "../api/types";
import { analysis, application, CANDIDATE, fakeApi, frames, job, MAILBOX, match, PROFILE, renderApp, signedIn } from "../test/harness";
import { checkResumeFile, normalizeProfile } from "../lib/resumeProfile";

const pdf = (name = "cv.pdf") => new File(["%PDF-1.4 cv"], name, { type: "application/pdf" });

describe("resume file checks", () => {
  it("accepts PDF and Word files, whatever the capitalisation", () => {
    for (const name of ["cv.pdf", "CV.PDF", "cv.doc", "cv.docx", "My CV.DocX"]) expect(checkResumeFile(new File(["x"], name)), name).toBeNull();
  });

  it("explains what is wrong with anything else before a slow upload starts", () => {
    expect(checkResumeFile(new File(["x"], "cv.txt"))).toMatch(/PDF or Word/);
    expect(checkResumeFile(new File(["x"], "cv.pdf.exe"))).toMatch(/PDF or Word/);
    expect(checkResumeFile(new File([], "cv.pdf"))).toMatch(/empty/);

    const big = new File(["x"], "cv.pdf");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    expect(checkResumeFile(big)).toMatch(/larger than 5 MB/);
  });
});

describe("normalizeProfile", () => {
  it("trims, turns empty boxes into null, drops blank entries, and removes duplicate skills", () => {
    const messy: Profile = {
      personalInfo: { fullName: "  Ama  ", email: "", phone: "   ", location: "Colombo", linkedin: null, portfolio: "" },
      skills: ["React", " react ", "Node.js", "", "  "],
      education: [{ institution: "", degree: "", field: null, startDate: "", endDate: "" }, { institution: " SLIIT ", degree: "BSc", field: "", startDate: "2022", endDate: "" }],
      experience: [{ company: "", position: "", startDate: "", endDate: "", responsibilities: ["", "  "] }, { company: "Acme", position: " Dev ", startDate: "2023", endDate: "Present", responsibilities: [" built things ", ""] }],
      certifications: ["AWS", "", "  "],
      achievements: [{ description: "  Won a prize " }, { description: "" }],
    };

    expect(normalizeProfile(messy)).toEqual({
      personalInfo: { fullName: "Ama", email: null, phone: null, location: "Colombo", linkedin: null, portfolio: null },
      skills: ["React", "react", "Node.js"].slice(0, 1).concat(["react", "Node.js"]),
      education: [{ institution: "SLIIT", degree: "BSc", field: null, startDate: "2022", endDate: null }],
      experience: [{ company: "Acme", position: "Dev", startDate: "2023", endDate: "Present", responsibilities: ["built things"] }],
      certifications: ["AWS"],
      achievements: [{ description: "Won a prize" }],
    });
  });
});

describe("resume page", () => {
  const READ = { candidateId: 7, profile: PROFILE, metadata: { fileName: "cv.pdf", extractedCharacters: 3420, processedAt: "2026-10-24T00:00:00.000Z" } };
  const profileRoute = { "GET /candidates/7": { data: { ...CANDIDATE, mimeType: "application/pdf", profile: PROFILE } } };

  it("shows what is being done with the CV, how far along it is and the time, then what was found for checking", async () => {
    let uploaded = false;
    let current: ReturnType<typeof analysis> | null = null;
    const api = fakeApi(
      signedIn({
        ...profileRoute,
        "GET /candidates": () => ({ data: uploaded ? [CANDIDATE] : [] }),
        "POST /resumes/analyze": () => {
          current = analysis({ phase: "reading", elapsedMs: 2_000 });
          return { status: 202, data: current };
        },
        "GET /resumes/analyze": () => ({ data: current }),
      }),
    );
    renderApp("/resume");

    await userEvent.upload(await screen.findByLabelText("CV file"), pdf());

    expect(await screen.findByRole("heading", { name: "Reading your CV" })).toBeInTheDocument();
    expect(screen.getByText("cv.pdf")).toBeInTheDocument();

    // what the server has worked out so far
    current = analysis({ phase: "understanding", elapsedMs: 20_000, characters: 3420, links: 2, skills: 12, writing: 0.4 });
    expect(await screen.findByText("Working out your skills, jobs and education")).toBeInTheDocument();
    expect(screen.getByText("3,420 characters")).toBeInTheDocument();
    expect(screen.getByText("Skills found").nextSibling).toHaveTextContent("12");
    expect(screen.getByText("about 40%")).toBeInTheDocument();
    expect(screen.getByText("Understand your experience").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Read the text").closest("li")).toHaveClass("track__step--done");
    expect(screen.getByRole("progressbar", { name: "Reading your CV" })).toHaveAttribute("aria-valuenow", "45");

    uploaded = true;
    current = analysis({ status: "done", phase: "done", elapsedMs: 41_000, characters: 3420, skills: 12, writing: 1, result: READ });
    expect(await screen.findByText("We have read your CV")).toBeInTheDocument();
    expect(await screen.findByLabelText("Full name")).toHaveValue("Ama Perera");
    expect(screen.queryByRole("heading", { name: "Reading your CV" })).not.toBeInTheDocument();
    expect(api.called("POST", "/resumes/analyze")[0]!.form!.get("resume")).toBeInstanceOf(File);
  });

  it("says so when the same CV was read before", async () => {
    let current: ReturnType<typeof analysis> | null = null;
    fakeApi(
      signedIn({
        ...profileRoute,
        "POST /resumes/analyze": () => {
          current = analysis({ phase: "understanding", reused: true, characters: 3420, skills: 12 });
          return { status: 202, data: current };
        },
        "GET /resumes/analyze": () => ({ data: current }),
      }),
    );
    renderApp("/resume");

    await userEvent.upload(await screen.findByLabelText("CV file"), pdf());

    expect(await screen.findByText("You uploaded this CV before, so there is nothing new to read")).toBeInTheDocument();
    current = analysis({ status: "done", phase: "done", reused: true, result: READ });
    expect(await screen.findByText("We have read your CV")).toBeInTheDocument();
  });

  it("shows the reason when the server could not read the CV", async () => {
    fakeApi(
      signedIn({
        ...profileRoute,
        "POST /resumes/analyze": { status: 202, data: analysis() },
        "GET /resumes/analyze": frames(analysis({ phase: "reading" }), analysis({ status: "failed", phase: "failed", error: "This CV could not be read. Check that it is a text-based PDF or Word file, then try again" })),
      }),
    );
    renderApp("/resume");

    await userEvent.upload(await screen.findByLabelText("CV file"), pdf());

    expect(await screen.findByText("That CV could not be used")).toBeInTheDocument();
    expect(screen.getByText(/text-based PDF or Word file/)).toBeInTheDocument();
    expect(screen.queryByText("We have read your CV")).not.toBeInTheDocument();
  });

  it("follows a CV that is still being read when the person returns to the page", async () => {
    let current = analysis({ phase: "understanding", fileName: "ama-cv.pdf", skills: 9, writing: 0.2 });
    const api = fakeApi(
      signedIn({
        ...profileRoute,
        "GET /resumes/analyze": () => ({ data: current }),
      }),
    );
    renderApp("/resume");

    expect(await screen.findByRole("heading", { name: "Reading your CV" })).toBeInTheDocument();
    expect(screen.getByText("ama-cv.pdf")).toBeInTheDocument();
    current = analysis({ status: "done", phase: "done", fileName: "ama-cv.pdf", result: READ });
    expect(await screen.findByText("We have read your CV")).toBeInTheDocument();
    expect(api.called("POST", "/resumes/analyze")).toHaveLength(0);
  });

  it("does not announce an old finished reading as if it were new", async () => {
    fakeApi(signedIn({ ...profileRoute, "GET /resumes/analyze": { data: analysis({ status: "done", phase: "done", result: READ }) } }));
    renderApp("/resume");

    await screen.findByLabelText("Full name");
    expect(screen.queryByText("We have read your CV")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reading your CV" })).not.toBeInTheDocument();
  });

  it("refuses an unusable file without contacting the server", async () => {
    const api = fakeApi(signedIn({ "GET /candidates/7": { data: { ...CANDIDATE, mimeType: "application/pdf", profile: PROFILE } } }));
    renderApp("/resume");

    const input = await screen.findByLabelText("CV file");
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });

    expect(await screen.findByText(/PDF or Word document/)).toBeInTheDocument();
    expect(api.called("POST", "/resumes/analyze")).toHaveLength(0);
  });

  it("shows the server's reason when reading the CV fails", async () => {
    fakeApi(signedIn({ "GET /candidates/7": { data: { ...CANDIDATE, mimeType: "application/pdf", profile: PROFILE } }, "POST /resumes/analyze": { status: 400, message: "Only PDF and Word documents are allowed." } }));
    renderApp("/resume");

    await userEvent.upload(await screen.findByLabelText("CV file"), pdf());
    expect(await screen.findByText("Only PDF and Word documents are allowed.")).toBeInTheDocument();
  });

  describe("editing the profile", () => {
    const routes = (extra = {}) => signedIn({ "GET /candidates/7": { data: { ...CANDIDATE, mimeType: "application/pdf", profile: PROFILE } }, ...extra });

    it("shows what was extracted, and nothing is saved until the person says so", async () => {
      const api = fakeApi(routes());
      renderApp("/resume");

      expect(await screen.findByLabelText("Full name")).toHaveValue("Ama Perera");
      expect(screen.getByLabelText("Location")).toHaveValue("Colombo, Sri Lanka");
      expect(screen.getByLabelText("Job title")).toHaveValue("Full Stack Developer Intern");
      expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
      expect(screen.getByText("Everything is saved.")).toBeInTheDocument();
      expect(api.called("PUT", "/candidates/7/profile")).toHaveLength(0);
    });

    it("adds skills with Enter without submitting the form, and removes them with the x", async () => {
      const api = fakeApi(routes());
      renderApp("/resume");

      const box = await screen.findByLabelText("Add a skill");
      await userEvent.type(box, "TypeScript{Enter}");
      expect(within(screen.getByRole("list", { name: "Your skills" })).getByText("TypeScript")).toBeInTheDocument();
      expect(api.called("PUT", "/candidates/7/profile")).toHaveLength(0);

      await userEvent.type(box, "Docker, Python{Enter}");
      expect(screen.getByText("Docker")).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Remove React" }));
      expect(screen.queryByText("React")).not.toBeInTheDocument();
      expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
    });

    it("does not add a skill twice, whatever its capitalisation", async () => {
      fakeApi(routes());
      renderApp("/resume");

      await userEvent.type(await screen.findByLabelText("Add a skill"), "REACT{Enter}");
      expect(within(screen.getByRole("list", { name: "Your skills" })).getAllByRole("listitem")).toHaveLength(2);
    });

    it("saves exactly the cleaned profile", async () => {
      const api = fakeApi(routes({ "PUT /candidates/7/profile": { data: { ...CANDIDATE, mimeType: "application/pdf", profile: PROFILE } } }));
      renderApp("/resume");

      await userEvent.type(await screen.findByLabelText("Add a skill"), "TypeScript{Enter}");
      await userEvent.clear(screen.getByLabelText("Phone"));
      await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

      expect(await screen.findByText("Profile saved. Search again to refresh your matches.")).toBeInTheDocument();
      const sent = api.called("PUT", "/candidates/7/profile")[0]!.body as Profile;
      expect(sent.skills).toEqual(["React", "Node.js", "TypeScript"]);
      expect(sent.personalInfo.phone).toBeNull();
      expect(sent.personalInfo.linkedin).toBeNull();
      expect(sent.experience[0]!.responsibilities).toEqual(["Built web apps"]);
    });

    it("can add and remove a job, and can discard changes", async () => {
      fakeApi(routes());
      renderApp("/resume");

      await userEvent.click(await screen.findByRole("button", { name: "Add a job" }));
      const titles = screen.getAllByLabelText("Job title");
      expect(titles).toHaveLength(2);
      // a blank job is not a change worth saving; typing into it is
      expect(screen.queryByRole("button", { name: /Discard changes/ })).not.toBeInTheDocument();
      await userEvent.type(titles[1]!, "Support Engineer");

      await userEvent.click(screen.getByRole("button", { name: /Discard changes/ }));
      expect(screen.getAllByLabelText("Job title")).toHaveLength(1);

      await userEvent.click(screen.getByRole("button", { name: /Remove Full Stack Developer Intern/ }));
      expect(screen.queryByLabelText("Job title")).not.toBeInTheDocument();
      expect(screen.getByText(/No jobs listed/)).toBeInTheDocument();
    });

    it("tells the person when saving fails and keeps their edits", async () => {
      fakeApi(routes({ "PUT /candidates/7/profile": { status: 400, message: "Invalid input: expected array" } }));
      renderApp("/resume");

      await userEvent.type(await screen.findByLabelText("Add a skill"), "Go{Enter}");
      await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

      expect(await screen.findByText("Your changes could not be saved")).toBeInTheDocument();
      expect(screen.getByText("Go")).toBeInTheDocument();
    });
  });

  it("lets the person choose which of several CVs to work with, and remembers it", async () => {
    const second = { id: 8, fileName: "design-cv.pdf", fullName: "Ama P. (design)", createdAt: "2026-10-22T00:00:00.000Z", updatedAt: "2026-10-22T00:00:00.000Z" };
    fakeApi(
      signedIn({
        "GET /candidates": { data: [CANDIDATE, second] },
        "GET /candidates/7": { data: { ...CANDIDATE, mimeType: "application/pdf", profile: PROFILE } },
        "GET /candidates/8": { data: { ...second, mimeType: "application/pdf", profile: { ...PROFILE, personalInfo: { ...PROFILE.personalInfo, fullName: "Ama P. (design)" } } } },
        "GET /candidates/8/matches": { data: [] },
        "GET /candidates/8/applications": { data: [] },
        "GET /candidates/8/mail-account": { status: 404, message: "No mailbox connected" },
      }),
    );
    renderApp("/resume");

    const group = await screen.findByRole("group", { name: "Which CV should we use?" });
    expect(within(group).getByRole("radio", { name: /Ama Perera/ })).toBeChecked();

    await userEvent.click(within(group).getByRole("radio", { name: /Ama P\. \(design\)/ }));
    expect(await screen.findByLabelText("Full name")).toHaveValue("Ama P. (design)");
    expect(window.localStorage.getItem("aj.activeResume.1")).toBe("8");
    expect(within(group).getAllByRole("link", { name: /Download/ })[0]).toHaveAttribute("href", "/api/v1/candidates/7/resume");
  });
});

describe("mailbox page", () => {
  it("asks for what the provider needs: an app password for Gmail, with instructions", async () => {
    fakeApi(signedIn());
    renderApp("/mailbox");

    await userEvent.clear(await screen.findByLabelText("Email address"));
    await userEvent.type(screen.getByLabelText("Email address"), "ama@gmail.com");

    expect(screen.getByLabelText("App password")).toBeInTheDocument();
    expect(screen.getByText(/It is not your normal Gmail password/)).toBeInTheDocument();
    // the walkthrough follows the address and is already open for someone connecting for the first time
    expect(screen.getByRole("tab", { name: "Gmail" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: /Open app passwords/ })).toHaveAttribute("href", "https://myaccount.google.com/apppasswords");
    expect(screen.queryByLabelText("Server")).not.toBeInTheDocument();
  });

  it("connects, sending only what the server needs, and then shows the mailbox as connected", async () => {
    let connected = false;
    const api = fakeApi(
      signedIn({
        "GET /candidates/7/mail-account": () => (connected ? { data: MAILBOX } : { status: 404, message: "No mailbox connected" }),
        "PUT /candidates/7/mail-account": () => {
          connected = true;
          return { data: MAILBOX };
        },
      }),
    );
    renderApp("/mailbox");

    await userEvent.clear(await screen.findByLabelText("Email address"));
    await userEvent.type(screen.getByLabelText("Email address"), "ama@gmail.com");
    await userEvent.type(screen.getByLabelText("App password"), "abcd efgh ijkl mnop");
    await userEvent.click(screen.getByRole("button", { name: "Check login and connect" }));

    expect(await screen.findByRole("heading", { name: "Connected" })).toBeInTheDocument();
    expect(api.called("PUT", "/candidates/7/mail-account")[0]!.body).toEqual({ email: "ama@gmail.com", password: "abcdefghijklmnop", fromName: "Ama Perera" }); // the spaces Google prints are dropped
    expect(screen.getByText("smtp.gmail.com:465")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("abcd efgh ijkl mnop")).not.toBeInTheDocument();
  });

  it("asks for the mail server when the provider is not one we know", async () => {
    const api = fakeApi(signedIn({ "PUT /candidates/7/mail-account": { data: MAILBOX } }));
    renderApp("/mailbox");

    await userEvent.clear(await screen.findByLabelText("Email address"));
    await userEvent.type(screen.getByLabelText("Email address"), "ama@small-company.lk");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");

    expect(screen.getByRole("button", { name: "Check login and connect" })).toBeDisabled(); // no server yet
    await userEvent.type(screen.getByLabelText("Server"), "mail.small-company.lk");
    await userEvent.click(screen.getByRole("button", { name: "Check login and connect" }));

    await screen.findByRole("heading", { name: /Change mailbox|Connected|Connect your mailbox/ });
    expect(api.called("PUT", "/candidates/7/mail-account")[0]!.body).toMatchObject({ email: "ama@small-company.lk", host: "mail.small-company.lk", port: 587, secure: false });
  });

  it("explains a refused login in the server's words, without losing what was typed", async () => {
    fakeApi(signedIn({ "PUT /candidates/7/mail-account": { status: 409, message: "The mail server rejected the login. For Gmail and similar services use an app password, not your normal password" } }));
    renderApp("/mailbox");

    await userEvent.clear(await screen.findByLabelText("Email address"));
    await userEvent.type(screen.getByLabelText("Email address"), "ama@gmail.com");
    await userEvent.type(screen.getByLabelText("App password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Check login and connect" }));

    expect(await screen.findByText("We could not log in to that mailbox")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/app password, not your normal password/);
    expect(screen.getByLabelText("Email address")).toHaveValue("ama@gmail.com");
  });

  it("disconnects only after a confirmation", async () => {
    const api = fakeApi(signedIn({ "GET /candidates/7/mail-account": { data: MAILBOX }, "DELETE /candidates/7/mail-account": { data: { removed: true } } }));
    renderApp("/mailbox");

    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    expect(api.called("DELETE", "/candidates/7/mail-account")).toHaveLength(0);
    expect(screen.getByText("Disconnect this mailbox?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Yes, disconnect" }));
    expect(await screen.findByText("Mailbox disconnected")).toBeInTheDocument();
    expect(api.called("DELETE", "/candidates/7/mail-account")).toHaveLength(1);
  });

  it("explains how the password is handled", async () => {
    fakeApi(signedIn());
    renderApp("/mailbox");

    expect(await screen.findByText(/store it encrypted, and use it only to send applications you have approved/)).toBeInTheDocument();
  });
});

describe("applications page", () => {
  const approved = match({ id: 3, status: "approved", coverLetter: "x", job: job({ id: 3, title: "Backend Engineer", company: "Beta Ltd", applyEmail: "jobs@beta.lk" }) });
  const sent = match({ id: 4, status: "approved", job: job({ id: 4, title: "QA Engineer", company: "Gamma" }) });
  const broken = match({ id: 5, status: "approved", job: job({ id: 5, title: "Data Engineer", company: "Delta" }) });

  const routes = (extra = {}) =>
    signedIn({
      "GET /candidates/7/matches": { data: [approved, sent, broken] },
      "GET /candidates/7/applications": {
        data: [
          application({ id: 1, matchId: 4, status: "sent", sentAt: "2026-10-23T10:00:00.000Z", toEmail: "hr@gamma.lk" }),
          application({ id: 2, matchId: 5, status: "failed", error: "The mail server rejected the login.", toEmail: "hr@delta.lk" }),
          application({ id: 3, matchId: 6, status: "queued", toEmail: "hr@eps.lk" }),
        ],
      },
      ...extra,
    });

  it("lists approved matches that are ready to send, separately from what is already going out", async () => {
    fakeApi(routes());
    renderApp("/applications");

    const ready = (await screen.findByRole("heading", { name: "Approved and ready to send" })).closest("section") as HTMLElement;
    expect(within(ready).getByText("Backend Engineer")).toBeInTheDocument();
    expect(within(ready).getByText(/jobs@beta.lk/)).toBeInTheDocument();
    expect(within(ready).getByRole("button", { name: "Send all 1" })).toBeInTheDocument();
    expect(within(ready).queryByText("QA Engineer")).not.toBeInTheDocument(); // already sent
  });

  it("names each application by its job and says how it went", async () => {
    fakeApi(routes());
    renderApp("/applications");

    const sentRow = (await screen.findByRole("link", { name: "QA Engineer" })).closest(".app-row") as HTMLElement;
    expect(sentRow).toHaveTextContent("Gamma · to hr@gamma.lk");
    expect(sentRow).toHaveTextContent("Sent");

    const failedRow = screen.getByRole("link", { name: "Data Engineer" }).closest(".app-row") as HTMLElement;
    expect(failedRow).toHaveTextContent("The mail server rejected the login.");
    expect(within(failedRow).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("queues everything that is ready, and explains anything that could not be queued", async () => {
    const api = fakeApi(
      routes({
        "POST /candidates/7/applications/queue": {
          status: 202,
          data: { queued: [application({ id: 9, matchId: 3 })], skipped: [{ matchId: 11, title: "Closed Role", reason: "This vacancy has already closed" }] },
        },
      }),
    );
    renderApp("/applications");

    await userEvent.click(await screen.findByRole("button", { name: "Send all 1" }));

    expect(await screen.findByText("1 approved match was not queued")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Closed Role" })).toHaveAttribute("href", "/matches/11");
    expect(screen.getByText(/This vacancy has already closed/)).toBeInTheDocument();
    expect(api.called("POST", "/candidates/7/applications/queue")).toHaveLength(1);
  });

  it("cancels a waiting application and retries a failed one", async () => {
    const api = fakeApi(
      routes({
        "POST /applications/3/cancel": { data: application({ id: 3, status: "cancelled" }) },
        "POST /applications/2/retry": { data: application({ id: 2, status: "queued" }) },
      }),
    );
    renderApp("/applications");

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(api.called("POST", "/applications/3/cancel")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(api.called("POST", "/applications/2/retry")).toHaveLength(1);
  });

  it("teaches what to do when nothing has been sent yet", async () => {
    fakeApi(signedIn());
    renderApp("/applications");

    expect(await screen.findByRole("heading", { name: "No applications yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review your matches" })).toHaveAttribute("href", "/");
  });
});

describe("account page", () => {
  it("catches a password mismatch before asking the server", async () => {
    const api = fakeApi(signedIn());
    renderApp("/account");

    await userEvent.type(await screen.findByLabelText("Current password"), "old-password-here");
    await userEvent.type(screen.getByLabelText("New password"), "fresh-maple-orbit-77");
    await userEvent.type(screen.getByLabelText("Type the new password again"), "fresh-maple-orbit-78");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText(/not the same/i, { selector: ".field__error span" })).toBeInTheDocument();
    expect(api.called("POST", "/auth/change-password")).toHaveLength(0);
  });

  it("changes the password and clears the boxes", async () => {
    const api = fakeApi(signedIn({ "POST /auth/change-password": { data: { changed: true } } }));
    renderApp("/account");

    await userEvent.type(await screen.findByLabelText("Current password"), "old-password-here");
    await userEvent.type(screen.getByLabelText("New password"), "fresh-maple-orbit-77");
    await userEvent.type(screen.getByLabelText("Type the new password again"), "fresh-maple-orbit-77");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText(/Password changed. Other devices were signed out./)).toBeInTheDocument();
    expect(api.called("POST", "/auth/change-password")[0]!.body).toEqual({ currentPassword: "old-password-here", newPassword: "fresh-maple-orbit-77" });
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("shows the server's reason when the current password is wrong", async () => {
    fakeApi(signedIn({ "POST /auth/change-password": { status: 401, message: "Incorrect password" } }));
    renderApp("/account");

    await userEvent.type(await screen.findByLabelText("Current password"), "nope");
    await userEvent.type(screen.getByLabelText("New password"), "fresh-maple-orbit-77");
    await userEvent.type(screen.getByLabelText("Type the new password again"), "fresh-maple-orbit-77");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password");
  });

  it("shows the email-update settings and saves a change", async () => {
    const api = fakeApi(
      signedIn({
        "PUT /alerts/preferences": { data: { frequency: "weekly", minScore: 55, pausedUntil: null, lastSentAt: null } },
      }),
    );
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: "Email updates about new jobs" })).toBeInTheDocument();
    expect(await screen.findByRole("radio", { name: /Daily/ })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: /Weekly/ }));

    await waitFor(() => expect(screen.getByRole("radio", { name: /Weekly/ })).toBeChecked());
    expect(api.called("PUT", "/alerts/preferences")[0]!.body).toEqual({ frequency: "weekly" });
  });

  it("hides the match strength and pause controls once emails are switched off", async () => {
    fakeApi(signedIn({ "GET /alerts/preferences": { data: { frequency: "off", minScore: 55, pausedUntil: null, lastSentAt: null } } }));
    renderApp("/account");

    expect(await screen.findByRole("radio", { name: /Never/ })).toBeChecked();
    expect(screen.queryByLabelText("Which matches")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause for 7 days" })).not.toBeInTheDocument();
  });

  it("deletes the account only after a password and an explicit acknowledgement, then returns to sign-in", async () => {
    const api = fakeApi(signedIn({ "DELETE /auth/account": { data: { deleted: true } }, "POST /auth/logout": { data: { signedOut: true } } }));
    renderApp("/account");

    await userEvent.click(await screen.findByRole("button", { name: "Delete my account…" }));
    const submit = screen.getByRole("button", { name: "Delete everything" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Confirm with your password"), "my-password-here");
    expect(submit).toBeDisabled(); // still needs the acknowledgement
    await userEvent.click(screen.getByLabelText(/I understand that all my data will be deleted for good/));
    expect(submit).toBeEnabled();

    await userEvent.click(submit);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(api.called("DELETE", "/auth/account")[0]!.body).toEqual({ password: "my-password-here" });
  });

  it("does not delete anything when cancelled", async () => {
    const api = fakeApi(signedIn());
    renderApp("/account");

    await userEvent.click(await screen.findByRole("button", { name: "Delete my account…" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete my account…" })).toBeInTheDocument();
    expect(api.called("DELETE", "/auth/account")).toHaveLength(0);
  });
});
