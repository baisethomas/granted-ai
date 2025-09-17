import { NextRequest, NextResponse } from "next/server";
import { VectorRetrievalService } from "@/lib/rag/retrieval";

interface SearchRequest {
  query: string;
  organizationId: string;
  options?: {
    limit?: number;
    similarityThreshold?: number;
    documentIds?: string[];
    categories?: string[];
    sectionTitles?: string[];
    diversityFactor?: number;
    maxTokens?: number;
    keywords?: string[];
    keywordWeight?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SearchRequest;
    const { query, organizationId, options } = body;

    if (!query || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: query, organizationId" },
        { status: 400 }
      );
    }

    const retrievalService = new VectorRetrievalService();
    
    const searchOptions = {
      organizationId,
      ...options,
    };

    let result;
    if (options?.keywords && options.keywords.length > 0) {
      // Use hybrid search when keywords are provided
      result = await retrievalService.hybridSearch(query, {
        ...searchOptions,
        keywords: options.keywords,
        keywordWeight: options.keywordWeight || 0.3,
      });
    } else {
      // Use semantic search
      result = await retrievalService.semanticSearch(query, searchOptions);
    }

    return NextResponse.json({
      success: true,
      chunks: result.chunks,
      totalTokens: result.totalTokens,
      retrievalTimeMs: result.retrievalTimeMs,
      totalResults: result.chunks.length,
    });
  } catch (error: any) {
    console.error("Error performing search:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Search failed",
        chunks: [],
        totalTokens: 0,
        retrievalTimeMs: 0,
        totalResults: 0,
      },
      { status: 500 }
    );
  }
}