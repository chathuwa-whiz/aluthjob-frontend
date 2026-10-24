/**
 * Links in this app come from scraped adverts, so they are untrusted: a vacancy page could just as well
 * carry "javascript:..." as a real address. Only plain http(s) addresses are ever turned into links.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Reads the one-time token from a URL fragment like "#token=abc" (the form used in emailed links). */
export function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token");
}

/** Removes the fragment from the address bar so a token does not stay in the history or get copied by mistake. */
export function clearHash() {
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
}
