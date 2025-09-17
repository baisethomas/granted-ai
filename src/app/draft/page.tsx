"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/stores/app";
import { exportElementToPdf } from "@/lib/export/pdf";
import { exportDraftToDocx } from "@/lib/export/docx";
import { copyToClipboard } from "@/lib/export/copy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function DraftPage() {
  const draft = useAppStore((s) => s.draft);
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Generated Draft</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={async () => { await copyToClipboard(draft); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="secondary" onClick={() => contentRef.current && exportElementToPdf(contentRef.current, "granted-draft.pdf")}>
            Export PDF
          </Button>
          <Button onClick={() => exportDraftToDocx(draft, "granted-draft.docx")}>Export DOCX</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={contentRef} className="prose prose-sm max-w-none whitespace-pre-wrap">
            {draft || "No draft yet. Generate one from the Grant Form page."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
