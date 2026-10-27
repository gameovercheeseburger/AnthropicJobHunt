import { NextResponse, type NextRequest } from "next/server";
import { container } from "@/lib/container";
import { safeEqual } from "@/lib/site-gate";

// Fetching ~40 boards, storing ~1,000 jobs, and storage cleanup take a few minutes at most.
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

  const app = container();
  const reports = await app.ingestion.runAll();
  // Keep file storage comfortably under its cap (cleans up above 90%, down to 80%).
  const storage = await app.storage.maintain();
  return NextResponse.json({
    ok: true,
    storage,
    sources: reports.map(({ errors, ...counts }) => ({ ...counts, errors: errors.slice(0, 5) })),
  });
}
