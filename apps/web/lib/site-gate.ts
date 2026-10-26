// Private-beta sign-in for the Super Admin (the only account until real user accounts ship).
// Shared by proxy.ts (checks the cookie) and the unlock action (sets it). Web Crypto only,
// so it runs anywhere the proxy runs. Credentials come from env vars, never from code.

export const GATE_COOKIE = "ajh_gate";
export const GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface Credentials {
  username: string;
  password: string;
}

export interface GateConfig extends Credentials {
  secret: string;
}

/** The gate is on only when ADMIN_USERNAME and ADMIN_PASSWORD are set; local development stays open. */
export function gateConfig(env: Record<string, string | undefined> = process.env): GateConfig | null {
  const username = env.ADMIN_USERNAME?.trim();
  const password = env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  const secret = env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set when ADMIN_USERNAME/ADMIN_PASSWORD are used.");
  return { username, password, secret };
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Cookie value proving the visitor signed in with these credentials.
 * Usernames are case-insensitive. Changing the password invalidates existing sessions.
 */
export function gateToken(config: GateConfig, creds: Credentials = config): Promise<string> {
  return hmacHex(config.secret, `site-gate:v2:${creds.username.trim().toLowerCase()}\u0000${creds.password}`);
}

/** Constant-time comparison so response timing reveals nothing about the expected value. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isTokenValid(config: GateConfig, token: string | undefined): Promise<boolean> {
  return Boolean(token) && safeEqual(token!, await gateToken(config));
}

/** Only allow redirects back to a path on this site (no "//evil.com" or absolute URLs). */
export function safeNextPath(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}
