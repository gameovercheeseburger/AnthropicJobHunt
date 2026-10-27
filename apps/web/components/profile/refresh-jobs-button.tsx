"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { refreshJobsAction, type RefreshJobsState } from "@/app/actions/jobs";

export function RefreshJobsButton() {
  const [state, formAction, pending] = useActionState<RefreshJobsState>(refreshJobsAction, { status: "idle" });

  return (
    <form action={formAction} className="space-y-3 rounded-3xl border border-border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">Admin: job sources</h2>
        <p className="mt-1 text-sm text-muted">
          Jobs refresh automatically every day. Use this right after deploying, or to pull the latest now.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
      >
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RefreshCw aria-hidden className="size-4" />}
        {pending ? "Refreshing… (about a minute)" : "Refresh jobs now"}
      </button>
      <p role="status" aria-live="polite" className="text-sm">
        {state.status === "done" &&
          `Done: ${state.created} new, ${state.updated} updated, ${state.expired} expired` +
            (state.failedBoards ? `, ${state.failedBoards} board(s) unavailable.` : ".")}
        {state.status === "error" && <span className="text-pass">{state.message}</span>}
      </p>
    </form>
  );
}
