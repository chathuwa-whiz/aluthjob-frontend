import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeApi, renderApp, signedIn, user } from "../test/harness";

const signedOut = { "GET /auth/me": { status: 401, message: "Sign in to continue" } };

describe("signing in", () => {
  it("sends a signed-out visitor to the sign-in page, and takes them to the app after signing in", async () => {
    const api = fakeApi({ ...signedOut, "POST /auth/login": { data: { user: user() } }, "GET /candidates": { data: [] } });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Email"), "  ama@example.com ");
    await userEvent.type(screen.getByLabelText("Password"), "violet-granite-lantern-42");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(api.called("POST", "/auth/login")[0]!.body).toEqual({ email: "ama@example.com", password: "violet-granite-lantern-42" });
  });

  it("shows the server's reason when the sign-in fails, and stays put", async () => {
    fakeApi({ ...signedOut, "POST /auth/login": { status: 401, message: "Incorrect email or password" } });
    renderApp("/login");

    await userEvent.type(await screen.findByLabelText("Email"), "ama@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("tells a locked-out person to wait, in the server's words", async () => {
    fakeApi({ ...signedOut, "POST /auth/login": { status: 429, message: "Too many failed sign-in attempts. Try again in 15 minute(s)", code: "RATE_LIMITED" } });
    renderApp("/login");

    await userEvent.type(await screen.findByLabelText("Email"), "ama@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/try again in 15 minute/i);
  });

  it("does not offer to sign in until both boxes are filled", async () => {
    fakeApi(signedOut);
    renderApp("/login");

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("lets the password be shown and hidden", async () => {
    fakeApi(signedOut);
    renderApp("/login");

    const box = await screen.findByLabelText("Password");
    expect(box).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(box).toHaveAttribute("type", "text");
  });

  it("sends someone who is already signed in away from the sign-in page", async () => {
    fakeApi(signedIn());
    renderApp("/login");

    expect(await screen.findByRole("heading", { name: "Job matches" })).toBeInTheDocument();
  });

  it("returns to sign-in when the session expires while using the app", async () => {
    fakeApi(signedIn({ "GET /candidates": { status: 401, message: "Sign in to continue" } }));
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("creating an account", () => {
  it("checks the password length before asking the server", async () => {
    const api = fakeApi(signedOut);
    renderApp("/register");

    await userEvent.type(await screen.findByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/at least 10 characters/i, { selector: ".field__error span" })).toBeInTheDocument();
    expect(api.called("POST", "/auth/register")).toHaveLength(0);
  });

  it("shows the same 'check your email' page whatever the server decided, and signs nobody in", async () => {
    const message = "If that address can be registered, we have sent a message to it. Follow the link in it to finish creating your account";
    fakeApi({ ...signedOut, "POST /auth/register": { status: 202, data: { message } } });
    renderApp("/register");

    await userEvent.type(await screen.findByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "violet-granite-lantern-42");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome" })).not.toBeInTheDocument();
  });

  it("passes on the server's complaint about a weak password", async () => {
    fakeApi({ ...signedOut, "POST /auth/register": { status: 409, message: "That password is too common; choose something less guessable" } });
    renderApp("/register");

    await userEvent.type(await screen.findByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("too common");
  });
});

describe("an account whose email is not confirmed", () => {
  const unverified = { "GET /auth/me": { data: { user: user({ emailVerified: false }) } } };

  it("sees only the confirmation screen, never the app", async () => {
    fakeApi(unverified);
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Confirm your email address" })).toBeInTheDocument();
    expect(screen.getByText("ama@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("can ask for a new link", async () => {
    const api = fakeApi({ ...unverified, "POST /auth/resend-verification": { status: 202, data: { sent: true } } });
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Send me a new link" }));

    expect(await screen.findByText(/new link is on its way to ama@example.com/i)).toBeInTheDocument();
    expect(api.called("POST", "/auth/resend-verification")).toHaveLength(1);
  });

  it("is told when it asks too often", async () => {
    fakeApi({ ...unverified, "POST /auth/resend-verification": { status: 429, message: "Too many confirmation emails. Try again in 60 minute(s)", code: "RATE_LIMITED" } });
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Send me a new link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many confirmation emails/i);
  });

  it("gets into the app once the account turns out to be confirmed", async () => {
    let checks = 0;
    fakeApi(
      signedIn({
        "GET /auth/me": () => ({ data: { user: user({ emailVerified: ++checks > 1 }) } }),
      }),
    );
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "I have confirmed it" }));
    expect(await screen.findByRole("heading", { name: "Job matches" })).toBeInTheDocument();
  });

  it("says plainly when the link has not been followed yet", async () => {
    fakeApi(unverified);
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "I have confirmed it" }));
    expect(await screen.findByText(/not confirmed yet/i)).toBeInTheDocument();
  });

  it("can sign out from the gate", async () => {
    const api = fakeApi({ ...unverified, "POST /auth/logout": { data: { signedOut: true } } });
    renderApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(api.called("POST", "/auth/logout")).toHaveLength(1);
  });
});

describe("the link in a confirmation email", () => {
  it("uses the link exactly once, even when React mounts the page twice, and removes the token from the address bar", async () => {
    const api = fakeApi({ ...signedOut, "POST /auth/verify-email": { data: { verified: true } } });
    renderApp("/verify-email#token=tok_" + "a".repeat(30), { strict: true });

    expect(await screen.findByRole("heading", { name: "Your email is confirmed" })).toBeInTheDocument();
    expect(api.called("POST", "/auth/verify-email")).toHaveLength(1);
    expect(api.called("POST", "/auth/verify-email")[0]!.body).toEqual({ token: "tok_" + "a".repeat(30) });
    expect(window.location.hash).toBe("");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("offers to continue when the person is already signed in", async () => {
    fakeApi({ ...signedIn({ "GET /auth/me": { data: { user: user({ emailVerified: true }) } } }), "POST /auth/verify-email": { data: { verified: true } } });
    renderApp("/verify-email#token=tok_" + "b".repeat(30));

    await userEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Job matches" })).toBeInTheDocument();
  });

  it("explains a link that was already used or has expired", async () => {
    fakeApi({ ...signedOut, "POST /auth/verify-email": { status: 400, message: "This confirmation link is invalid or has expired. Sign in and ask for a new one" } });
    renderApp("/verify-email#token=tok_" + "c".repeat(30));

    expect(await screen.findByRole("heading", { name: "We could not confirm your email" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid or has expired/i);
  });

  it("does not call the server when the link carries no token", async () => {
    const api = fakeApi(signedOut);
    renderApp("/verify-email");

    expect(await screen.findByRole("alert")).toHaveTextContent(/link is incomplete/i);
    expect(api.called("POST", "/auth/verify-email")).toHaveLength(0);
  });
});

describe("forgotten passwords", () => {
  it("asks for an address and shows the same answer whether or not it has an account", async () => {
    const message = "If that address has an account, we have sent a message to it with a link to choose a new password";
    const api = fakeApi({ ...signedOut, "POST /auth/forgot-password": { status: 202, data: { message } } });
    renderApp("/forgot-password");

    await userEvent.type(await screen.findByLabelText("Email"), "anyone@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(api.called("POST", "/auth/forgot-password")[0]!.body).toEqual({ email: "anyone@example.com" });
  });

  it("resets with the emailed link, removes the token from the address bar, and returns to sign-in with a notice", async () => {
    const api = fakeApi({ ...signedOut, "POST /auth/reset-password": { data: { reset: true, message: "ok" } } });
    renderApp("/reset-password#token=reset_" + "d".repeat(30));

    await userEvent.type(await screen.findByLabelText("New password"), "fresh-maple-orbit-77");
    await userEvent.type(screen.getByLabelText("Type it again"), "fresh-maple-orbit-77");
    expect(window.location.hash).toBe("");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(await screen.findByText(/your password was changed and every device was signed out/i)).toBeInTheDocument();
    expect(api.called("POST", "/auth/reset-password")[0]!.body).toEqual({ token: "reset_" + "d".repeat(30), newPassword: "fresh-maple-orbit-77" });
  });

  it("catches a mismatch before using up the one-time link", async () => {
    const api = fakeApi(signedOut);
    renderApp("/reset-password#token=reset_" + "e".repeat(30));

    await userEvent.type(await screen.findByLabelText("New password"), "fresh-maple-orbit-77");
    await userEvent.type(screen.getByLabelText("Type it again"), "fresh-maple-orbit-78");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText(/not the same/i, { selector: ".field__error span" })).toBeInTheDocument();
    expect(api.called("POST", "/auth/reset-password")).toHaveLength(0);
  });

  it("shows the server's reason for a weak password and keeps the form for another try", async () => {
    fakeApi({ ...signedOut, "POST /auth/reset-password": { status: 409, message: "That password is too common; choose something less guessable" } });
    renderApp("/reset-password#token=reset_" + "f".repeat(30));

    await userEvent.type(await screen.findByLabelText("New password"), "password123");
    await userEvent.type(screen.getByLabelText("Type it again"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("too common");
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("offers a fresh link when the old one is spent", async () => {
    fakeApi({ ...signedOut, "POST /auth/reset-password": { status: 400, message: "This reset link is invalid or has expired. Request a new one" } });
    renderApp("/reset-password#token=reset_" + "g".repeat(30));

    await userEvent.type(await screen.findByLabelText("New password"), "fresh-maple-orbit-77");
    await userEvent.type(screen.getByLabelText("Type it again"), "fresh-maple-orbit-77");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("link", { name: "Send me a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("does not show a form when the link carries no token", async () => {
    fakeApi(signedOut);
    renderApp("/reset-password");

    expect(await screen.findByRole("heading", { name: "This link is incomplete" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("New password")).not.toBeInTheDocument());
  });
});
