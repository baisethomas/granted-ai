import type { LLMProvider, GenerateParams } from "./types";
import { createOpenAIProvider } from "./providers/openai";
import { createAnthropicProvider } from "./providers/anthropic";

function createMockProvider(): LLMProvider {
  return {
    name: "mock",
    async summarize({ text }) {
      return text.length > 600 ? text.slice(0, 600) + "…" : text;
    },
    async generate(params: GenerateParams) {
      const { instructions, questions, context, tone } = params;
      return `((Mock)) ${tone ?? "Professional"} draft for: ${instructions}\nContext: ${(context ?? "").slice(0, 300)}…\nQuestions: ${(questions ?? []).join(" | ")}`;
    },
  };
}

export function getLLMProvider(name?: string): LLMProvider {
  const providerName = (name || process.env.GRANTED_DEFAULT_PROVIDER || "openai").toLowerCase();
  if (providerName === "anthropic") return createAnthropicProvider();
  if (providerName === "openai") return createOpenAIProvider();
  return createMockProvider();
}
