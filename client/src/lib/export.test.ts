// @vitest-environment node

import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { Packer } from "docx";
import { GRANT_EXPORT_FIXTURE } from "../../../test/fixtures/export/grant-export-cases";
import {
  buildClipboardText,
  createPdfDocument,
  createWordDocument,
  exportToClipboard,
  exportToPDF,
  exportToWord,
  pdfExport,
  stripMarkdown,
  validateExportData,
  type ExportData,
} from "./export";

function decodePdfBytes(bytes: ArrayBuffer): string {
  return new TextDecoder("latin1").decode(new Uint8Array(bytes));
}

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

import { saveAs } from "file-saver";

const mockExportData: ExportData = {
  project: {
    id: "1",
    title: "Test Grant Application",
    funder: "Test Foundation",
    amount: "$50,000",
    deadline: "2024-12-31",
    status: "draft",
    description: "This is a test grant application for educational purposes.",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
  },
  questions: [
    {
      id: "1",
      projectId: "1",
      question: "What is the main objective of your project?",
      wordLimit: 500,
      priority: "high",
      response:
        "Our main objective is to improve educational outcomes through innovative technology solutions.",
      responseStatus: "complete",
      createdAt: new Date("2024-01-01"),
    },
    {
      id: "2",
      projectId: "1",
      question: "How will you measure success?",
      wordLimit: 300,
      priority: "high",
      response:
        "We will measure success through standardized test scores, student engagement metrics, and teacher feedback.",
      responseStatus: "complete",
      createdAt: new Date("2024-01-01"),
    },
  ],
  metadata: {
    exportDate: new Date(),
    organizationName: "Test Educational Organization",
  },
};

describe("export validation", () => {
  it("accepts complete export data", () => {
    const result = validateExportData(mockExportData);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects missing project and question data with user-visible errors", () => {
    const invalidData = {
      ...mockExportData,
      project: {
        ...mockExportData.project,
        title: "",
        funder: "",
      },
      questions: [],
    };

    const result = validateExportData(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "Project title is required",
      "Project funder is required",
      "At least one completed question is required for export",
    ]);
  });
});

describe("export formatting (GRA-14)", () => {
  beforeEach(() => {
    vi.mocked(saveAs).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("strips markdown artifacts from AI responses", () => {
    const cleaned = stripMarkdown(
      "**Riverside Community Food Bank** serves over *850 families* monthly.\n\nCitations:\n- doc1"
    );

    expect(cleaned).not.toContain("**");
    expect(cleaned).not.toContain("*850");
    expect(cleaned).toContain("Riverside Community Food Bank");
    expect(cleaned).toContain("850 families");
    expect(cleaned).not.toContain("Citations:");
  });

  it("retains useful clipboard structure for grant workflows", () => {
    const text = buildClipboardText(GRANT_EXPORT_FIXTURE);

    expect(text).toContain("Riverside Community Food Bank - Grant Application");
    expect(text).toContain("Project Title: Community Food Access Initiative");
    expect(text).toContain("Grant Application Responses:");
    expect(text).toContain("1. Describe your organization's mission and community impact.");
    expect(text).toContain("2. Outline your program budget and fiscal oversight.");
    expect(text).not.toContain("Pending draft question");
    expect(text).toContain("[NEEDS YOUR INPUT: What is the current monthly families served figure?]");
    expect(text).toContain("---");
    expect(text).toContain("Generated on:");
  });

  it("copies formatted grant text via clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await exportToClipboard(GRANT_EXPORT_FIXTURE);

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain("Riverside Community Food Bank - Grant Application");
    expect(writeText.mock.calls[0][0]).toContain("[NEEDS YOUR INPUT: What is the current monthly families served figure?]");
  });

  it("produces a readable PDF with grant sections and gap callouts", () => {
    const doc = createPdfDocument(GRANT_EXPORT_FIXTURE);
    const pdfBytes = doc.output("arraybuffer");
    const pdfText = decodePdfBytes(pdfBytes);
    const header = new TextDecoder().decode(new Uint8Array(pdfBytes).slice(0, 5));

    expect(header).toBe("%PDF-");
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
    expect(pdfText).toContain("Grant Application Responses");
    expect(pdfText).toContain("Project Information");
    expect(pdfText).toContain(
      "[NEEDS YOUR INPUT: What is the current monthly families served figure?]"
    );
  });

  it("produces a Word-compatible DOCX package", async () => {
    const doc = createWordDocument(GRANT_EXPORT_FIXTURE);
    const buffer = await Packer.toBuffer(doc);

    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(buffer.byteLength).toBeGreaterThan(3000);

    await exportToWord(GRANT_EXPORT_FIXTURE);
    expect(saveAs).toHaveBeenCalledWith(
      expect.any(Blob),
      "Community-Food-Access-Initiative-Grant-Application.docx"
    );
  });

  it("surfaces DOCX generation failures to callers", async () => {
    vi.spyOn(Packer, "toBlob").mockRejectedValueOnce(new Error("pack failed"));

    await expect(exportToWord(mockExportData)).rejects.toThrow(
      "Failed to generate Word document. Please try again."
    );
  });

  it("surfaces PDF export failures to callers", async () => {
    vi.spyOn(pdfExport, "saveDocument").mockImplementation(() => {
      throw new Error("save blocked");
    });

    await expect(exportToPDF(mockExportData)).rejects.toThrow(
      "Failed to generate PDF document. Please try again."
    );
  });
});
