"use client";

import { useState } from "react";
import { updatePracticeTemplate } from "@/lib/grist";

interface UploadAudioButtonProps {
  type: 'reading' | 'speaking';
  id: number;
  onUploadSuccess: () => void;
}

export function UploadAudioButton({ type, id, onUploadSuccess }: UploadAudioButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to upload file");
      }

      const data = await res.json();
      const publitioId = data.id;

      // Update Grist
      const fields = type === 'reading' 
        ? { audioFileId: publitioId } 
        : { targetAudioFileId: publitioId };

      await updatePracticeTemplate(type, id, fields);
      onUploadSuccess();
    } catch (err: any) {
      console.error("Failed to upload voice over:", err);
      setError(err.message || "An error occurred");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg cursor-pointer transition-colors border border-indigo-200/50 dark:border-indigo-800/40 max-w-max">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {uploading ? "Uploading..." : "Upload Voice Over"}
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
        />
      </label>
      {error && (
        <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
          Upload failed: {error}
        </span>
      )}
    </div>
  );
}
