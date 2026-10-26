import { NextResponse, type NextRequest } from "next/server";
import { container } from "@/lib/container";
import { safeEqual } from "@/lib/site-gate";

// Fetching ~40 boards and storing ~1,000 jobs takes a few minutes at most.
export const maxDuration = 300;

/**
 * Scheduled job refresh. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`
 * (schedule in vercel.json). Anyone else gets a 401.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const reports = await container().ingestion.runAll();
  return NextResponse.json({
    ok: true,
    sources: reports.map(({ errors, ...counts }) => ({ ...counts, errors: errors.slice(0, 5) })),
  });
}
