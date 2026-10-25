import "server-only";

/**
 * Temporary: returns the seeded dev user until Auth.js lands (next build step).
 * All callers go through this one function, so swapping in the real session is a one-file change.
 */
export async function requireUserId(): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Authentication is not configured yet.");
  }
  return "dev-user";
}
