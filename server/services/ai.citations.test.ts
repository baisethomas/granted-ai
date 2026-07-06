// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { findUnsupportedSpecifics, normalizeGroundedCitations, type RetrievedContextChunk } from "./ai.js";

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

describe("findUnsupportedSpecifics (GRA-52 citation-fabrication regression)", () => {
  // Reproduces the exact GRA-52 repro: a source chunk that mentions "three
  // counties in the region" without naming them, and a generated sentence
  // that names three specific, plausible county names next to the citation
  // for that chunk. The citation's *quote* is 100% accurate (it matches the
  // source verbatim), but the prose itself fabricates specificity the
  // source never provided — normalizeGroundedCitations alone cannot catch
  // this because it only verifies quotes, not surrounding prose.
  const foodBankChunks: RetrievedContextChunk[] = [
    {
      documentName: "Riverside Community Food Bank Overview.pdf",
      documentId: "doc-foodbank",
      chunkIndex: 1,
      content:
        "Riverside Community Food Bank provides meals to over 850 families each month across three counties in the region, addressing food insecurity through direct distribution, mobile pantries, and partnerships with 40 local agencies.",
    },
  ];

  it("flags fabricated county names introduced next to an accurate citation", () => {
    const text =
      "We serve over 850 families each month across Riverside, San Bernardino, and Orange counties [#1], addressing food insecurity through direct distribution, mobile pantries, and partnerships with 40 local agencies.";

    const { flaggedAssumptions } = findUnsupportedSpecifics(text, foodBankChunks);

    expect(flaggedAssumptions.length).toBeGreaterThan(0);
    const joined = flaggedAssumptions.join(" ");
    expect(joined).toMatch(/San Bernardino|Orange/);
  });

  it("does not flag specifics that are genuinely present in the cited chunk", () => {
    const text =
      "Riverside Community Food Bank serves over 850 families each month [#1].";

    const { flaggedAssumptions } = findUnsupportedSpecifics(text, foodBankChunks);

    expect(flaggedAssumptions).toEqual([]);
  });

  it("does not flag sentences with no citation marker", () => {
    const text = "We also work with the Orange County Housing Authority informally.";

    const { flaggedAssumptions } = findUnsupportedSpecifics(text, foodBankChunks);

    expect(flaggedAssumptions).toEqual([]);
  });

  it("ignores sentence-initial common words while still catching later proper nouns", () => {
    const text = "The organization partners with Metro Health Alliance to expand reach [#1].";

    const { flaggedAssumptions } = findUnsupportedSpecifics(text, foodBankChunks);

    expect(flaggedAssumptions.length).toBeGreaterThan(0);
    expect(flaggedAssumptions.join(" ")).toMatch(/Metro Health Alliance/);
  });
});
