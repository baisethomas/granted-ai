import { getLLMProvider } from "../llm";

export type GenerateGrantParams = {
  questions: string[];
  contextMemory: string;
  tone?: string;
  providerName?: string;
};

export async function generateGrantResponses(params: GenerateGrantParams): Promise<string> {
  const { questions, contextMemory, tone, providerName } = params;
  const provider = getLLMProvider(providerName);
  const instructions = "Generate complete, funder-aligned responses to each question. Use the context memory to personalize. Return a structured draft with clear section headings.";
  return provider.generate({ instructions, questions, context: contextMemory, tone, maxTokens: 1800 });
}
