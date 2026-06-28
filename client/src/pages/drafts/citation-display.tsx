import React from "react";

export type DraftCitation = {
  documentName?: string | null;
  originalName?: string | null;
  filename?: string | null;
  documentId?: string | null;
  sourceDocumentId?: string | null;
  chunkIndex?: number | null;
  quote?: string | null;
  chunkRefs?: Array<{ chunkIndex?: number; quote?: string }>;
};

export function getCitationDocumentName(
  citation: DraftCitation | undefined,
  fallbackIndex: number
): string {
  if (!citation) return `Source ${fallbackIndex}`;
  return (
    citation.documentName ||
    citation.originalName ||
    citation.filename ||
    citation.documentId ||
    citation.sourceDocumentId ||
    `Source ${fallbackIndex}`
  );
}

export function getCitationQuote(citation: DraftCitation | undefined): string {
  if (!citation) return "";
  if (typeof citation.quote === "string" && citation.quote) return citation.quote;
  const firstRef = Array.isArray(citation.chunkRefs) ? citation.chunkRefs[0] : undefined;
  return typeof firstRef?.quote === "string" ? firstRef.quote : "";
}

export type ResponseSegment =
  | { type: "text"; value: string }
  | { type: "marker"; value: string; markerIndex: number };

/** Split draft body text on inline [#N] citation markers (1-based). */
export function splitResponseWithCitationMarkers(text: string): ResponseSegment[] {
  if (!text) return [];

  const segments: ResponseSegment[] = [];
  const pattern = /\[#(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const markerIndex = parseInt(match[1], 10);
    segments.push({ type: "marker", value: match[0], markerIndex });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

type ResponseWithCitationMarkersProps = {
  text: string;
  citations?: DraftCitation[] | null;
  citationListId?: string;
};

export function ResponseWithCitationMarkers({
  text,
  citations = [],
  citationListId,
}: ResponseWithCitationMarkersProps) {
  const citationItems = Array.isArray(citations) ? citations : [];
  const segments = splitResponseWithCitationMarkers(text);

  const scrollToCitation = (markerIndex: number) => {
    if (!citationListId) return;
    const target = document.getElementById(`${citationListId}-item-${markerIndex - 1}`);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <React.Fragment key={`text-${index}`}>{segment.value}</React.Fragment>;
        }

        const citation = citationItems[segment.markerIndex - 1];
        const docName = getCitationDocumentName(citation, segment.markerIndex);
        const quote = getCitationQuote(citation);
        const title = quote ? `${docName}: “${quote.slice(0, 160)}”` : docName;

        return (
          <button
            key={`marker-${index}-${segment.markerIndex}`}
            type="button"
            title={title}
            onClick={() => scrollToCitation(segment.markerIndex)}
            className="mx-0.5 inline rounded px-0.5 font-medium text-blue-700 underline decoration-dotted underline-offset-2 hover:bg-blue-50 hover:text-blue-900"
          >
            {segment.value}
          </button>
        );
      })}
    </>
  );
}

export function getResponseTrustSummary(input: {
  citations?: DraftCitation[] | null;
  assumptions?: unknown[] | null;
}): string | null {
  const citationCount = Array.isArray(input.citations) ? input.citations.length : 0;
  const assumptions = Array.isArray(input.assumptions) ? input.assumptions : [];
  const unresolvedGaps = assumptions.filter((item) => {
    if (typeof item === "string") return true;
    if (item && typeof item === "object" && "resolved" in item) {
      return (item as { resolved?: boolean }).resolved !== true;
    }
    return true;
  }).length;

  if (citationCount > 0 && unresolvedGaps > 0) {
    return `This answer cites ${citationCount} source${citationCount === 1 ? "" : "s"} from your documents and flags ${unresolvedGaps} gap${unresolvedGaps === 1 ? "" : "s"} that need your input.`;
  }
  if (citationCount > 0) {
    return `This answer cites ${citationCount} source${citationCount === 1 ? "" : "s"} from your uploaded documents. Hover or click [#N] markers to see which document each claim comes from.`;
  }
  if (unresolvedGaps > 0) {
    return `No supporting citations were found in your documents. Review the gaps below before exporting.`;
  }
  return null;
}
