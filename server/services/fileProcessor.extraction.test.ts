// @vitest-environment node

import { readFileSync, statSync } from "fs";
import { join } from "path";
import mammoth from "mammoth";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as pdfExtract from "../pdfExtract.js";
import { FileProcessor } from "./fileProcessor.js";
import { aiService } from "./ai.js";
import { chunkText } from "../workers/documentProcessor.js";

const FIXTURE_DIR = join(process.cwd(), "test/fixtures/nonprofit");

describe("nonprofit fixture extraction (GRA-9)", () => {
  let pdfBuffer: Buffer;
  let docxBuffer: Buffer;

  beforeAll(() => {
    pdfBuffer = readFileSync(join(FIXTURE_DIR, "community-impact-brief.pdf"));
    docxBuffer = readFileSync(join(FIXTURE_DIR, "community-impact-brief.docx"));
  });

  it("ships nonprofit PDF and DOCX fixtures for extraction validation", () => {
    expect(statSync(join(FIXTURE_DIR, "community-impact-brief.pdf")).size).toBeGreaterThan(500);
    expect(statSync(join(FIXTURE_DIR, "community-impact-brief.docx")).size).toBeGreaterThan(1000);
  });

  it("processes the PDF fixture through FileProcessor when extraction succeeds", async () => {
    vi.spyOn(pdfExtract, "extractPdfText").mockResolvedValue(
      "Riverside Community Food Bank annual report excerpt with program outcomes."
    );
    vi.spyOn(aiService, "summarizeDocument").mockResolvedValue("Annual report summary.");

    const processor = new FileProcessor();
    const result = await processor.processFile(
      pdfBuffer,
      "community-impact-brief.pdf",
      "application/pdf"
    );

    expect(pdfExtract.extractPdfText).toHaveBeenCalledWith(pdfBuffer);
    expect(result.extractedText.toLowerCase()).toContain("riverside community food bank");
    expect(result.summary).toContain("Annual report");
  });

  it("extracts usable body text from the DOCX fixture", async () => {
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    expect(result.value.length).toBeGreaterThan(50);
    expect(result.value).toContain("850 families");
    expect(result.value).toContain("$1.2 million");
  });

  it("creates summary output and chunk records from extracted nonprofit text", async () => {
    vi.spyOn(aiService, "summarizeDocument").mockResolvedValue(
      "Summary of Riverside Community Food Bank program impact and budget."
    );

    const processor = new FileProcessor();
    const result = await processor.processFile(
      docxBuffer,
      "community-impact-brief.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    expect(result.summary).toContain("Riverside");
    expect(result.extractedText).toContain("850 families");
    expect(result.rawTextBytes).toBeGreaterThan(0);

    const chunks = chunkText(result.extractedText, 1200, 200);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain("850 families");
    expect(chunks[0].tokenCount).toBeGreaterThan(5);
  });

  it("logs actionable errors when PDF extraction fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(aiService, "summarizeDocument").mockResolvedValue("fallback summary");
    vi.spyOn(pdfExtract, "extractPdfText").mockRejectedValue(new Error("corrupt PDF structure"));

    const processor = new FileProcessor();
    const result = await processor.processFile(
      Buffer.from("not-a-pdf"),
      "broken-report.pdf",
      "application/pdf"
    );

    expect(result.extractedText).toMatch(/Error processing PDF broken-report\.pdf/);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
