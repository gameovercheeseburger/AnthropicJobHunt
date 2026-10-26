import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/site-gate";
import { UnlockForm } from "./unlock-form";

export const metadata: Metadata = { title: "Private beta", robots: { index: false, follow: false } };

export default function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          AnthropicJob<span className="text-brand">Hunt</span>
        </h1>
        <p className="text-sm text-muted">Private beta. Admin sign-in.</p>
      </div>
      <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-3xl bg-chip" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/unlock">, "searchParams">) {
  const { next } = await searchParams;
  return <UnlockForm next={safeNextPath(next)} />;
}
