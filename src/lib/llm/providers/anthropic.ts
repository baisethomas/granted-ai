import Anthropic, { type MessageCreateResponse } from "@anthropic-ai/sdk";
import type { LLMProvider, GenerateParams, SummarizeParams } from "../types";
import { tokenTracker } from "../../billing/token-tracker";

export function createAnthropicProvider(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = apiKey ? new Anthropic({ apiKey }) : null;
  const defaultModel = "claude-3-5-haiku-latest";

  async function run(
    fn: () => Promise<MessageCreateResponse>, 
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
          provider: 'anthropic',
          model: trackingParams.model,
          inputTokens: res.usage.input_tokens || 0,
          outputTokens: res.usage.output_tokens || 0,
          metadata: {
            stop_reason: res.stop_reason,
            stop_sequence: res.stop_sequence,
          },
        });
      }
      
      const content = res.content?.map((c) => ("text" in c ? c.text : ""))?.join("");
      return content || fallback;
    } catch (error) {
      console.error('Anthropic API call failed:', error);
      return fallback;
    }
  }

  return {
    name: "anthropic",
    async summarize({ text, maxTokens, model, tracking }: SummarizeParams): Promise<string> {
      if (!client) {
        return text.length > 600 ? text.slice(0, 600) + "…" : text;
      }
      const prompt = `Summarize the following document for a grant-writing memory base. Use bullets and keep facts specific.\n\n---\n${text}`;
      const modelToUse = model || defaultModel;
      
      return run(
        () =>
          client.messages.create({
            model: modelToUse,
            max_tokens: maxTokens ?? 500,
            temperature: 0.2,
            messages: [{ role: "user", content: prompt }],
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
      
      return run(
        () =>
          client.messages.create({
            model: modelToUse,
            max_tokens: maxTokens ?? 1200,
            temperature: 0.3,
            messages: [
              { role: "user", content: `You are an elite grant writer. Produce polished, funder-aligned responses.\n\n${merged}` },
            ],
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
