import { describe, expect, it } from "vitest";
import { formatBytes, formatElapsed, scoreTier, timeAgo } from "./format";
import { clearHash, safeHttpUrl, tokenFromHash } from "./url";

describe("safeHttpUrl", () => {
  it("allows ordinary web addresses", () => {
    expect(safeHttpUrl("https://www.topjobs.lk/employer/JobAdvertismentServlet?rid=0&ac=1")).toContain("topjobs.lk");
    expect(safeHttpUrl("http://example.com/a")).toBe("http://example.com/a");
  });

  it("refuses anything a scraped advert could use to run code or leave the web", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "file:///etc/passwd", "ftp://example.com", "blob:https://x/1", "//evil.example/x", "/relative/path", "not a url", "", " "]) {
      expect(safeHttpUrl(bad), bad).toBeNull();
    }
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });
});

describe("one-time link tokens", () => {
  it("reads the token from the URL fragment", () => {
    expect(tokenFromHash("#token=abc_DEF-123")).toBe("abc_DEF-123");
    expect(tokenFromHash("token=abc")).toBe("abc");
    expect(tokenFromHash("#a=1&token=xyz")).toBe("xyz");
  });

  it("finds nothing where there is nothing", () => {
    expect(tokenFromHash("")).toBeNull();
    expect(tokenFromHash("#")).toBeNull();
    expect(tokenFromHash("#other=1")).toBeNull();
  });

  it("removes the fragment from the address bar without losing the path or query", () => {
    window.history.replaceState(null, "", "/reset-password?lang=en#token=secret");
    clearHash();

    expect(window.location.hash).toBe("");
    expect(window.location.pathname + window.location.search).toBe("/reset-password?lang=en");
  });
});

describe("scoreTier", () => {
  it("draws the lines at 65 and 50", () => {
    expect([100, 65].map(scoreTier)).toEqual(["strong", "strong"]);
    expect([64, 50].map(scoreTier)).toEqual(["good", "good"]);
    expect([49, 0].map(scoreTier)).toEqual(["possible", "possible"]);
  });
});

describe("time and size formatting", () => {
  const now = new Date("2026-10-24T12:00:00Z").getTime();

  it("says how long ago, in plain words", () => {
    expect(timeAgo("2026-10-22T12:00:00Z", now)).toBe("2 days ago");
    expect(timeAgo("2026-10-24T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-10-24T11:58:00Z", now)).toBe("2 minutes ago");
    expect(timeAgo("2026-10-24T12:00:20Z", now)).toBe("just now");
    expect(timeAgo("2026-10-24T14:00:00Z", now)).toBe("in 2 hours");
    expect(timeAgo(null, now)).toBe("");
  });

  it("formats file sizes and timers", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(154_115)).toBe("151 KB");
    expect(formatBytes(2_621_440)).toBe("2.5 MB");
    expect(formatElapsed(5)).toBe("0:05");
    expect(formatElapsed(125)).toBe("2:05");
  });
});
