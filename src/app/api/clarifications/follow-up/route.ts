import { NextRequest, NextResponse } from "next/server";
import { ClarificationEngine } from "@/lib/clarifications/engine";
import type { AnalysisContext, ClarificationSession } from "@/lib/clarifications/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session, grantQuestions, organizationId, existingContext, tone } = body as {
      session: ClarificationSession;
      grantQuestions: string[];
      organizationId: string;
      existingContext?: string;
      tone?: string;
    };

    if (!session || !session.projectId) {
      return NextResponse.json(
        { error: "Clarification session is required" },
        { status: 400 }
      );
    }

    if (!grantQuestions || !Array.isArray(grantQuestions)) {
      return NextResponse.json(
        { error: "Grant questions are required" },
        { status: 400 }
      );
    }

    // Build analysis context
    const context: AnalysisContext = {
      grantQuestions,
      organizationId: organizationId || "",
      availableDocuments: [], // TODO: Fetch from database
      existingContext: existingContext || "",
      tone: tone || "professional"
    };

    // Initialize clarification engine
    const engine = new ClarificationEngine();

    // Check if follow-ups are needed
    if (!engine.shouldGenerateFollowUps(session)) {
      return NextResponse.json({
        followUpQuestions: [],
        needsFollowUp: false,
        message: "No follow-up questions needed - answers are sufficiently detailed"
      });
    }

    // Generate follow-up questions
    const followUpQuestions = await engine.generateFollowUpQuestions(session, context);

    return NextResponse.json({
      followUpQuestions,
      needsFollowUp: followUpQuestions.length > 0,
      message: followUpQuestions.length > 0 
        ? `Generated ${followUpQuestions.length} follow-up questions to strengthen your responses`
        : "No additional follow-up questions needed"
    });

  } catch (error) {
    console.error("Error generating follow-up questions:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}