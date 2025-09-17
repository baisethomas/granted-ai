import { NextRequest, NextResponse } from "next/server";
import { RAGPipeline } from "@/lib/rag/pipeline";

interface ProcessDocumentRequest {
  documentId: string;
  content: string;
  filename: string;
  options?: {
    chunkingOptions?: {
      maxTokens?: number;
      overlapTokens?: number;
      preserveStructure?: boolean;
    };
    embeddingOptions?: {
      batchSize?: number;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ProcessDocumentRequest;
    const { documentId, content, filename, options } = body;

    if (!documentId || !content || !filename) {
      return NextResponse.json(
        { error: "Missing required fields: documentId, content, filename" },
        { status: 400 }
      );
    }

    const ragPipeline = new RAGPipeline();
    const result = await ragPipeline.processDocument(
      documentId,
      content,
      filename,
      options
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("Error processing document:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to process document" 
      },
      { status: 500 }
    );
  }
}