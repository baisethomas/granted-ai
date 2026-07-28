import OpenAI from "openai";

const MODEL = process.env.DOCUMENT_EMBEDDING_MODEL || "text-embedding-3-small";

// Prefer OPENAI_API_KEY; VITE_OPENAI_API_KEY is a legacy server-side alias.
const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

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
