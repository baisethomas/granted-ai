"use client";

import React, { useCallback, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { useAppStore } from "@/stores/app";
import { v4 as uuidv4 } from "uuid";

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export default function UploadDropzone() {
  const addDocument = useAppStore((s) => s.addDocument);
  const updateDocumentSummary = useAppStore((s) => s.updateDocumentSummary);
  const [isOver, setIsOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setIsUploading(true);

    const supabase = supabaseBrowserClient;

    for (const file of Array.from(files)) {
      const id = uuidv4();
      const path = `${id}/${file.name}`;

      try {
        if (supabase) {
          const { error: upErr } = await supabase.storage
            .from("documents")
            .upload(path, file, { cacheControl: "3600", upsert: false });
          if (upErr) throw upErr;
        }

        addDocument({ id, name: file.name, path });

        let text = "";
        try {
          text = await readFileAsText(file);
        } catch {
          // ignore read errors and still send empty text to summarizer
        }

        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documents: [{ name: file.name, text }] }),
        });
        const data = (await res.json()) as { perDocument?: Array<{ summary?: string }> };
        const summary: string | undefined = data?.perDocument?.[0]?.summary;
        if (summary) {
          updateDocumentSummary(id, summary);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Upload failed";
        setError(message);
      }
    }

    setIsUploading(false);
  }, [addDocument, updateDocumentSummary]);

  return (
    <div
      className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isOver ? "border-foreground bg-foreground/5" : "border-black/20"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onDrop(e.dataTransfer.files);
      }}
    >
      <input
        id="file-input"
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onDrop(e.target.files)}
      />
      <p className="mb-3">Drag and drop files here, or</p>
      <label htmlFor="file-input" className="cursor-pointer underline">
        browse to upload
      </label>
      {isUploading && <p className="mt-2 text-sm">Uploading & summarizing…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
