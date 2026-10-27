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
