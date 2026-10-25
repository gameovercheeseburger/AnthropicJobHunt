import type { SwipeDirection } from "@ajh/core";

/** Distance (px) or flick speed (px/s) needed to commit a swipe. */
export const SWIPE_DISTANCE = 110;
export const SWIPE_VELOCITY = 650;

/** Strategy for turning a drag gesture into a decision. Pure, so it can be unit-tested. */
export function resolveSwipe(
  offset: { x: number; y: number },
  velocity: { x: number; y: number },
): SwipeDirection | null {
  const horizontal = Math.abs(offset.x) >= Math.abs(offset.y);
  if (horizontal) {
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) return "right";
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) return "left";
    return null;
  }
  if (offset.y < -SWIPE_DISTANCE || velocity.y < -SWIPE_VELOCITY) return "up";
  return null;
}

/** Where a card flies when it leaves the deck. */
export const EXIT_OFFSET: Record<SwipeDirection, { x: number; y: number; rotate: number }> = {
  right: { x: 600, y: 40, rotate: 20 },
  left: { x: -600, y: 40, rotate: -20 },
  up: { x: 0, y: -800, rotate: 0 },
};

export const SWIPE_LABEL: Record<SwipeDirection, string> = {
  right: "Added to your apply queue",
  left: "Passed",
  up: "Saved for later",
};
