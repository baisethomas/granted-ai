import OpenAI from "openai";

const MODEL = process.env.DOCUMENT_EMBEDDING_MODEL || "text-embedding-3-small";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function generateEmbedding(
  input: string
): Promise<{ embedding: number[] | null; model: string }> {
  if (!openai) {
    console.warn("[embedding] OPENAI_API_KEY not set. Skipping embedding generation.");
    return { embedding: null, model: MODEL };
  }

  try {
    const response = await openai.embeddings.create({
      model: MODEL,
      input,
    });
    const embedding = response.data[0]?.embedding ?? null;
    return { embedding, model: MODEL };
  } catch (error) {
    console.error("[embedding] Failed to generate embedding:", error);
    throw error;
  }
}
