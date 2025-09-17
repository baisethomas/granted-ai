import { NextRequest, NextResponse } from "next/server";
import { buildOptimizedContext, buildRAGContext } from "@/lib/agent/context";

interface GenerateContextRequest {
  question: string;
  organizationId: string;
  questionType?: 'mission' | 'needs' | 'goals' | 'methods' | 'evaluation' | 'budget' | 'experience' | 'sustainability';
  options?: {
    limit?: number;
    similarityThreshold?: number;
    diversityFactor?: number;
    maxTokens?: number;
    keywords?: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GenerateContextRequest;
    const { question, organizationId, questionType, options } = body;

    if (!question || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: question, organizationId" },
        { status: 400 }
      );
    }

    let contextResult;

    if (questionType) {
      // Use optimized context for specific question types
      contextResult = await buildOptimizedContext(question, organizationId, questionType);
    } else {
      // Use general RAG context
      contextResult = await buildRAGContext(question, organizationId, options);
    }

    return NextResponse.json({
      success: true,
      context: contextResult.context,
      relevantChunks: contextResult.relevantChunks,
      totalTokens: contextResult.totalTokens,
      retrievalTimeMs: contextResult.retrievalTimeMs,
      sources: contextResult.sources,
    });
  } catch (error: any) {
    console.error("Error generating context:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to generate context",
        context: "Unable to retrieve relevant context from documents. Please ensure your documents have been processed and try again.",
        relevantChunks: [],
        totalTokens: 0,
        retrievalTimeMs: 0,
        sources: [],
      },
      { status: 500 }
    );
  }
}