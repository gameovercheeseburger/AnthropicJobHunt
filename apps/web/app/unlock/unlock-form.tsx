"use client";

import { Lock } from "lucide-react";
import { useActionState } from "react";
import { unlockAction, type UnlockState } from "@/app/actions/unlock";

const INPUT =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function UnlockForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(unlockAction, { error: null });

  return (
    <form action={formAction} className="w-full space-y-4 rounded-3xl border border-border bg-card p-6">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          aria-invalid={Boolean(state.error)}
          className={INPUT}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "password-error" : undefined}
          className={INPUT}
        />
      </div>
      {state.error && (
        <p id="password-error" role="alert" className="text-sm font-medium text-pass">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-brand-foreground disabled:opacity-60"
      >
        <Lock aria-hidden className="size-4" /> {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
