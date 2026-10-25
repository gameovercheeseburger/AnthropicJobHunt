// Swipe decisions and the application lifecycle they feed into.

export const SWIPE_DIRECTIONS = ["left", "right", "up"] as const;
export type SwipeDirection = (typeof SWIPE_DIRECTIONS)[number];

export const APPLICATION_STATUSES = [
  "queued", // swiped right: waiting for resume tailoring + user review
  "saved", // swiped up: decide later
  "applied",
  "interviewing",
  "offer",
  "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** What each swipe means. Left (pass) creates no application. */
export const SWIPE_OUTCOME: Record<SwipeDirection, ApplicationStatus | null> = {
  right: "queued",
  up: "saved",
  left: null,
};

export interface Swipe {
  userId: string;
  jobId: string;
  direction: SwipeDirection;
  createdAt: Date;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function isSwipeDirection(value: unknown): value is SwipeDirection {
  return typeof value === "string" && (SWIPE_DIRECTIONS as readonly string[]).includes(value);
}
