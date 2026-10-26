import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, renderApp } from "../test/harness";

const signedOut = { "GET /auth/me": { status: 401, message: "Sign in to continue" } };
// the page remembers its answer per token (React mounts twice in development), so each test uses its own
const TOKEN = "eyJ1IjoxfQ.signature-signature-signature";
const BAD_TOKEN = "eyJ1IjoyfQ.expired-expired-expired-expired";

const open = (hash: string) => {
  window.history.replaceState(null, "", `/email-action${hash}`);
  renderApp(`/email-action${hash}`);
};

afterEach(() => window.history.replaceState(null, "", "/"));

describe("buttons in a job-alert email", () => {
  it("only describes the action when the page opens, and acts after one more click", async () => {
    const api = fakeApi({
      ...signedOut,
      "POST /alerts/preview": { data: { action: "hide", summary: "Hide this job from your matches. It will not come back.", confirmLabel: "Hide this job", jobTitle: "Software Engineer" } },
      "POST /alerts/act": { data: { action: "hide", message: "Hidden. We will not show it again." } },
    });
    open(`#token=${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "Hide this job?" })).toBeInTheDocument();
    expect(screen.getByText("Software Engineer")).toBeInTheDocument();
    // opening the link (what a mail scanner does) changed nothing
    expect(api.called("POST", "/alerts/act")).toHaveLength(0);
    expect(api.called("POST", "/alerts/preview")[0]!.body).toEqual({ token: TOKEN });

    await userEvent.click(screen.getByRole("button", { name: "Hide this job" }));

    expect(await screen.findByText("Hidden. We will not show it again.")).toBeInTheDocument();
    expect(api.called("POST", "/alerts/act")[0]!.body).toEqual({ token: TOKEN });
  });

  it("explains a link that is invalid or expired and points to the settings", async () => {
    fakeApi({ ...signedOut, "POST /alerts/preview": { status: 400, message: "This link is invalid or has expired." } });
    open(`#token=${BAD_TOKEN}`);

    expect(await screen.findByText("This link is invalid or has expired.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute("href", "/account#alerts");
  });

  it("says so when the link arrives without its token", async () => {
    const api = fakeApi(signedOut);
    open("");

    expect(await screen.findByText(/This link is incomplete/)).toBeInTheDocument();
    expect(api.called("POST", "/alerts/preview")).toHaveLength(0);
  });
});
