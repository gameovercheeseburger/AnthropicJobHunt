"use server";

import { isSwipeDirection, NotFoundError } from "@ajh/core";
import { container } from "@/lib/container";
import { requireUserId } from "@/lib/current-user";
import { presentJobCard, type JobCardView } from "@/lib/presenters/job-card";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function swipeAction(jobId: unknown, direction: unknown): Promise<ActionResult> {
  if (typeof jobId !== "string" || !UUID.test(jobId) || !isSwipeDirection(direction)) {
    return { ok: false, error: "Invalid swipe." };
  }
  try {
    await container().swipes.swipe(await requireUserId(), jobId, direction);
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, error: "That job is no longer available." };
    console.error("swipeAction failed", err);
    return { ok: false, error: "Couldn't save that swipe. Please try again." };
  }
}

export async function undoSwipeAction(): Promise<ActionResult<string | null>> {
  try {
    return { ok: true, data: await container().swipes.undoLast(await requireUserId()) };
  } catch (err) {
    console.error("undoSwipeAction failed", err);
    return { ok: false, error: "Couldn't undo. Please try again." };
  }
}

export async function loadMoreJobsAction(excludeIds: unknown): Promise<ActionResult<JobCardView[]>> {
  const exclude = new Set(Array.isArray(excludeIds) ? excludeIds.filter((id) => typeof id === "string") : []);
  try {
    const deck = await container().feed.getDeck(await requireUserId(), 20);
    return { ok: true, data: deck.filter((j) => !exclude.has(j.id)).map((j) => presentJobCard(j)) };
  } catch (err) {
    console.error("loadMoreJobsAction failed", err);
    return { ok: false, error: "Couldn't load more jobs." };
  }
}
