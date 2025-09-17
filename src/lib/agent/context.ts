import { getLLMProvider } from "../llm";
import { RAGPipeline, ContextGenerationResult } from "../rag/pipeline";
import { HybridSearchOptions } from "../rag/retrieval";

export type IngestedDoc = { name: string; text: string };
export type MemorySummary = {
  combined: string;
  perDocument: { name: string; summary: string }[];
};

// Legacy chunking function for backward compatibility
function chunk(text: string, max = 4000): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += max) {
    parts.push(text.slice(i, i + max));
  }
  return parts;
}

/**
 * Legacy function for building context memory (kept for backward compatibility)
 */
export async function buildContextMemory(docs: IngestedDoc[], providerName?: string): Promise<MemorySummary> {
  const provider = getLLMProvider(providerName);

  const perDocument = await Promise.all(
    docs.map(async (d) => {
      const parts = chunk(d.text, 6000);
      const summaries: string[] = [];
      for (const p of parts) {
        const s = await provider.summarize({ text: p, maxTokens: 300 });
        summaries.push(s);
      }
      const merged = summaries.join("\n");
      return { name: d.name, summary: merged };
    })
  );

  const combined = perDocument
    .map((s, i) => `Document ${i + 1} — ${s.name}:\n${s.summary}`)
    .join("\n\n");

  return { combined, perDocument };
}

/**
 * Enhanced context building using RAG pipeline for semantic retrieval
 */
export async function buildRAGContext(
  question: string,
  organizationId: string,
  options: HybridSearchOptions = {}
): Promise<ContextGenerationResult> {
  const ragPipeline = new RAGPipeline();
  return await ragPipeline.generateContext(question, organizationId, options);
}

/**
 * Build context optimized for specific grant question types
 */
export async function buildOptimizedContext(
  question: string,
  organizationId: string,
  questionType?: 'mission' | 'needs' | 'goals' | 'methods' | 'evaluation' | 'budget' | 'experience' | 'sustainability'
): Promise<ContextGenerationResult> {
  const ragPipeline = new RAGPipeline();
  
  // Optimize search parameters based on question type
  const optimizedOptions: HybridSearchOptions = {
    limit: 6,
    similarityThreshold: 0.65,
    diversityFactor: 0.4,
    maxTokens: 3500,
    keywordWeight: 0.25,
  };

  // Adjust parameters based on question type
  switch (questionType) {
    case 'mission':
      optimizedOptions.boostFactors = {
        documentType: {
          'organization-profile': 1.5,
          'program': 1.2,
        },
        sectionRelevance: 1.3,
      };
      break;
    
    case 'needs':
      optimizedOptions.boostFactors = {
        documentType: {
          'assessment': 1.4,
          'program': 1.2,
        },
      };
      optimizedOptions.keywords = ['problem', 'need', 'challenge', 'gap', 'data', 'statistics'];
      break;
    
    case 'goals':
      optimizedOptions.keywords = ['goal', 'objective', 'outcome', 'impact', 'result', 'target'];
      optimizedOptions.boostFactors = {
        documentType: {
          'program': 1.3,
          'assessment': 1.1,
        },
      };
      break;
    
    case 'evaluation':
      optimizedOptions.keywords = ['evaluation', 'measure', 'metric', 'assess', 'track', 'monitor', 'data'];
      optimizedOptions.boostFactors = {
        documentType: {
          'evaluation': 1.4,
          'program': 1.2,
        },
      };
      break;
    
    case 'budget':
      optimizedOptions.keywords = ['budget', 'cost', 'expense', 'funding', 'financial', 'price'];
      optimizedOptions.boostFactors = {
        documentType: {
          'budget': 1.5,
        },
      };
      optimizedOptions.limit = 4; // Budget questions typically need fewer, more focused chunks
      break;
    
    case 'experience':
      optimizedOptions.keywords = ['experience', 'history', 'past', 'previous', 'track record', 'success'];
      optimizedOptions.boostFactors = {
        documentType: {
          'organization-profile': 1.3,
        },
      };
      break;
    
    case 'sustainability':
      optimizedOptions.keywords = ['sustain', 'continue', 'future', 'long-term', 'maintenance', 'funding'];
      break;
  }

  return await ragPipeline.generateContext(question, organizationId, optimizedOptions);
}
