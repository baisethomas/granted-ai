import OpenAI from "openai";
import type { LLMProvider, GenerateParams } from "../types";
import { tokenTracker } from "../../billing/token-tracker";

export function createOpenAIProvider(): LLMProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const client = apiKey ? new OpenAI({ apiKey }) : null;
  const defaultModel = "gpt-4o-mini";

  async function safeCall(
    fn: () => Promise<OpenAI.Chat.Completions.ChatCompletion>, 
    fallback: string,
    trackingParams?: {
      organizationId: string;
      userId: string;
      projectId?: string;
      type: 'generation' | 'summarization' | 'embedding' | 'rag_retrieval' | 'clarification' | 'export';
      model: string;
    }
  ): Promise<string> {
    try {
      const res = await fn();
      
      // Track token usage if tracking params provided
      if (trackingParams && res.usage) {
        await tokenTracker.trackUsage({
          organizationId: trackingParams.organizationId,
          userId: trackingParams.userId,
          projectId: trackingParams.projectId,
          type: trackingParams.type,
          provider: 'openai',
          model: trackingParams.model,
          inputTokens: res.usage.prompt_tokens || 0,
          outputTokens: res.usage.completion_tokens || 0,
          metadata: {
            total_tokens: res.usage.total_tokens,
            finish_reason: res.choices[0]?.finish_reason,
          },
        });
      }
      
      const content = res.choices[0]?.message?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((c) => (typeof c === "string" ? c : (c as { text?: string }).text ?? "")).join("");
      }
      return fallback;
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      return fallback;
    }
  }

  return {
    name: "openai",
    async summarize({ text, maxTokens, model, tracking }): Promise<string> {
      if (!client) {
        return text.length > 600 ? text.slice(0, 600) + "…" : text;
      }
      const prompt = `Summarize the following document for building a private knowledge base. Use bullet points and preserve key facts, metrics, and names.\n\n---\n${text}`;
      const modelToUse = model || defaultModel;
      
      return safeCall(
        () =>
          client.chat.completions.create({
            model: modelToUse as OpenAI.Chat.ChatModel,
            messages: [
              { role: "system", content: "You are a concise expert summarizer." },
              { role: "user", content: prompt },
            ],
            max_tokens: maxTokens ?? 500,
            temperature: 0.2,
          }),
        "(Summary unavailable — API key not set)",
        tracking ? {
          organizationId: tracking.organizationId,
          userId: tracking.userId,
          projectId: tracking.projectId,
          type: 'summarization',
          model: modelToUse,
        } : undefined
      );
    },
    async generate(params: GenerateParams): Promise<string> {
      const { instructions, questions, context, tone, maxTokens, model, tracking } = params;
      const merged = `Context (memory):\n${context ?? "(none)"}\n\nTone: ${tone ?? "Professional"}\n\nTask: ${instructions}\n\nQuestions:\n${(questions ?? []).map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
      const modelToUse = model || defaultModel;
      
      if (!client) {
        return `((Mocked)) Generated draft based on: ${merged.slice(0, 400)}…`;
      }
      
      return safeCall(
        () =>
          client.chat.completions.create({
            model: modelToUse as OpenAI.Chat.ChatModel,
            messages: [
              { role: "system", content: "You are an elite grant writer and fundraiser." },
              { role: "user", content: merged },
            ],
            max_tokens: maxTokens ?? 1200,
            temperature: 0.3,
          }),
        "(Generation unavailable — API key not set)",
        tracking ? {
          organizationId: tracking.organizationId,
          userId: tracking.userId,
          projectId: tracking.projectId,
          type: 'generation',
          model: modelToUse,
        } : undefined
      );
    },
  };
}
