// The one place that talks to the API. Every call goes to the same origin under /api/v1 (see vite.config.ts),
// carries the session cookie automatically, and fails with an ApiError that has a message fit to show a person.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Machine-readable reason from the server, e.g. EMAIL_NOT_VERIFIED or RATE_LIMITED. */
    readonly code?: string,
    /** Seconds until a rate-limited request may be tried again. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onUnauthenticated: (() => void) | undefined;

/** The auth provider registers itself here so any 401 anywhere signs the user out of the UI. */
export function setUnauthenticatedHandler(handler: (() => void) | undefined) {
  onUnauthenticated = handler;
}

interface Options {
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  /**
   * For calls where a 401 is the server's answer to this request, not a sign that the session ended:
   * signing in with a wrong password, or confirming an action with a wrong password. Without this, any
   * 401 signs the person out of the screen.
   */
  answers401?: boolean;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
}

const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again.";
const SERVER_MESSAGE = "Something went wrong on our side. Please try again in a moment.";

export async function request<T>(method: string, path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (options.form) {
    body = options.form; // the browser sets the multipart boundary itself
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { method, headers, body, credentials: "same-origin", signal: options.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(NETWORK_MESSAGE, 0);
  }

  const envelope = (await response.json().catch(() => undefined)) as Envelope<T> | undefined;

  if (response.ok && envelope?.success) return envelope.data as T;

  if (response.status === 401 && !options.answers401) onUnauthenticated?.();

  // A 5xx message from the server is a generic placeholder; people get a friendlier one
  const message = response.status >= 500 ? SERVER_MESSAGE : (envelope?.message ?? SERVER_MESSAGE);
  const retryAfter = Number(response.headers.get("Retry-After")) || undefined;

  throw new ApiError(message, response.status, envelope?.code, retryAfter);
}

export const get = <T>(path: string, options?: Options) => request<T>("GET", path, options);
export const post = <T>(path: string, body?: unknown, options?: Options) => request<T>("POST", path, { ...options, body });
export const put = <T>(path: string, body?: unknown, options?: Options) => request<T>("PUT", path, { ...options, body });
export const patch = <T>(path: string, body?: unknown, options?: Options) => request<T>("PATCH", path, { ...options, body });
export const del = <T>(path: string, body?: unknown, options?: Options) => request<T>("DELETE", path, { ...options, body });

/** A message for any thrown value, for showing in an alert. */
export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
