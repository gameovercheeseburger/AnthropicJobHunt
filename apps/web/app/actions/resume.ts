"use server";

import { ValidationError, type VerificationWarning } from "@ajh/core";
import { refresh } from "next/cache";
import { container } from "@/lib/container";
import { requireUserId } from "@/lib/current-user";

export type UploadState =
  | { status: "idle" }
  | { status: "parsed"; warnings: VerificationWarning[] }
  | { status: "error"; message: string };

export async function uploadResumeAction(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a PDF or Word (.docx) file to upload." };
  }

  try {
    const result = await container().resumes.uploadMasterResume(await requireUserId(), {
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    refresh();
    return result.status === "parsed"
      ? { status: "parsed", warnings: result.warnings }
      : { status: "error", message: result.error };
  } catch (err) {
    if (err instanceof ValidationError) return { status: "error", message: err.message };
    console.error("uploadResumeAction failed", err);
    return { status: "error", message: "Upload failed. Please try again." };
  }
}
