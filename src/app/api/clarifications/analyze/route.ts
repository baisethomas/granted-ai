import { NextRequest, NextResponse } from "next/server";
import { ClarificationEngine } from "@/lib/clarifications/engine";
import type { AnalysisContext } from "@/lib/clarifications/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { grantQuestions, organizationId, existingContext, tone } = body as {
      grantQuestions: string[];
      organizationId: string;
      existingContext?: string;
      tone?: string;
    };

    if (!grantQuestions || !Array.isArray(grantQuestions) || grantQuestions.length === 0) {
      return NextResponse.json(
        { error: "Grant questions are required" },
        { status: 400 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Build analysis context
    const context: AnalysisContext = {
      grantQuestions,
      organizationId,
      availableDocuments: [], // TODO: Fetch from database
      existingContext: existingContext || "",
      tone: tone || "professional"
    };

    // Initialize clarification engine
    const engine = new ClarificationEngine({
      maxQuestions: 5,
      minCriticalQuestions: 1,
      skipThreshold: 1,
      assumptionThreshold: 0.7
    });

    // Generate clarification questions
    const questions = await engine.generateClarifications(context);

    return NextResponse.json({
      questions,
      hasQuestions: questions.length > 0,
      analysisComplete: true
    });

  } catch (error) {
    console.error("Error analyzing for clarifications:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}