"use client";

import type { SwipeDirection } from "@ajh/core";
import { Check, RotateCcw, Star, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useMotionValue,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadMoreJobsAction, swipeAction, undoSwipeAction } from "@/app/actions/swipe";
import type { JobCardView } from "@/lib/presenters/job-card";
import { JobCard } from "./job-card";
import { EXIT_OFFSET, resolveSwipe, SWIPE_LABEL } from "./swipe-gesture";

const VISIBLE_CARDS = 3;
const REFILL_THRESHOLD = 3;

type HistoryEntry = { job: JobCardView; direction: SwipeDirection };

export function SwipeDeck({ initialJobs }: { initialJobs: JobCardView[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [exitDirection, setExitDirection] = useState<SwipeDirection>("left");
  const [announcement, setAnnouncement] = useState("");
  const [exhausted, setExhausted] = useState(false);
  const loading = useRef(false);

  // Refill the deck in the background as it runs low.
  useEffect(() => {
    if (exhausted || loading.current || jobs.length > REFILL_THRESHOLD) return;
    loading.current = true;
    const seen = [...jobs.map((j) => j.id), ...history.map((h) => h.job.id)];
    loadMoreJobsAction(seen).then((res) => {
      loading.current = false;
      if (!res.ok) return;
      if (res.data.length === 0) setExhausted(true);
      else setJobs((current) => [...current, ...res.data.filter((j) => !current.some((c) => c.id === j.id))]);
    });
  }, [jobs, history, exhausted]);

  const decide = useCallback(
    (direction: SwipeDirection) => {
      const job = jobs[0];
      if (!job) return;
      setExitDirection(direction);
      setJobs((current) => current.slice(1));
      setHistory((h) => [...h, { job, direction }]);
      setAnnouncement(`${SWIPE_LABEL[direction]}: ${job.title} at ${job.companyName}.`);

      swipeAction(job.id, direction).then((res) => {
        if (res.ok) return;
        // Roll back the optimistic update.
        setJobs((current) => [job, ...current.filter((j) => j.id !== job.id)]);
        setHistory((h) => h.filter((entry) => entry.job.id !== job.id));
        setAnnouncement(res.error);
      });
    },
    [jobs],
  );

  const undo = useCallback(async () => {
    const last = history.at(-1);
    if (!last) return;
    const res = await undoSwipeAction();
    if (!res.ok) return setAnnouncement(res.error);
    setHistory((h) => h.slice(0, -1));
    setJobs((current) => [last.job, ...current.filter((j) => j.id !== last.job.id)]);
    setExhausted(false);
    setAnnouncement(`Brought back ${last.job.title}.`);
  }, [history]);

  // Keyboard alternative to gestures (WCAG 2.5.1 / 2.1.1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      const map: Record<string, SwipeDirection> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up" };
      if (map[e.key]) {
        e.preventDefault();
        decide(map[e.key]!);
      } else if (e.key === "Backspace" || e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo]);

  const visible = jobs.slice(0, VISIBLE_CARDS);

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="Job deck" className="flex flex-1 flex-col gap-5">
        <div className="relative mx-auto h-[min(68dvh,580px)] w-full max-w-md">
          <AnimatePresence custom={exitDirection} initial={false}>
            {visible
              .map((job, index) => (
                <DeckCard key={job.id} job={job} depth={index} isTop={index === 0} onDecide={decide} />
              ))
              .reverse()}
          </AnimatePresence>
          {jobs.length === 0 && <EmptyDeck canUndo={history.length > 0} onUndo={undo} />}
        </div>

        <ActionBar disabled={jobs.length === 0} canUndo={history.length > 0} onDecide={decide} onUndo={undo} />

        <p className="text-center text-xs text-muted">
          Tip: swipe, or use <kbd className="font-mono">←</kbd> pass · <kbd className="font-mono">↑</kbd> save ·{" "}
          <kbd className="font-mono">→</kbd> apply · <kbd className="font-mono">Z</kbd> undo
        </p>

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </section>
    </MotionConfig>
  );
}

function DeckCard({
  job,
  depth,
  isTop,
  onDecide,
}: {
  job: JobCardView;
  depth: number;
  isTop: boolean;
  onDecide: (direction: SwipeDirection) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-14, 14]);
  const applyOpacity = useTransform(x, [30, 110], [0, 1]);
  const passOpacity = useTransform(x, [-110, -30], [1, 0]);
  const saveOpacity = useTransform(y, [-110, -30], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const direction = resolveSwipe(info.offset, info.velocity);
    if (direction) onDecide(direction);
  };

  return (
    <motion.div
      className="absolute inset-0 touch-none select-none"
      style={{ x, y, rotate, zIndex: 10 - depth }}
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1 - depth * 0.04, y: depth * 14, opacity: depth < 2 ? 1 : 0.6 }}
      exit={"exit"}
      variants={{
        exit: (direction: SwipeDirection) => ({
          ...EXIT_OFFSET[direction],
          opacity: 0,
          transition: { duration: 0.3 },
        }),
      }}
      drag={isTop}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      aria-hidden={!isTop}
      inert={!isTop}
    >
      <JobCard job={job} />
      {isTop && (
        <>
          <Stamp label="Apply" className="top-8 left-6 -rotate-12 border-apply text-apply" opacity={applyOpacity} />
          <Stamp label="Pass" className="top-8 right-6 rotate-12 border-pass text-pass" opacity={passOpacity} />
          <Stamp
            label="Save"
            className="bottom-24 left-1/2 -translate-x-1/2 border-save text-save"
            opacity={saveOpacity}
          />
        </>
      )}
    </motion.div>
  );
}

function Stamp({
  label,
  className,
  opacity,
}: {
  label: string;
  className: string;
  opacity: MotionValue<number>;
}) {
  return (
    <motion.span
      aria-hidden
      style={{ opacity }}
      className={`pointer-events-none absolute rounded-xl border-4 bg-card/80 px-3 py-1 text-3xl font-extrabold tracking-widest uppercase ${className}`}
    >
      {label}
    </motion.span>
  );
}

function ActionBar({
  disabled,
  canUndo,
  onDecide,
  onUndo,
}: {
  disabled: boolean;
  canUndo: boolean;
  onDecide: (direction: SwipeDirection) => void;
  onUndo: () => void;
}) {
  const base =
    "grid place-items-center rounded-full border-2 bg-card shadow-md transition active:scale-90 disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-2";
  return (
    <div className="flex items-center justify-center gap-4" role="group" aria-label="Swipe actions">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo last swipe"
        title="Undo (Z)"
        className={`${base} size-12 border-border text-muted focus-visible:outline-muted`}
      >
        <RotateCcw aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => onDecide("left")}
        disabled={disabled}
        aria-label="Pass on this job"
        title="Pass (←)"
        className={`${base} size-16 border-pass text-pass focus-visible:outline-pass`}
      >
        <X aria-hidden className="size-8" strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={() => onDecide("up")}
        disabled={disabled}
        aria-label="Save for later"
        title="Save (↑)"
        className={`${base} size-13 border-save text-save focus-visible:outline-save`}
      >
        <Star aria-hidden className="size-6" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => onDecide("right")}
        disabled={disabled}
        aria-label="Apply to this job"
        title="Apply (→)"
        className={`${base} size-16 border-apply text-apply focus-visible:outline-apply`}
      >
        <Check aria-hidden className="size-8" strokeWidth={3} />
      </button>
    </div>
  );
}

function EmptyDeck({ canUndo, onUndo }: { canUndo: boolean; onUndo: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center rounded-3xl border-2 border-dashed border-border p-8 text-center">
      <div className="space-y-3">
        <p className="text-lg font-semibold">You&apos;re all caught up</p>
        <p className="text-sm text-muted">New jobs arrive as sources refresh. Check back soon.</p>
        {canUndo && (
          <button type="button" onClick={onUndo} className="text-sm font-medium text-brand underline underline-offset-4">
            Undo last swipe
          </button>
        )}
      </div>
    </div>
  );
}
