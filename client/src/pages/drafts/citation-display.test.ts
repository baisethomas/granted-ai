import { describe, expect, it } from "vitest";
import {
  getCitationDocumentName,
  getCitationQuote,
  getResponseTrustSummary,
  splitResponseWithCitationMarkers,
} from "./citation-display";

describe("splitResponseWithCitationMarkers", () => {
  it("splits text around [#N] markers", () => {
    expect(splitResponseWithCitationMarkers("We served 1,240 families [#1] last year.")).toEqual([
      { type: "text", value: "We served 1,240 families " },
      { type: "marker", value: "[#1]", markerIndex: 1 },
      { type: "text", value: " last year." },
    ]);
  });

  it("returns a single text segment when no markers are present", () => {
    expect(splitResponseWithCitationMarkers("Plain answer text.")).toEqual([
      { type: "text", value: "Plain answer text." },
    ]);
  });
});

describe("citation helpers", () => {
  it("prefers documentName for display", () => {
    expect(getCitationDocumentName({ documentName: "Annual Report.pdf" }, 1)).toBe(
      "Annual Report.pdf"
    );
  });

  it("reads quote from chunkRefs fallback", () => {
    expect(
      getCitationQuote({
        chunkRefs: [{ quote: "served 1,240 families" }],
      })
    ).toBe("served 1,240 families");
  });
});

describe("getResponseTrustSummary", () => {
  it("describes mixed citations and gaps", () => {
    expect(
      getResponseTrustSummary({
        citations: [{ documentName: "A" }, { documentName: "B" }],
        assumptions: [{ text: "Gap?", resolved: false }],
      })
    ).toContain("2 sources");
  });

  it("warns when only gaps are present", () => {
    expect(
      getResponseTrustSummary({
        citations: [],
        assumptions: ["Missing budget detail?"],
      })
    ).toContain("No supporting citations");
  });
});
