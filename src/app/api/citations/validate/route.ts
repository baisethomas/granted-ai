/**
 * Citation Validation API Route
 * 
 * Handles real-time validation of citations and provides grounding quality analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { CitationService } from "@/lib/citations/citation-service";

export async function POST(req: NextRequest) {
  try {
    const { paragraphId, draftId, action } = await req.json();

    if (!paragraphId) {
      return NextResponse.json(
        { error: "paragraphId is required" },
        { status: 400 }
      );
    }

    const citationService = new CitationService();

    switch (action) {
      case 'validate':
        const validation = await citationService.validateCitationsRealTime(paragraphId);
        return NextResponse.json({ validation });

      case 'get_stats':
        if (!draftId) {
          return NextResponse.json(
            { error: "draftId is required for stats" },
            { status: 400 }
          );
        }
        const stats = await citationService.getDraftCitationStats(draftId);
        return NextResponse.json({ stats });

      case 'identify_issues':
        if (!draftId) {
          return NextResponse.json(
            { error: "draftId is required for issue identification" },
            { status: 400 }
          );
        }
        const issues = await citationService.identifyUnsupportedClaims(draftId);
        return NextResponse.json({ issues });

      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'validate', 'get_stats', or 'identify_issues'" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Citation validation error:", error);
    return NextResponse.json(
      { 
        error: "Citation validation failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// GET method for batch validation
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json(
        { error: "draftId parameter is required" },
        { status: 400 }
      );
    }

    const citationService = new CitationService();

    // Get comprehensive validation data
    const [stats, issues] = await Promise.all([
      citationService.getDraftCitationStats(draftId),
      citationService.identifyUnsupportedClaims(draftId)
    ]);

    return NextResponse.json({
      draftId,
      stats,
      issues,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Citation validation GET error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get validation data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}