"use client";

import UploadDropzone from "@/components/UploadDropzone";
import { useAppStore } from "@/stores/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function UploadPage() {
  const documents = useAppStore((s) => s.documents);

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Upload Documents</h1>

      <Card>
        <CardContent>
          <UploadDropzone />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingested Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-sm text-black/70">No documents yet. Drag and drop to upload and auto-summarize into your private memory.</div>
          ) : (
            documents.map((d) => (
              <div key={d.id} className="p-3 rounded-lg border border-black/10">
                <div className="font-medium">{d.name}</div>
                <div className="text-sm text-black/70 whitespace-pre-wrap mt-1">
                  {d.summary || "Summarizing…"}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
