import { describe, expect, it } from "vitest";
import { resolveDatabaseUrls } from "../src/env";

describe("resolveDatabaseUrls", () => {
  it("uses the Neon integration's names", () => {
    expect(resolveDatabaseUrls({ DATABASE_URL: "pooled", DATABASE_URL_UNPOOLED: "direct" })).toEqual({ pooled: "pooled", direct: "direct" });
  });
  it("falls back to Vercel Postgres-style names", () => {
    expect(resolveDatabaseUrls({ POSTGRES_URL: "p", POSTGRES_URL_NON_POOLING: "d" })).toEqual({ pooled: "p", direct: "d" });
  });
  it("uses whichever single URL exists for both", () => {
    expect(resolveDatabaseUrls({ DATABASE_URL: "only" })).toEqual({ pooled: "only", direct: "only" });
    expect(resolveDatabaseUrls({ DATABASE_URL: " ", POSTGRES_URL_NON_POOLING: "d" })).toEqual({ pooled: "d", direct: "d" });
  });
  it("returns nulls when nothing is set", () => {
    expect(resolveDatabaseUrls({})).toEqual({ pooled: null, direct: null });
  });
});

import { toDriverUrl } from "../src/client";

describe("toDriverUrl", () => {
  // Placeholder credentials only.
  const neon = "postgresql://user:secret@ep-example-pooler.us-east-2.aws.neon.tech/db?sslmode=require&channel_binding=require";

  it("drops libpq-only options the driver would send to the server", () => {
    const url = new URL(toDriverUrl(neon));
    expect(url.searchParams.has("channel_binding")).toBe(false);
    expect(url.searchParams.get("sslmode")).toBe("require"); // TLS stays required
    expect(url.hostname).toContain("-pooler");
  });

  it("leaves other URLs unchanged", () => {
    expect(toDriverUrl("postgres://a:b@localhost:5433/ajh")).toBe("postgres://a:b@localhost:5433/ajh");
  });
});
