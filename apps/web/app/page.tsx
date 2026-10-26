import { connection } from "next/server";
import { Suspense } from "react";
import { SwipeDeck } from "@/components/swipe/swipe-deck";
import { container } from "@/lib/container";
import { requireUserId } from "@/lib/current-user";
import { presentJobCard } from "@/lib/presenters/job-card";

export default function DiscoverPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-24">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">
          AnthropicJob<span className="text-brand">Hunt</span>
        </h1>
        <p className="text-sm text-muted">Discover</p>
      </header>
      <Suspense fallback={<DeckSkeleton />}>
        <Deck />
      </Suspense>
    </main>
  );
}

/** Request-time: depends on who is swiping, so it streams in behind Suspense. */
async function Deck() {
  await connection();
  const jobs = await container().feed.getDeck(await requireUserId());
  return <SwipeDeck initialJobs={jobs.map((job) => presentJobCard(job))} />;
}

function DeckSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading jobs" className="flex flex-1 flex-col gap-5">
      <div className="mx-auto h-[min(68dvh,580px)] w-full max-w-md animate-pulse rounded-3xl bg-chip" />
      <div className="mx-auto h-16 w-64 animate-pulse rounded-full bg-chip" />
    </div>
  );
}
