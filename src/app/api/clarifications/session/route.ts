import { NextRequest, NextResponse } from "next/server";
import { ClarificationEngine } from "@/lib/clarifications/engine";
import { clarificationDb } from "@/lib/clarifications/database";
import type { AnalysisContext, ClarificationAnswer } from "@/lib/clarifications/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, grantQuestions, organizationId, existingContext, tone } = body as {
      projectId: string;
      grantQuestions: string[];
      organizationId: string;
      existingContext?: string;
      tone?: string;
    };

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    if (!grantQuestions || !Array.isArray(grantQuestions)) {
      return NextResponse.json(
        { error: "Grant questions are required" },
        { status: 400 }
      );
    }

    // Build analysis context with database document retrieval
    const context = await clarificationDb.buildEnhancedAnalysisContext(
      grantQuestions,
      organizationId || "",
      existingContext,
      tone
    );

    // Initialize clarification engine with RAG enabled
    const engine = new ClarificationEngine({ useRAG: true });

    // Generate clarification questions
    const questions = await engine.generateClarifications(context);

    // Create and store clarification session in database
    const session = await clarificationDb.createSession(
      projectId,
      organizationId || "",
      questions,
      grantQuestions,
      existingContext
    );

    if (!session) {
      return NextResponse.json(
        { error: "Failed to create clarification session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session,
      hasQuestions: session.questions.length > 0
    });

  } catch (error) {
    console.error("Error creating clarification session:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, answers } = body as {
      sessionId: string;
      answers: ClarificationAnswer[];
    };

    if (!sessionId || !answers) {
      return NextResponse.json(
        { error: "Session ID and answers are required" },
        { status: 400 }
      );
    }

    // Update session with answers in database
    const updatedSession = await clarificationDb.updateSessionWithAnswers(sessionId, answers);

    if (!updatedSession) {
      return NextResponse.json(
        { error: "Failed to update clarification session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session: updatedSession,
      completionRate: updatedSession.completionRate,
      isComplete: updatedSession.status === 'completed'
    });

  } catch (error) {
    console.error("Error updating clarification session:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const organizationId = searchParams.get('organizationId');
    const action = searchParams.get('action') || 'get'; // 'get' or 'list'

    if (action === 'list') {
      // List recent sessions for organization
      if (!organizationId) {
        return NextResponse.json(
          { error: "Organization ID is required for listing sessions" },
          { status: 400 }
        );
      }

      const limit = parseInt(searchParams.get('limit') || '10');
      const sessions = await clarificationDb.getRecentSessions(organizationId, limit);

      return NextResponse.json({
        sessions,
        count: sessions.length
      });
    } else {
      // Get specific session
      if (!sessionId) {
        return NextResponse.json(
          { error: "Session ID is required" },
          { status: 400 }
        );
      }

      const session = await clarificationDb.getSessionById(sessionId);

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        session,
        hasQuestions: session.questions.length > 0
      });
    }

  } catch (error) {
    console.error("Error retrieving clarification session:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}