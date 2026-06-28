// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { normalizeGroundedCitations, type RetrievedContextChunk } from "./ai.js";

const chunks: RetrievedContextChunk[] = [
  {
    documentName: "Annual Report 2025.pdf",
    documentId: "doc-annual",
    chunkIndex: 4,
    content: "In 2025 we served 1,240 families across three counties with a staff of 12.",
  },
  {
    documentName: "Program Budget.xlsx",
    documentId: "doc-budget",
    chunkIndex: 9,
    content: "Total program cost is $185,000 including $42,000 in personnel expenses.",
  },
];

describe("normalizeGroundedCitations", () => {
  it("drops citations whose marker is out of range instead of attributing a real document", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = normalizeGroundedCitations(
      [{ marker: "#99", documentName: "Fabricated Doc.pdf", quote: "made-up statistic" }],
      chunks
    );
    expect(result).toEqual([]);
  });

  it("drops citations with no marker and no chunkIndex", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = normalizeGroundedCitations(
      [{ documentName: "Annual Report 2025.pdf", quote: "we served 1,240 families" }],
      chunks
    );
    expect(result).toEqual([]);
  });

  it("resolves a valid marker to the retrieved chunk's true document identity", () => {
    const result = normalizeGroundedCitations(
      [{ marker: "#2", documentName: "Wrong Name.pdf", documentId: "wrong-id" }],
      chunks
    );
    expect(result).toHaveLength(1);
    expect(result[0].documentName).toBe("Program Budget.xlsx");
    expect(result[0].documentId).toBe("doc-budget");
    expect(result[0].chunkIndex).toBe(9);
  });

  it("prefers chunkIndex match over marker", () => {
    const result = normalizeGroundedCitations([{ chunkIndex: 4, marker: "#2" }], chunks);
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe("doc-annual");
  });

  it("treats chunkIndex as 1-based snippet position when it does not match a stored chunk index", () => {
    const result = normalizeGroundedCitations([{ chunkIndex: 2 }], chunks);
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe("doc-budget");
    expect(result[0].chunkIndex).toBe(9);
  });

  it("keeps a model quote only when it appears verbatim in the matched chunk", () => {
    const [verbatim] = normalizeGroundedCitations(
      [{ marker: "#1", quote: "served 1,240 families" }],
      chunks
    );
    expect(verbatim.quote).toBe("served 1,240 families");

    const [fabricated] = normalizeGroundedCitations(
      [{ marker: "#1", quote: "we served 5,000 families" }],
      chunks
    );
    expect(fabricated.quote).toBe(chunks[0].content.slice(0, 160));
  });

  it("tolerates whitespace differences when verifying quotes", () => {
    const [result] = normalizeGroundedCitations(
      [{ marker: "#1", quote: "served  1,240\nfamilies" }],
      chunks
    );
    expect(result.quote).toBe("served  1,240\nfamilies");
  });

  it("returns an empty list for non-array or garbage input", () => {
    expect(normalizeGroundedCitations(undefined, chunks)).toEqual([]);
    expect(normalizeGroundedCitations("citations", chunks)).toEqual([]);
    expect(normalizeGroundedCitations([null, 42, "x"], chunks)).toEqual([]);
  });
});
