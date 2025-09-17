import { NextRequest, NextResponse } from "next/server";
import { generateGrantResponses } from "@/lib/agent/generator";
import { buildOptimizedContext } from "@/lib/agent/context";
import { generateGrantResponsesWithCitations } from "@/lib/citations/citation-enhanced-generator";

type GenerateBody = {
  questions: string[];
  contextMemory?: string; // Legacy support
  organizationId?: string; // For RAG-powered context
  tone?: string;
  useRAG?: boolean; // Flag to enable RAG-powered generation
  useCitations?: boolean; // Flag to enable citation-enhanced generation
  draftId?: string; // For saving citation data
  questionTypes?: Array<'mission' | 'needs' | 'goals' | 'methods' | 'evaluation' | 'budget' | 'experience' | 'sustainability'>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GenerateBody>;
    const questions: string[] = Array.isArray(body?.questions) ? body!.questions! : [];
    const tone: string | undefined = body?.tone;
    const useRAG: boolean = body?.useRAG || false;
    const useCitations: boolean = body?.useCitations || false;
    const organizationId: string | undefined = body?.organizationId;
    const draftId: string | undefined = body?.draftId;
    const questionTypes = body?.questionTypes || [];
    
    let contextMemory = String(body?.contextMemory || "");

    // If citation-enhanced generation is requested
    if (useCitations && organizationId && questions.length > 0) {
      try {
        console.log("Using citation-enhanced generation...");
        
        const citationResponse = await generateGrantResponsesWithCitations({
          questions,
          organizationId,
          tone,
          questionTypes,
          draftId
        });

        return NextResponse.json({
          draft: citationResponse.draft,
          citationStats: citationResponse.citationStats,
          paragraphCitations: citationResponse.paragraphCitations,
          validationIssues: citationResponse.validationIssues,
          sourceUsage: citationResponse.sourceUsage,
          citationEnabled: true,
          ragEnabled: true
        });

      } catch (citationError: any) {
        console.error("Error in citation-enhanced generation:", citationError);
        
        // Fall back to RAG-only generation if citation enhancement fails
        console.log("Falling back to RAG-only generation...");
      }
    }

    // Standard RAG-powered generation (fallback or when citations not requested)
    if (useRAG && organizationId && questions.length > 0) {
      try {
        console.log("Using RAG-powered context generation...");
        
        // Build context for each question using RAG
        const ragContexts: string[] = [];
        
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          const questionType = questionTypes[i];
          
          const contextResult = await buildOptimizedContext(
            question, 
            organizationId, 
            questionType
          );
          
          ragContexts.push(contextResult.context);
          
          // Add a small delay to avoid overwhelming the system
          if (i < questions.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Combine all contexts
        contextMemory = ragContexts.join('\n\n---\n\n');
        
        console.log(`RAG context generated: ${contextMemory.length} characters`);
      } catch (ragError: any) {
        console.error("Error generating RAG context:", ragError);
        
        // Fall back to provided context memory if RAG fails
        if (!contextMemory) {
          contextMemory = "Note: Unable to retrieve specific context from documents. Please ensure your organizational documents have been uploaded and processed.";
        }
      }
    }

    // Generate responses using the context (either RAG-generated or provided)
    const draft = await generateGrantResponses({ 
      questions, 
      contextMemory, 
      tone 
    });

    return NextResponse.json({ 
      draft,
      contextUsed: useRAG && organizationId ? contextMemory.length : undefined,
      ragEnabled: useRAG,
      citationEnabled: false
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Generation error:", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
