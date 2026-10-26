import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { application, fakeApi, job, LETTER, MAILBOX, match, preview, renderApp, signedIn, withLetter } from "../test/harness";

/** A match screen with every route it needs; tests override what they are about. */
const screenFor = (current: ReturnType<typeof match>, overrides = {}) =>
  fakeApi(
    signedIn({
      [`GET /matches/${current.id}`]: { data: current },
      [`GET /matches/${current.id}/email-preview`]: { data: preview() },
      "GET /candidates/7/mail-account": { data: MAILBOX },
      ...overrides,
    }),
  );

describe("match page: reading the job", () => {
  it("shows why it matched, the skills it asks for, and how the score is made", async () => {
    screenFor(match({ details: { breakdown: { skills: 0.8, title: 0.6, content: 0.5, experience: 0.7, location: 1 }, matchedSkills: ["React", "Node.js"], reasons: ["Ad mentions 2 of your skills: React, Node.js"], warnings: ["Asks for about 2 years of experience; your resume shows 0.6 in related work"] } }));
    renderApp("/matches/1");

    expect(await screen.findByRole("heading", { level: 1, name: "Full Stack Developer" })).toBeInTheDocument();
    const aside = screen.getByRole("complementary", { name: "About this job" });
    expect(within(aside).getByText("Ad mentions 2 of your skills: React, Node.js")).toBeInTheDocument();
    expect(within(aside).getByText("Node.js")).toBeInTheDocument();
    expect(within(aside).getByText(/Asks for about 2 years/)).toBeInTheDocument();
    expect(within(aside).getByText("Skills: 80 percent")).toBeInTheDocument();
    expect(within(aside).getByText(/It is a guide, not a promise/)).toBeInTheDocument();
  });

  it("is honest that TopJobs text was read from a picture", async () => {
    screenFor(match({ job: job({ source: "topjobs", description: "Purchasing Executive. Source suppliers." }) }));
    renderApp("/matches/1");

    expect(await screen.findByText(/read from the picture automatically, so it may contain mistakes/i)).toBeInTheDocument();
  });

  it("links to the original advert, but never to an address that is not plain http(s)", async () => {
    screenFor(match({ job: job({ url: "https://rooster.jobs/jobs/10" }) }));
    const first = renderApp("/matches/1");
    expect(await screen.findByRole("link", { name: /Read the original advert/ })).toHaveAttribute("href", "https://rooster.jobs/jobs/10");
    expect(screen.getByRole("link", { name: /Read the original advert/ })).toHaveAttribute("rel", "noopener noreferrer");
    first.unmount();

    screenFor(match({ job: job({ url: "javascript:alert(document.cookie)" }) }));
    renderApp("/matches/1");
    await screen.findByRole("heading", { level: 1, name: "Full Stack Developer" });
    expect(screen.queryByRole("link", { name: /original advert/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it("tells the person when the match no longer exists", async () => {
    fakeApi(signedIn({ "GET /matches/99": { status: 404, message: "Match not found" } }));
    renderApp("/matches/99");

    expect(await screen.findByRole("heading", { name: "We cannot find that match" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to matches" })).toHaveAttribute("href", "/");
  });
});

describe("match page: the cover letter", () => {
  it("offers to write a letter when there is none, with an honest wait notice, and then shows it for editing", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => (finish = resolve));
    const api = screenFor(match(), {
      "POST /matches/1/cover-letter": async () => {
        await pending;
        return { data: withLetter() };
      },
    });
    renderApp("/matches/1");

    await userEvent.click(await screen.findByRole("button", { name: "Write the letter" }));
    expect(await screen.findByText("Writing your letter")).toBeInTheDocument();
    expect(screen.getByText(/does not see the advert, so it cannot invent duties/i)).toBeInTheDocument();

    finish();
    expect(await screen.findByLabelText("Letter")).toHaveValue(LETTER);
    expect(screen.getByLabelText("Email subject")).toHaveValue("Application for Full Stack Developer - Ama Perera");
    expect(api.called("POST", "/matches/1/cover-letter")).toHaveLength(1);
  });

  it("reports a failed draft in words and leaves the page usable", async () => {
    screenFor(match(), { "POST /matches/1/cover-letter": { status: 503, message: "Request failed" } });
    renderApp("/matches/1");

    await userEvent.click(await screen.findByRole("button", { name: "Write the letter" }));
    expect(await screen.findByText("The letter could not be written")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write the letter" })).toBeInTheDocument();
  });

  it("saves edits trimmed, and shows that there is something unsaved until then", async () => {
    const api = screenFor(withLetter(), { "PATCH /matches/1": { data: withLetter({ coverLetter: "Dear Sir,\n\nEdited.", updatedAt: "2026-10-24T02:00:00.000Z" }) } });
    renderApp("/matches/1");

    const box = await screen.findByLabelText("Letter");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await userEvent.clear(box);
    await userEvent.type(box, "  Dear Sir,{Enter}{Enter}Edited.  ");
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(api.called("PATCH", "/matches/1")[0]!.body).toEqual({ subject: "Application for Full Stack Developer - Ama Perera", coverLetter: "Dear Sir,\n\nEdited." });
  });

  it("will not save an empty letter", async () => {
    screenFor(withLetter());
    renderApp("/matches/1");

    await userEvent.clear(await screen.findByLabelText("Letter"));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("asks before a new draft replaces unsaved edits", async () => {
    const api = screenFor(withLetter(), { "POST /matches/1/cover-letter": { data: withLetter({ coverLetter: "Fresh draft." }) } });
    renderApp("/matches/1");

    await userEvent.type(await screen.findByLabelText("Letter"), " my own words");
    await userEvent.click(screen.getByRole("button", { name: /Write a new draft/ }));

    expect(await screen.findByText("Replace your edits?")).toBeInTheDocument();
    expect(api.called("POST", "/matches/1/cover-letter")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Keep my edits" }));
    expect(screen.queryByText("Replace your edits?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Letter")).toHaveValue(`${LETTER} my own words`);

    await userEvent.click(screen.getByRole("button", { name: /Write a new draft/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Yes, write a new draft" }));
    expect(await screen.findByLabelText("Letter")).toHaveValue("Fresh draft.");
  });

  it("writes a new draft straight away when nothing has been edited", async () => {
    const api = screenFor(withLetter(), { "POST /matches/1/cover-letter": { data: withLetter({ coverLetter: "Another draft." }) } });
    renderApp("/matches/1");

    await userEvent.click(await screen.findByRole("button", { name: /Write a new draft/ }));
    expect(await screen.findByLabelText("Letter")).toHaveValue("Another draft.");
    expect(api.called("POST", "/matches/1/cover-letter")).toHaveLength(1);
  });
});

describe("match page: approving and sending", () => {
  it("shows the exact email that would be sent before anything can be approved", async () => {
    screenFor(withLetter());
    renderApp("/matches/1");

    expect(await screen.findByText("This is exactly what will be sent")).toBeInTheDocument();
    expect(screen.getByText("Ama Perera <ama@gmail.com>")).toBeInTheDocument();
    expect(screen.getByText("careers@acme.lk")).toBeInTheDocument();
    expect(screen.getByText(/ama-cv.pdf \(151 KB\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve this letter" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Send application" })).not.toBeInTheDocument();
  });

  it("will not approve a letter that has unsaved edits, so what is approved is what is on screen", async () => {
    const api = screenFor(withLetter());
    renderApp("/matches/1");

    await userEvent.type(await screen.findByLabelText("Letter"), " plus a change");

    expect(await screen.findByText("Save your changes first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve this letter" })).toBeDisabled();
    expect(api.called("POST", "/matches/1/approve")).toHaveLength(0);
  });

  it("approves, then offers Send, and queues it only when asked", async () => {
    let status: "suggested" | "approved" = "suggested";
    const api = screenFor(withLetter(), {
      "GET /matches/1": () => ({ data: withLetter({ status }) }),
      "POST /matches/1/approve": () => {
        status = "approved";
        return { data: withLetter({ status: "approved" }) };
      },
      "POST /matches/1/send": { status: 202, data: application() },
    });
    renderApp("/matches/1");

    await userEvent.click(await screen.findByRole("button", { name: "Approve this letter" }));
    const send = await screen.findByRole("button", { name: "Send application" });
    expect(api.called("POST", "/matches/1/send")).toHaveLength(0);
    expect(screen.getByText("Nothing is sent until you press Send application.")).toBeInTheDocument();

    await userEvent.click(send);
    expect(await screen.findByText("Queued. It will be sent shortly.")).toBeInTheDocument();
    expect(api.called("POST", "/matches/1/send")).toHaveLength(1);
  });

  it("keeps Send switched off while the server lists reasons it cannot go out, and shows them", async () => {
    screenFor(withLetter({ status: "approved" }), { "GET /matches/1/email-preview": { data: preview({ problems: ["This vacancy has already closed"] }) } });
    renderApp("/matches/1");

    expect(await screen.findByText("Before this can be sent")).toBeInTheDocument();
    expect(screen.getByText("This vacancy has already closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send application" })).toBeDisabled();
  });

  it("sends the person to the mailbox page when none is connected", async () => {
    screenFor(withLetter({ status: "approved" }), {
      "GET /candidates/7/mail-account": { status: 404, message: "No mailbox connected" },
      "GET /matches/1/email-preview": { data: preview({ problems: ["Connect your mailbox first"] }) },
    });
    renderApp("/matches/1");

    const notice = (await screen.findByText("Connect your mailbox first")).closest(".alert") as HTMLElement;
    expect(within(notice).getByRole("link", { name: "Connect mailbox" })).toHaveAttribute("href", "/mailbox");
    expect(screen.getByRole("button", { name: "Send application" })).toBeDisabled();
  });

  it("lets a job be skipped", async () => {
    const api = screenFor(withLetter(), { "POST /matches/1/reject": { data: withLetter({ status: "rejected" }) } });
    renderApp("/matches/1");

    await userEvent.click(await screen.findByRole("button", { name: "Skip this job" }));
    expect(await screen.findByText("Skipped. You can find it under Skipped.")).toBeInTheDocument();
    expect(api.called("POST", "/matches/1/reject")).toHaveLength(1);
  });

  it("shows how an application is going once one exists, and no longer offers to approve it again", async () => {
    screenFor(withLetter({ status: "approved" }), { "GET /candidates/7/applications": { data: [application({ status: "sent", sentAt: "2026-10-24T03:00:00.000Z" })] } });
    renderApp("/matches/1");

    expect(await screen.findByText(/Sent to careers@acme.lk on/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send application" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve this letter" })).not.toBeInTheDocument();
  });

  it("says Sent at the top of the page once the application has gone out, not Approved", async () => {
    screenFor(withLetter({ status: "approved" }), { "GET /candidates/7/applications": { data: [application({ status: "sent", sentAt: "2026-10-24T03:00:00.000Z" })] } });
    renderApp("/matches/1");

    const header = (await screen.findByRole("heading", { level: 1 })).closest("header")!;
    expect(await within(header).findByText("Sent")).toBeInTheDocument();
    expect(within(header).queryByText("Approved")).not.toBeInTheDocument();
  });

  it("offers Send application again after a send, asks first, and then queues it as a second send", async () => {
    const api = screenFor(withLetter({ status: "approved" }), {
      "GET /candidates/7/applications": { data: [application({ status: "sent", sentAt: "2026-10-24T03:00:00.000Z" })] },
      "POST /matches/1/send": { status: 202, data: application({ status: "queued", sentAt: "2026-10-24T03:00:00.000Z" }) },
    });
    renderApp("/matches/1");

    await userEvent.click(await screen.findByRole("button", { name: "Send application again" }));

    // nothing is sent by that click alone
    expect(api.called("POST", "/matches/1/send")).toHaveLength(0);
    expect(await screen.findByText("Send this application again?")).toBeInTheDocument();
    expect(screen.getByText(/careers@acme.lk already received it on/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Yes, send it again" }));

    expect(await screen.findByText("Queued again. It will be sent shortly.")).toBeInTheDocument();
    expect(api.called("POST", "/matches/1/send")[0]!.body).toEqual({ again: true });
  });

  it("lets the person back out of sending again", async () => {
    const api = screenFor(withLetter({ status: "approved" }), { "GET /candidates/7/applications": { data: [application({ status: "sent", sentAt: "2026-10-24T03:00:00.000Z" })] } });
    renderApp("/matches/1");

    await userEvent.click(await screen.findByRole("button", { name: "Send application again" }));
    await userEvent.click(await screen.findByRole("button", { name: "Not now" }));

    expect(await screen.findByRole("button", { name: "Send application again" })).toBeInTheDocument();
    expect(api.called("POST", "/matches/1/send")).toHaveLength(0);
  });

  it("does not offer a second send while the application is still waiting or being sent", async () => {
    screenFor(withLetter({ status: "approved" }), { "GET /candidates/7/applications": { data: [application({ status: "queued" })] } });
    renderApp("/matches/1");

    expect(await screen.findByText("Waiting to send", { selector: ".alert__title" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send application/ })).not.toBeInTheDocument();
  });

  it("surfaces a failed delivery with the reason", async () => {
    screenFor(withLetter({ status: "approved" }), { "GET /candidates/7/applications": { data: [application({ status: "failed", error: "The mail server rejected the login." })] } });
    renderApp("/matches/1");

    expect(await screen.findByText("The mail server rejected the login.", { exact: false })).toBeInTheDocument();
  });
});

describe("match page: addresses read from a picture", () => {
  const pictureAddress = (extra = {}) =>
    preview({
      message: { addressSource: "image", addressConfirmed: false, verifyAt: "https://www.topjobs.lk/employer/JobAdvertismentServlet?jc=1", ...extra },
      problems: ["This address was read from a picture and may contain a misread character. Open the original advert, check it, then confirm the address"],
    });

  it("makes the person check it against the original advert and type it back, and withholds Send until they have", async () => {
    screenFor(withLetter({ status: "approved", job: job({ applyEmailSource: "image" }) }), { "GET /matches/1/email-preview": { data: pictureAddress() } });
    renderApp("/matches/1");

    expect(await screen.findByText("Check this address against the original advert")).toBeInTheDocument();
    expect(screen.getByText(/read this address automatically|so we read it automatically/i)).toBeInTheDocument();
    expect(screen.getAllByText("careers@acme.lk").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open the original advert/ })).toHaveAttribute("href", expect.stringContaining("topjobs.lk"));
    expect(screen.getByRole("button", { name: "Send application" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm address" })).toBeDisabled();
  });

  it("shows the server's complaint when the typed address is wrong", async () => {
    const api = screenFor(withLetter({ status: "approved" }), {
      "GET /matches/1/email-preview": { data: pictureAddress() },
      "POST /matches/1/confirm-address": { status: 409, message: "That does not match the address on file. Check the original advert and type the address exactly as printed there" },
    });
    renderApp("/matches/1");

    await userEvent.type(await screen.findByLabelText(/Type the address exactly/), "career@acme.lk");
    await userEvent.click(screen.getByRole("button", { name: "Confirm address" }));

    expect(await screen.findByText(/does not match the address on file/i)).toBeInTheDocument();
    expect(api.called("POST", "/matches/1/confirm-address")[0]!.body).toEqual({ address: "career@acme.lk" });
  });

  it("lets Send through once the address is confirmed", async () => {
    let confirmed = false;
    screenFor(withLetter({ status: "approved" }), {
      "GET /matches/1/email-preview": () => ({ data: confirmed ? preview({ message: { addressSource: "image", addressConfirmed: true } }) : pictureAddress() }),
      "POST /matches/1/confirm-address": () => {
        confirmed = true;
        return { data: withLetter({ status: "approved", confirmedEmail: "careers@acme.lk" }) };
      },
    });
    renderApp("/matches/1");

    await userEvent.type(await screen.findByLabelText(/Type the address exactly/), "careers@acme.lk");
    await userEvent.click(screen.getByRole("button", { name: "Confirm address" }));

    expect(await screen.findByText("Address confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Check this address against the original advert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send application" })).toBeEnabled();
  });

  it("never links to an unsafe 'original advert' address", async () => {
    screenFor(withLetter({ status: "approved" }), { "GET /matches/1/email-preview": { data: pictureAddress({ verifyAt: "javascript:alert(1)" }) } });
    renderApp("/matches/1");

    await screen.findByText("Check this address against the original advert");
    expect(screen.queryByRole("link", { name: /Open the original advert/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  });
});

describe("match page: jobs that take applications on their own site", () => {
  const portal = (overrides = {}) => match({ applyMethod: "portal", job: job({ applyEmail: null, applyEmailSource: null, applyUrl: "https://employer.example/apply" }), coverLetter: LETTER, subject: "s", ...overrides });

  it("says so, links to the employer's page, and offers to copy the letter", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    screenFor(portal());
    renderApp("/matches/1");

    expect(await screen.findByRole("heading", { name: "Apply on their site" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the advert/ })).toHaveAttribute("href", "https://employer.example/apply");
    expect(screen.queryByRole("button", { name: /Send application/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Copy the letter" }));
    expect(writeText).toHaveBeenCalledWith(LETTER);
    expect(await screen.findByText("Letter copied")).toBeInTheDocument();
  });

  it("falls back to the advert page when the apply link is unsafe, and shows no link at all when both are", async () => {
    screenFor(portal({ job: job({ applyEmail: null, applyEmailSource: null, applyUrl: "javascript:alert(1)", url: "https://rooster.jobs/jobs/10" }) }));
    const first = renderApp("/matches/1");
    expect(await screen.findByRole("link", { name: /Open the advert/ })).toHaveAttribute("href", "https://rooster.jobs/jobs/10");
    first.unmount();

    screenFor(portal({ job: job({ applyEmail: null, applyEmailSource: null, applyUrl: "javascript:alert(1)", url: "data:text/html,x" }) }));
    renderApp("/matches/1");
    await screen.findByRole("heading", { name: "Apply on their site" });
    expect(screen.queryByRole("link", { name: /Open the advert/ })).not.toBeInTheDocument();
  });
});
