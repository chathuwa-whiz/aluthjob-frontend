import { describe, expect, it, vi } from "vitest";
import { ApiError, get, messageOf, post, request, setUnauthenticatedHandler } from "./client";
import { candidates } from "./endpoints";
import { fakeApi } from "../test/harness";

describe("api client", () => {
  it("unwraps the data of a successful call and sends the session cookie", async () => {
    const api = fakeApi({ "GET /things": { data: { ok: [1, 2] } } });

    await expect(get("/things")).resolves.toEqual({ ok: [1, 2] });
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ credentials: "same-origin", method: "GET" });
    expect(api.calls).toHaveLength(1);
  });

  it("sends JSON bodies with a content type, and uploads with none so the browser can set the boundary", async () => {
    fakeApi({ "POST /a": { data: {} }, "POST /resumes/analyze": { data: {} } });

    await post("/a", { x: 1 });
    expect(vi.mocked(fetch).mock.calls[0]![1]!.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(vi.mocked(fetch).mock.calls[0]![1]!.body).toBe('{"x":1}');

    await candidates.upload(new File(["cv"], "cv.pdf", { type: "application/pdf" }));
    const upload = vi.mocked(fetch).mock.calls[1]![1]!;
    expect(upload.body).toBeInstanceOf(FormData);
    expect(upload.headers).not.toHaveProperty("Content-Type");
    expect((upload.body as FormData).get("resume")).toBeInstanceOf(File);
  });

  it("turns a failed call into an ApiError that carries the server's words, code and retry time", async () => {
    fakeApi({ "POST /locked": { status: 429, message: "Too many failed sign-in attempts. Try again in 15 minute(s)", code: "RATE_LIMITED", headers: { "Retry-After": "899" } } });

    const error = await post("/locked").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: "RATE_LIMITED", retryAfter: 899, message: "Too many failed sign-in attempts. Try again in 15 minute(s)" });
  });

  it("never shows the server's placeholder text for a 5xx error", async () => {
    fakeApi({ "GET /boom": { status: 500, message: "Request failed" } });

    const error = (await get("/boom").catch((caught: unknown) => caught)) as ApiError;
    expect(error.message).not.toBe("Request failed");
    expect(error.message).toMatch(/our side/i);
  });

  it("explains a network failure in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = (await get("/anything").catch((caught: unknown) => caught)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/can't reach the server/i);
  });

  it("lets an aborted request stay an abort instead of showing an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    await expect(get("/x")).rejects.toMatchObject({ name: "AbortError" });
  });

  it("signs the person out of the screen on a 401, except for calls made before sign-in", async () => {
    fakeApi({ "GET /private": { status: 401, message: "Sign in to continue" }, "POST /auth/login": { status: 401, message: "Incorrect email or password" } });
    const onExpired = vi.fn();
    setUnauthenticatedHandler(onExpired);

    await get("/private").catch(() => undefined);
    expect(onExpired).toHaveBeenCalledTimes(1);

    await request("POST", "/auth/login", { answers401: true }).catch(() => undefined);
    expect(onExpired).toHaveBeenCalledTimes(1); // a wrong password is an answer, not an expired session

    setUnauthenticatedHandler(undefined);
  });

  it("describes any thrown value for display", () => {
    expect(messageOf(new ApiError("Nope", 400))).toBe("Nope");
    expect(messageOf(new Error("plain"))).toBe("plain");
    expect(messageOf("weird")).toMatch(/something went wrong/i);
  });
});
