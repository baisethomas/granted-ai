import { NextRequest, NextResponse } from "next/server";
import { ClarificationEngine } from "@/lib/clarifications/engine";
import type { AnalysisContext } from "@/lib/clarifications/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { generatedText, grantQuestions, organizationId, existingContext } = body as {
      generatedText: string;
      grantQuestions: string[];
      organizationId: string;
      existingContext?: string;
    };

    if (!generatedText) {
      return NextResponse.json(
        { error: "Generated text is required" },
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
      tone: "professional"
    };

    // Initialize clarification engine
    const engine = new ClarificationEngine();

    // Analyze generated content for assumptions
    const analysis = await engine.analyzeGeneratedContent(generatedText, context);

    return NextResponse.json({
      assumptions: analysis.assumptions,
      labeledText: analysis.labeledText,
      suggestedQuestions: analysis.suggestedQuestions,
      hasAssumptions: analysis.assumptions.length > 0
    });

  } catch (error) {
    console.error("Error analyzing assumptions:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}