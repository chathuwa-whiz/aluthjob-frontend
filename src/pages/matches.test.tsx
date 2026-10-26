import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { application, fakeApi, finishedRun, frames, job, MAILBOX, match, PROFILE, renderApp, run, signedIn, user } from "../test/harness";

const rows = [
  match({ id: 1, score: 78, job: job({ id: 1, title: "Full Stack Developer", company: "Acme Software" }) }),
  match({ id: 2, score: 52, applyMethod: "portal", job: job({ id: 2, title: "Data Analyst", company: "Data Co", applyEmail: null, applyEmailSource: null }) }),
  match({ id: 3, score: 61, status: "approved", coverLetter: "x", job: job({ id: 3, title: "Backend Engineer" }) }),
  match({ id: 4, score: 40, status: "rejected", job: job({ id: 4, title: "Sales Lead" }) }),
  match({
    id: 5,
    score: 66,
    details: { breakdown: { skills: 1, title: 1, content: 1, experience: 0.4, location: 1 }, matchedSkills: [], reasons: [], warnings: ["Asks for about 2 years of experience; your resume shows 0.6 in related work"] },
    job: job({ id: 5, title: "Associate Engineer", applyEmailSource: "image" }),
  }),
];

const withMatches = (overrides = {}) => signedIn({ "GET /candidates/7/matches": { data: rows }, "GET /candidates/7/mail-account": { data: MAILBOX }, ...overrides });

describe("matches list", () => {
  it("welcomes someone with no CV and points at the first step", async () => {
    fakeApi(signedIn({ "GET /candidates": { data: [] } }));
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Upload your CV/ })).toHaveAttribute("href", "/resume");
    expect(screen.queryByRole("button", { name: "Find new jobs" })).not.toBeInTheDocument();
  });

  it("shows the next step, not an empty table, when there are no matches yet", async () => {
    fakeApi(signedIn());
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Job matches" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Find jobs now/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Connect mailbox/ })).toHaveAttribute("href", "/mailbox");
  });

  it("lists the matches to review, best first, with the reasons and plain delivery labels", async () => {
    fakeApi(withMatches());
    renderApp("/");

    const link = await screen.findByRole("link", { name: /Full Stack Developer/ });
    expect(link).toHaveAttribute("href", "/matches/1");
    expect(link).toHaveTextContent("Strong match, 78 out of 100");
    expect(link).toHaveTextContent("Acme Software · Colombo · Rooster");
    expect(link).toHaveTextContent("Ad mentions 2 of your skills");
    expect(link).toHaveTextContent("By email");

    expect(screen.getByRole("link", { name: /Data Analyst/ })).toHaveTextContent("On their site");
    // only the ones still waiting for a decision are on this tab
    expect(screen.queryByRole("link", { name: /Backend Engineer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sales Lead/ })).not.toBeInTheDocument();
  });

  it("flags addresses read from a picture and the warnings about experience", async () => {
    fakeApi(withMatches());
    renderApp("/");

    const link = await screen.findByRole("link", { name: /Associate Engineer/ });
    expect(link).toHaveTextContent("Check address");
    expect(link).toHaveTextContent("Asks for about 2 years of experience");
  });

  it("counts each tab and switches between them", async () => {
    fakeApi(withMatches());
    renderApp("/");

    expect(await screen.findByRole("tab", { name: /To review/ })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /Approved/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Skipped/ })).toHaveTextContent("1");

    await userEvent.click(screen.getByRole("tab", { name: /Approved/ }));
    expect(screen.getByRole("link", { name: /Backend Engineer/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Full Stack Developer/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Backend Engineer/ })).toHaveTextContent("Approved");
  });

  it("marks an approved match Sent once its application has gone out", async () => {
    fakeApi({ ...withMatches(), "GET /candidates/7/applications": { data: [application({ matchId: 3, status: "sent", sentAt: "2026-10-24T03:00:00.000Z" })] } });
    renderApp("/");

    await userEvent.click(await screen.findByRole("tab", { name: /Approved/ }));
    const row = await screen.findByRole("link", { name: /Backend Engineer/ });
    await waitFor(() => expect(row).toHaveTextContent("Sent"));
    expect(row).not.toHaveTextContent("Approved");
  });

  it("moves between tabs with the arrow keys", async () => {
    fakeApi(withMatches());
    renderApp("/");

    const first = await screen.findByRole("tab", { name: /To review/ });
    first.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /Approved/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Approved/ })).toHaveFocus();
  });

  it("can show only the jobs that can be applied to by email", async () => {
    fakeApi(withMatches());
    renderApp("/");

    await screen.findByRole("link", { name: /Data Analyst/ });
    await userEvent.click(screen.getByLabelText("Only jobs I can apply to by email"));

    expect(screen.queryByRole("link", { name: /Data Analyst/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Full Stack Developer/ })).toBeInTheDocument();
  });

  it("explains an empty tab instead of showing nothing", async () => {
    fakeApi(withMatches({ "GET /candidates/7/matches": { data: [rows[0]!] } }));
    renderApp("/");

    await screen.findByRole("link", { name: /Full Stack Developer/ });
    await userEvent.click(screen.getByRole("tab", { name: /Skipped/ }));
    expect(screen.getByRole("heading", { name: "No skipped jobs" })).toBeInTheDocument();
  });

  it("suggests connecting a mailbox when there are matches but nowhere to send from", async () => {
    fakeApi(withMatches({ "GET /candidates/7/mail-account": { status: 404, message: "No mailbox connected" } }));
    renderApp("/");

    expect(await screen.findByText("Connect your mailbox to send applications")).toBeInTheDocument();
  });
});

describe("searching for jobs", () => {
  const RUN = "/candidates/7/matches/run";
  const collecting = run({
    phase: "collecting",
    elapsedMs: 4_000,
    sites: [
      { source: "xpress", state: "done", fetched: 150 },
      { source: "rooster", state: "reading", fetched: 50 },
      { source: "ikman", state: "failed", fetched: 0, error: "fetch failed" },
    ],
    activity: [{ at: "2026-10-24T10:00:03.000Z", text: "Xpress: found 150 vacancies" }],
  });
  const reading = run({
    phase: "reading",
    elapsedMs: 40_000,
    considered: 898,
    adverts: { done: 5, total: 20, current: { title: "Senior React Developer", company: "Acme Software", source: "xpress" } },
    activity: [{ at: "2026-10-24T10:00:30.000Z", text: "Compared your CV with 898 vacancies" }],
  });

  it("shows which site is being read, which advert, how far along it is and the time, then the outcome", async () => {
    const api = fakeApi(withMatches({ [`POST ${RUN}`]: { status: 202, data: run() }, [`GET ${RUN}`]: frames(collecting, collecting, reading, reading, finishedRun()) }));
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Find new jobs" }));

    // the job sites, each with its own state
    expect(await screen.findByRole("heading", { name: "Searching jobs for you" })).toBeInTheDocument();
    const sites = screen.getByRole("list", { name: "Job sites" });
    expect(within(sites).getByText("Xpress Jobs").closest("li")).toHaveTextContent("150 vacancies");
    expect(within(sites).getByText("Rooster").closest("li")).toHaveTextContent("50 vacancies");
    expect(within(sites).getByText("ikman.lk").closest("li")).toHaveTextContent("Could not be read");
    expect(screen.getByText("Reading the job sites: 2 of 3 finished")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find new jobs" })).toBeDisabled();

    // then the advert being read right now
    expect(await screen.findByText("Reading the full advert 6 of 20")).toBeInTheDocument();
    expect(screen.getByText("Senior React Developer")).toBeInTheDocument();
    expect(screen.getByText("Acme Software · Xpress Jobs")).toBeInTheDocument();
    expect(screen.getByText("898")).toBeInTheDocument(); // vacancies compared
    expect(screen.getByRole("progressbar", { name: "Searching jobs for you" })).toHaveAttribute("aria-valuenow", expect.stringMatching(/^\d+$/));
    expect(screen.getByRole("list", { name: "Steps" }) ?? null).toBeTruthy();

    // the clock comes from the server's measurement
    expect(screen.getByText(/^0:(4\d|5\d)$|^[01]:\d\d$/)).toBeInTheDocument();

    // and when it ends the list is refreshed and the outcome stated
    expect(await screen.findByText("Search finished in 1:23")).toBeInTheDocument();
    expect(screen.getByText(/Looked at 898 vacancies and kept 18 matches, the best scoring 76 out of 100/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Searching jobs for you" })).not.toBeInTheDocument();
    expect(api.called("POST", RUN)).toHaveLength(1);
    await vi.waitFor(() => expect(api.called("GET", "/candidates/7/matches").length).toBeGreaterThan(1));
  });

  it("marks the steps done, current and still to come", async () => {
    fakeApi(withMatches({ [`POST ${RUN}`]: { status: 202, data: run() }, [`GET ${RUN}`]: frames(reading) }));
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Find new jobs" }));
    await screen.findByText("Reading the full advert 6 of 20");

    const current = screen.getByText("Read the best adverts").closest("li")!;
    expect(current).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Compare with your CV").closest("li")).toHaveClass("track__step--done");
  });

  it("says when the first search had to collect vacancies first, and when some job sites could not be reached", async () => {
    const done = finishedRun({ considered: 303, matched: 13, enriched: 20, topScore: 75, collected: 303, sourcesFailed: 2 });
    fakeApi(withMatches({ [`POST ${RUN}`]: { status: 202, data: run() }, [`GET ${RUN}`]: frames(done) }));
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Find new jobs" }));

    expect(await screen.findByText(/First collected 303 vacancies from the job sites/)).toBeInTheDocument();
    expect(screen.getByText(/Looked at 303 vacancies and kept 13 matches/)).toBeInTheDocument();
    expect(screen.getByText(/2 job sites could not be reached this time, so some vacancies may be missing/)).toBeInTheDocument();
  });

  it("picks the progress back up when the person returns to a search that is still running, without starting another", async () => {
    const api = fakeApi(withMatches({ [`GET ${RUN}`]: frames(reading, finishedRun()) }));
    renderApp("/");

    expect(await screen.findByText("Reading the full advert 6 of 20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find new jobs" })).toBeDisabled();
    expect(await screen.findByText("Search finished in 1:23")).toBeInTheDocument();
    expect(api.called("POST", RUN)).toHaveLength(0);
  });

  it("shows the outcome of the last search when the person comes back later", async () => {
    fakeApi(withMatches({ [`GET ${RUN}`]: { data: finishedRun() } }));
    renderApp("/");

    expect(await screen.findByText("Search finished in 1:23")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Searching jobs for you" })).not.toBeInTheDocument();
  });

  it("shows the reason when the search stops, instead of a success message, and keeps the list", async () => {
    const failed = run({ status: "failed", phase: "failed", error: "We could not collect any vacancies from the job sites just now (fetch failed). Check that this server can reach the internet, then try again." });
    fakeApi(withMatches({ [`POST ${RUN}`]: { status: 202, data: run() }, [`GET ${RUN}`]: frames(collecting, failed) }));
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Find new jobs" }));

    expect(await screen.findByText("The search did not finish")).toBeInTheDocument();
    expect(screen.getByText(/could not collect any vacancies from the job sites/)).toBeInTheDocument();
    expect(screen.queryByText(/Search finished/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Full Stack Developer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find new jobs" })).toBeEnabled();
  });

  it("reports a search that could not be started without losing the list", async () => {
    fakeApi(withMatches({ [`POST ${RUN}`]: { status: 500, message: "Request failed" } }));
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Find new jobs" }));

    expect(await screen.findByText("The search did not start")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Full Stack Developer/ })).toBeInTheDocument();
  });
});

describe("app shell", () => {
  it("shows the main places to go, with a count of approved applications waiting to be sent", async () => {
    fakeApi(
      withMatches({
        // approved + emailable + not yet queued = ready to send
        "GET /candidates/7/matches": { data: [match({ id: 3, status: "approved", coverLetter: "x" }), match({ id: 8, status: "approved", coverLetter: "x" })] },
        "GET /candidates/7/applications": { data: [application({ matchId: 8 })] },
      }),
    );
    renderApp("/");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    for (const name of ["Matches", "Applications", "Resume", "Mailbox"]) expect(within(nav).getByRole("link", { name: new RegExp(name) })).toBeInTheDocument();
    expect(await within(nav).findByText(/^1/)).toHaveTextContent("1 ready to send");
  });

  it("names whose CV it is working with, and lets the person sign out", async () => {
    const api = fakeApi(withMatches({ "POST /auth/logout": { data: { signedOut: true } } }));
    renderApp("/");

    expect(await screen.findByText("Working with")).toBeInTheDocument();
    expect(screen.getAllByText("Ama Perera").length).toBeGreaterThan(0);
    expect(screen.getByText(user().email)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(api.called("POST", "/auth/logout")).toHaveLength(1);
  });

  it("opens and closes the menu on small screens", async () => {
    fakeApi(withMatches());
    renderApp("/");

    const menu = await screen.findByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(menu);
    expect(document.getElementById("site-nav")).toHaveAttribute("data-open", "true");

    await userEvent.keyboard("{Escape}");
    expect(document.getElementById("site-nav")).toHaveAttribute("data-open", "false");
  });

  it("names each page in the browser tab, and moves focus to the new page after navigating", async () => {
    fakeApi(withMatches({ "GET /candidates/7": { data: { id: 7, fileName: "ama-cv.pdf", mimeType: "application/pdf", createdAt: "x", updatedAt: "x", profile: PROFILE } } }));
    renderApp("/");

    await screen.findByRole("heading", { name: "Job matches" });
    expect(document.title).toBe("Job matches · AluthJob");
    expect(screen.getByRole("main")).not.toHaveFocus(); // nothing was navigated yet

    await userEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: /Resume/ }));

    expect(await screen.findByRole("heading", { name: "Your resume" })).toBeInTheDocument();
    expect(document.title).toBe("Your resume · AluthJob");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("keeps focus inside the menu on small screens, and gives it back when the menu closes", async () => {
    fakeApi(withMatches());
    renderApp("/");

    const open = await screen.findByRole("button", { name: "Menu" });
    await userEvent.click(open);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(open).toHaveFocus();
  });

  it("answers an unknown address with a helpful page inside the app", async () => {
    fakeApi(withMatches());
    renderApp("/nowhere");

    expect(await screen.findByRole("heading", { name: "That page does not exist" })).toBeInTheDocument();
  });
});

