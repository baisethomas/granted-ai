// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRANT_RETRIEVAL_CASES } from "../../test/fixtures/retrieval/grant-retrieval-cases.js";
import { retrieveRelevantChunks } from "./retrieval.js";
import * as embedding from "./embedding.js";
import { storage } from "../storage.js";

const userId = "user-test";
const organizationId = "org-test";

function makeChunk(
  id: string,
  documentName: string,
  content: string,
  similarity: number,
  chunkIndex = 0
) {
  return {
    chunk: {
      id,
      chunkIndex,
      content,
      tokenCount: content.split(/\s+/).length,
    },
    document: {
      id: `doc-${documentName}`,
      originalName: documentName,
      filename: documentName,
      uploadedAt: new Date().toISOString(),
    },
    similarity,
  };
}

describe("hybrid retrieval evaluation (GRA-10)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(embedding, "generateEmbedding").mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      model: "text-embedding-3-small",
    });
  });

  it("defines at least five representative grant retrieval cases", () => {
    expect(GRANT_RETRIEVAL_CASES.length).toBeGreaterThanOrEqual(5);
  });

  for (const testCase of GRANT_RETRIEVAL_CASES) {
    it(`retrieves expected sources for: ${testCase.id}`, async () => {
      const impactBrief = makeChunk(
        `chunk-${testCase.id}-impact`,
        "community-impact-brief.docx",
        "Riverside Community Food Bank provides meals to over 850 families each month across three counties. Budget is $1.2 million with 72% to program services.",
        0.82
      );
      const annualReport = makeChunk(
        `chunk-${testCase.id}-annual`,
        "annual-report.pdf",
        "Riverside Community Food Bank annual report excerpt covering counties served and program outcomes.",
        0.55
      );
      const noise = makeChunk(
        `chunk-${testCase.id}-noise`,
        "unrelated-policy.pdf",
        "Generic HR policy unrelated to grant narrative.",
        0.12
      );

      vi.spyOn(storage, "searchDocChunksByEmbeddingForOrganization").mockResolvedValue([
        impactBrief,
        annualReport,
        noise,
      ]);
      vi.spyOn(storage, "searchDocChunksByKeywordForOrganization").mockImplementation(
        async (_uid, _org, query) => {
          const q = query.toLowerCase();
          const hits = [];
          if (q.includes("count") || q.includes("counties")) hits.push(annualReport);
          if (q.includes("budget") || q.includes("850") || q.includes("families")) hits.push(impactBrief);
          return hits;
        }
      );

      const result = await retrieveRelevantChunks({
        userId,
        organizationId,
        query: testCase.question,
      });

      const retrievedNames = result.chunks.map((c) => c.documentName);
      for (const expected of testCase.expectedDocumentNames) {
        expect(retrievedNames).toContain(expected);
      }
      expect(result.chunks.every((c) => (c.similarity ?? 0) >= 0.3 || c.source === "keyword")).toBe(
        true
      );
      expect(result.embeddingGenerated).toBe(true);
    });
  }

  it("documents poor retrieval: semantic-only chunks below minSimilarity are dropped", async () => {
    const low = makeChunk("low", "annual-report.pdf", "tangential mention of riverside", 0.15);
    vi.spyOn(storage, "searchDocChunksByEmbeddingForOrganization").mockResolvedValue([low]);
    vi.spyOn(storage, "searchDocChunksByKeywordForOrganization").mockResolvedValue([]);

    const result = await retrieveRelevantChunks({
      userId,
      organizationId,
      query: "unrelated obscure topic with no keyword overlap",
    });

    expect(result.chunks).toHaveLength(0);
  });

  it("keeps keyword matches even when semantic similarity is low", async () => {
    const keywordHit = makeChunk(
      "kw",
      "community-impact-brief.docx",
      "850 families served monthly",
      0.1
    );
    vi.spyOn(storage, "searchDocChunksByEmbeddingForOrganization").mockResolvedValue([]);
    vi.spyOn(storage, "searchDocChunksByKeywordForOrganization").mockResolvedValue([keywordHit]);

    const result = await retrieveRelevantChunks({
      userId,
      organizationId,
      query: "850 families",
    });

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].source).toBe("keyword");
    expect(result.chunks[0].documentName).toBe("community-impact-brief.docx");
  });
});
