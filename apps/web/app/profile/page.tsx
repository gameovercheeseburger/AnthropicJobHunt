import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/profile-view";
import { ResumeUploadForm } from "@/components/profile/resume-upload-form";
import { container } from "@/lib/container";
import { requireUserId } from "@/lib/current-user";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
      <h1 className="text-lg font-bold tracking-tight">Profile</h1>
      <Suspense fallback={<div aria-busy="true" aria-label="Loading profile" className="h-40 animate-pulse rounded-3xl bg-chip" />}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}

/** Request-time: the profile belongs to the signed-in user. */
async function ProfileContent() {
  await connection();
  const profile = await container().resumes.getProfile(await requireUserId());
  const master = profile.masterResume;

  return (
    <>
      <ResumeUploadForm hasResume={master?.parseStatus === "parsed"} />
      {master?.parseStatus === "failed" && (
        <p role="alert" className="rounded-2xl border border-pass/40 bg-card p-4 text-sm">
          We couldn&apos;t read <span className="font-medium">{master.fileName}</span>: {master.parseError}
        </p>
      )}
      {master?.parseStatus === "parsed" ? (
        <ProfileView profile={profile} />
      ) : (
        <p className="text-sm text-muted">
          Upload your resume to build your profile. It powers job matching and tailored resumes.
        </p>
      )}
    </>
  );
}
