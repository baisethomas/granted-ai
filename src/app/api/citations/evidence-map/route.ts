/**
 * Evidence Map API Route
 * 
 * Generates and retrieves evidence maps for draft visualization and analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { CitationService } from "@/lib/citations/citation-service";

export async function POST(req: NextRequest) {
  try {
    const { draftId, questionId, regenerate = false } = await req.json();

    if (!draftId || !questionId) {
      return NextResponse.json(
        { error: "draftId and questionId are required" },
        { status: 400 }
      );
    }

    const citationService = new CitationService();

    // Generate new evidence map
    const evidenceMap = await citationService.generateEvidenceMap(draftId, questionId);

    return NextResponse.json({
      evidenceMap,
      generated: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Evidence map generation error:", error);
    return NextResponse.json(
      { 
        error: "Evidence map generation failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get('draftId');
    const questionId = searchParams.get('questionId');

    if (!draftId) {
      return NextResponse.json(
        { error: "draftId parameter is required" },
        { status: 400 }
      );
    }

    const citationService = new CitationService();

    // If questionId provided, generate evidence map for that specific question
    if (questionId) {
      const evidenceMap = await citationService.generateEvidenceMap(draftId, questionId);
      return NextResponse.json({
        evidenceMap,
        timestamp: new Date().toISOString()
      });
    }

    // Otherwise, get comprehensive citation analysis
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
    console.error("Evidence map retrieval error:", error);
    return NextResponse.json(
      { 
        error: "Failed to retrieve evidence map",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}