"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useActionState, useRef } from "react";
import { uploadResumeAction, type UploadState } from "@/app/actions/resume";

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function ResumeUploadForm({ hasResume }: { hasResume: boolean }) {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(uploadResumeAction, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-3xl border border-border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">{hasResume ? "Replace your resume" : "Upload your resume"}</h2>
        <p className="mt-1 text-sm text-muted">
          PDF or Word (.docx), up to 5 MB. AI reads it into your profile. It copies your wording and never adds
          experience you don&apos;t have.
        </p>
      </div>

      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-6 text-sm font-medium transition focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand hover:border-brand ${pending ? "pointer-events-none opacity-60" : ""}`}
      >
        {pending ? (
          <>
            <Loader2 aria-hidden className="size-5 animate-spin" /> Reading your resume… this can take up to a minute
          </>
        ) : (
          <>
            <FileUp aria-hidden className="size-5 text-brand" /> Choose a file
          </>
        )}
        <input
          type="file"
          name="resume"
          accept={ACCEPT}
          required
          disabled={pending}
          className="sr-only"
          // Submit as soon as a file is picked: one tap on mobile.
          onChange={(e) => e.currentTarget.files?.length && formRef.current?.requestSubmit()}
        />
      </label>

      <div role="status" aria-live="polite">
        {state.status === "error" && <p className="text-sm font-medium text-pass">{state.message}</p>}
        {state.status === "parsed" && (
          <p className="text-sm font-medium text-apply">
            Done! Review your profile below
            {state.warnings.length > 0 ? `, including ${state.warnings.length} item(s) to double-check.` : "."}
          </p>
        )}
      </div>
    </form>
  );
}
