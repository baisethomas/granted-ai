import { Button } from "@/components/ui/button";
import { Copy, FileText, Download, Loader2 } from "lucide-react";

interface DraftExportToolbarProps {
  projectTitle: string;
  questions: any[];
  onExportPDF: (title: string, questions: any[]) => Promise<void>;
  onExportWord: (title: string, questions: any[]) => Promise<void>;
  onCopyToClipboard: (title: string, questions: any[]) => Promise<void>;
  exportingPDF: boolean;
  exportingWord: boolean;
  exportingClipboard: boolean;
  disabled?: boolean;
}

export function DraftExportToolbar({
  projectTitle,
  questions,
  onExportPDF,
  onExportWord,
  onCopyToClipboard,
  exportingPDF,
  exportingWord,
  exportingClipboard,
  disabled = false,
}: DraftExportToolbarProps) {
  return (
    <div className="flex items-center space-x-2">
      <Button
        onClick={() => onCopyToClipboard(projectTitle, questions)}
        disabled={disabled || exportingClipboard}
        variant="outline"
        size="sm"
      >
        {exportingClipboard ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Copy className="mr-2 h-4 w-4" />
        )}
        Copy to Clipboard
      </Button>
      <Button
        onClick={() => onExportPDF(projectTitle, questions)}
        disabled={disabled || exportingPDF}
        variant="outline"
        size="sm"
      >
        {exportingPDF ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Export PDF
      </Button>
      <Button
        onClick={() => onExportWord(projectTitle, questions)}
        disabled={disabled || exportingWord}
        variant="outline"
        size="sm"
      >
        {exportingWord ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export Word
      </Button>
    </div>
  );
}
