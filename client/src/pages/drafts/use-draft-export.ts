import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { ExportData } from "@/lib/export";
import { exportToClipboard, exportToPDF, exportToWord, validateExportData } from "@/lib/export";

/**
 * Custom hook for managing draft export functionality
 */
export function useDraftExport() {
  const { toast } = useToast();
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const [exportingWord, setExportingWord] = useState<boolean>(false);
  const [exportingClipboard, setExportingClipboard] = useState<boolean>(false);

  const createExportData = (projectTitle: string, questions: any[]): ExportData => ({
    project: {
      id: "",
      title: projectTitle,
      funder: "",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    questions,
    metadata: {
      exportDate: new Date(),
    },
  });

  const handleExportToPDF = async (projectTitle: string, questions: any[]) => {
    const exportData = createExportData(projectTitle, questions);
    const validation = validateExportData(exportData);
    if (!validation.valid) {
      toast({
        title: "Cannot export",
        description: validation.errors.join(" "),
        variant: "destructive",
      });
      return;
    }

    try {
      setExportingPDF(true);
      await exportToPDF(exportData);
      toast({
        title: "Export successful",
        description: "Your grant responses have been exported to PDF.",
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      toast({
        title: "Export failed",
        description: "Failed to export to PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportToWord = async (projectTitle: string, questions: any[]) => {
    const exportData = createExportData(projectTitle, questions);
    const validation = validateExportData(exportData);
    if (!validation.valid) {
      toast({
        title: "Cannot export",
        description: validation.errors.join(" "),
        variant: "destructive",
      });
      return;
    }

    try {
      setExportingWord(true);
      await exportToWord(exportData);
      toast({
        title: "Export successful",
        description: "Your grant responses have been exported to Word.",
      });
    } catch (error) {
      console.error("Word export failed:", error);
      toast({
        title: "Export failed",
        description: "Failed to export to Word. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingWord(false);
    }
  };

  const handleCopyToClipboard = async (projectTitle: string, questions: any[]) => {
    const exportData = createExportData(projectTitle, questions);
    const validation = validateExportData(exportData);
    if (!validation.valid) {
      toast({
        title: "Cannot copy",
        description: validation.errors.join(" "),
        variant: "destructive",
      });
      return;
    }

    try {
      setExportingClipboard(true);
      await exportToClipboard(exportData);
      toast({
        title: "Copied to clipboard",
        description: "Your grant responses have been copied to the clipboard.",
      });
    } catch (error) {
      console.error("Clipboard copy failed:", error);
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingClipboard(false);
    }
  };

  return {
    exportingPDF,
    exportingWord,
    exportingClipboard,
    handleExportToPDF,
    handleExportToWord,
    handleCopyToClipboard,
  };
}
