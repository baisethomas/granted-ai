import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "default_key",
});

export interface GenerateResponseOptions {
  question: string;
  context: string;
  tone: string;
  wordLimit?: number;
  emphasisAreas?: string[];
  organizationInfo?: any;
}

export class AIService {
  async generateGrantResponse(options: GenerateResponseOptions): Promise<string> {
    const { question, context, tone, wordLimit, emphasisAreas = [], organizationInfo } = options;

    const systemPrompt = `You are an expert grant writer helping create compelling responses to grant applications. 

Use the following tone: ${tone}
${wordLimit ? `Word limit: ${wordLimit} words` : ''}
${emphasisAreas.length > 0 ? `Emphasize these areas: ${emphasisAreas.join(', ')}` : ''}

Organization context:
${context}

${organizationInfo ? `Additional organization details:
Name: ${organizationInfo.organizationName || 'N/A'}
Type: ${organizationInfo.organizationType || 'N/A'}
Mission: ${organizationInfo.mission || 'N/A'}
Focus Areas: ${organizationInfo.focusAreas?.join(', ') || 'N/A'}` : ''}

Write a professional, compelling response that:
1. Directly answers the question
2. Uses specific examples from the organization's context when relevant
3. Demonstrates impact and outcomes
4. Aligns with the organization's mission and values
5. Stays within the word limit if specified
6. Uses the requested tone and emphasis areas`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        max_tokens: Math.min(4000, wordLimit ? Math.ceil(wordLimit * 1.5) : 2000),
        temperature: 0.7,
      });

      return response.choices[0].message.content || "Failed to generate response";
    } catch (error) {
      console.error("AI generation error:", error);
      throw new Error("Failed to generate AI response. Please check your API configuration.");
    }
  }

  async summarizeDocument(content: string, filename: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a document analysis expert. Create a concise summary of the uploaded document that focuses on key information relevant to grant writing, including mission statements, achievements, capabilities, and impact metrics."
          },
          {
            role: "user",
            content: `Please summarize this document: ${filename}\n\nContent:\n${content.substring(0, 8000)}`
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      return response.choices[0].message.content || "Unable to summarize document";
    } catch (error) {
      console.error("Document summarization error:", error);
      return "Document uploaded successfully but summarization failed.";
    }
  }

  async extractQuestions(content: string): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Extract all questions from the provided grant application document. Return only the questions, one per line, without numbering or additional formatting."
          },
          {
            role: "user",
            content: content.substring(0, 8000)
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const questions = response.choices[0].message.content?.split('\n')
        .filter(line => line.trim().length > 0 && line.includes('?'))
        .map(q => q.trim()) || [];

      return questions;
    } catch (error) {
      console.error("Question extraction error:", error);
      return [];
    }
  }
}

export const aiService = new AIService();
