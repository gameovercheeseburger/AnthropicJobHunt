"use server";

import { refresh } from "next/cache";
import { container } from "@/lib/container";
import { requireUserId } from "@/lib/current-user";

export type RefreshJobsState =
  | { status: "idle" }
  | { status: "done"; created: number; updated: number; expired: number; failedBoards: number }
  | { status: "error"; message: string };

/** Super Admin: refresh jobs from every source now instead of waiting for the daily run. */
export async function refreshJobsAction(): Promise<RefreshJobsState> {
  try {
    await requireUserId(); // the whole site is admin-only in the private beta
    const reports = await container().ingestion.runAll();
    refresh();
    const sum = (k: "created" | "updated" | "expired" | "failedScopes") => reports.reduce((n, r) => n + r[k], 0);
    return {
      status: "done",
      created: sum("created"),
      updated: sum("updated"),
      expired: sum("expired"),
      failedBoards: sum("failedScopes"),
    };
  } catch (err) {
    console.error("refreshJobsAction failed", err);
    return { status: "error", message: "Couldn't refresh jobs. Please try again in a minute." };
  }
}
