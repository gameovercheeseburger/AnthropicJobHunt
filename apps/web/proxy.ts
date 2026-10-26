import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateConfig, isTokenValid } from "@/lib/site-gate";

/** Private beta: every page requires the site password until real sign-in ships. */
export async function proxy(request: NextRequest) {
  const config = gateConfig();
  if (!config) return NextResponse.next();

  if (await isTokenValid(config, request.cookies.get(GATE_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const unlock = new URL("/unlock", request.url);
  unlock.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(unlock);
}

export const config = {
  // Everything except the sign-in page, Next.js assets, the PWA icon/manifest, and the cron
  // endpoint (which checks its own CRON_SECRET).
  matcher: ["/((?!unlock|api/cron|_next/static|_next/image|icon.svg|manifest.webmanifest|robots.txt).*)"],
};
