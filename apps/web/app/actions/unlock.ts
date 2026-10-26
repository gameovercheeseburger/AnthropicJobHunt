"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, GATE_MAX_AGE_SECONDS, gateConfig, gateToken, safeEqual, safeNextPath } from "@/lib/site-gate";

export type UnlockState = { error: string | null };

export async function unlockAction(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const config = gateConfig();
  const next = safeNextPath(formData.get("next"));
  if (!config) redirect(next);

  const attempt = {
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  // Compare HMACs rather than raw strings so lengths and timing leak nothing.
  const [given, expected] = await Promise.all([gateToken(config, attempt), gateToken(config)]);
  if (!safeEqual(given, expected)) {
    await new Promise((r) => setTimeout(r, 750)); // slows down password guessing
    return { error: "Username or password is incorrect." };
  }

  (await cookies()).set(GATE_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE_SECONDS,
  });
  redirect(next);
}
