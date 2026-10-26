import "server-only";

/** The Super Admin's account: the only account until real sign-up ships (created by the seed script). */
export const OWNER_USER_ID = "dev-user";

/**
 * Temporary: one Super Admin account, used locally and in the private beta (behind the admin sign-in).
 * All callers go through this function, so swapping in Auth.js sessions is a one-file change.
 */
export async function requireUserId(): Promise<string> {
  if (process.env.NODE_ENV === "production" && !(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD)) {
    // Never serve one shared profile on an open public site.
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set until user accounts are implemented.");
  }
  return OWNER_USER_ID;
}
