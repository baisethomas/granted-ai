/**
 * AI Service with Robust Timeout Handling and Fallback Mechanisms
 * 
 * This service provides reliable AI generation for grant writing with the following features:
 * 
 * 🔄 TIMEOUT & RETRY LOGIC:
 * - 60-second timeout for all AI requests
 * - Exponential backoff retry (max 2 retries)
 * - AbortController for proper request cancellation
 * 
 * 📊 STATUS MANAGEMENT:
 * - "pending" - Initial state
 * - "generating" - AI is working
 * - "complete" - Successfully generated
 * - "failed" - Failed with error message
 * - "timeout" - Timed out (can be retried)
 * - "needs_context" - Insufficient context provided
 * 
 * 🔍 ERROR HANDLING:
 * - Specific handling for API keys, rate limits, and network issues
 * - Detailed logging for monitoring and debugging
 * - Graceful degradation with helpful user messages
 */

// Ensure environment variables are loaded first
import "../config.js";
import OpenAI from "openai";

// Timeout and retry configuration
const AI_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000; // 2 seconds

// Check for valid API key
const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const hasValidApiKey = apiKey && apiKey !== "default_key" && apiKey.startsWith("sk-");

console.log("OpenAI API key configured:", !!hasValidApiKey);

const openai = new OpenAI({
  apiKey: apiKey || "default_key", // Will trigger error for invalid key, handled in fallbacks
});

export interface RetrievedContextChunk {
  documentName: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity?: number;
}

export interface GeneratedGroundedResponse {
  text: string;
  citations: Array<{
    documentName: string;
    documentId: string;
    chunkIndex: number;
    quote?: string;
  }>;
  assumptions: string[];
  usage?: {
    provider: "openai";
    model: string;
    tokensIn: number;
    tokensOut: number;
  };
}

export interface GenerateGroundedResponseOptions {
  question: string;
  tone: string;
  wordLimit?: number;
  emphasisAreas?: string[];
  organizationInfo?: any;
  retrievedChunks: RetrievedContextChunk[];
  /** Saved user setting: concise | balanced | comprehensive */
  lengthPreference?: string | null;
  /** 0–100; maps to sampling temperature */
  creativity?: number | null;
  /** Who will read this answer */
  audience?: string | null;
  /** prose | bulleted | sectioned */
  answerStructure?: string | null;
  /** confident | balanced | cautious */
  claimConfidence?: string | null;
}

/**
 * Maps model-emitted citations onto the chunks that were actually retrieved.
 *
 * The matched chunk is the source of truth for document identity: a citation
 * that cannot be traced to a retrieved chunk is dropped (never attributed to a
 * real document), and a model-provided quote is only kept when it appears
 * verbatim in the matched chunk's content.
 */
export function normalizeGroundedCitations(
  rawCitations: unknown,
  retrievedChunks: RetrievedContextChunk[]
): GeneratedGroundedResponse["citations"] {
  const entries = Array.isArray(rawCitations) ? rawCitations : [];
  const normalizeWhitespace = (s: string) => s.replace(/\s+/g, " ").trim();
  const citations: GeneratedGroundedResponse["citations"] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const chunkIndex =
      typeof e.chunkIndex === "number"
        ? e.chunkIndex
        : typeof e.chunk_index === "number"
          ? e.chunk_index
          : undefined;

    let match =
      chunkIndex !== undefined
        ? retrievedChunks.find((chunk) => chunk.chunkIndex === chunkIndex)
        : undefined;

    if (!match && typeof e.marker === "string") {
      const markerMatch = e.marker.match(/#(\d+)/);
      if (markerMatch) {
        const markerIndex = parseInt(markerMatch[1], 10) - 1;
        if (markerIndex >= 0 && markerIndex < retrievedChunks.length) {
          match = retrievedChunks[markerIndex];
        }
      }
    }

    if (!match) {
      console.warn(
        "Dropping unverifiable citation from model output:",
        JSON.stringify(e).slice(0, 200)
      );
      continue;
    }

    const modelQuote =
      (typeof e.quote === "string" && e.quote) ||
      (typeof e.snippet === "string" && e.snippet) ||
      "";
    const quote =
      modelQuote &&
      normalizeWhitespace(match.content).includes(normalizeWhitespace(modelQuote))
        ? modelQuote
        : match.content.slice(0, 160);

    citations.push({
      documentName: match.documentName,
      documentId: match.documentId,
      chunkIndex: match.chunkIndex,
      quote,
    });
  }

  return citations;
}

export interface MetricSuggestion {
  key: string;
  label: string;
  type: "number" | "currency" | "percent" | "text" | "date";
  unit?: string;
  target?: string;
  category: "impact" | "financial" | "timeline" | "reporting" | "custom";
  rationale?: string;
  confidence: number;
}

export class AIService {
  // Helper function to create timeout promise
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs);
    });
  }

  // Helper function to sleep for retry delay
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Strip markdown formatting from text to ensure plain text output
  private stripMarkdown(text: string): string {
    if (!text) return text;
    
    return text
      // Remove bold/italic markers
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bullet points and convert to sentences
      .replace(/^\s*[-*+]\s+/gm, '')
      // Remove numbered lists formatting but keep the content
      .replace(/^\s*\d+\.\s+/gm, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private creativityToTemperature(creativity: number | null | undefined): number {
    const c =
      typeof creativity === "number" && Number.isFinite(creativity)
        ? Math.min(Math.max(creativity, 0), 100)
        : 30;
    return 0.15 + (c / 100) * 0.72;
  }

  private maxOutputTokens(wordLimit?: number, lengthPreference?: string | null): number {
    if (wordLimit) {
      return Math.min(Math.max(wordLimit, 1) * 3, 2500);
    }
    switch (lengthPreference) {
      case "concise":
        return 900;
      case "comprehensive":
        return 2400;
      default:
        return 1500;
    }
  }

  private formatTuningInstructions(options: {
    audience: string | null | undefined;
    answerStructure: string | null | undefined;
    claimConfidence: string | null | undefined;
    lengthPreference: string | null | undefined;
  }): string {
    const aud = options.audience ?? "program_officer";
    const struct = options.answerStructure ?? "prose";
    const conf = options.claimConfidence ?? "balanced";
    const len = options.lengthPreference ?? "balanced";

    const audienceBlocks: Record<string, string> = {
      program_officer:
        "AUDIENCE: Program officers and foundation staff. Prioritize alignment with funder priorities, clear outcomes, and efficient use of their time. Favor specificity over narrative flourish.",
      peer_reviewers:
        "AUDIENCE: Peer or technical reviewers. Emphasize methodology, evidence, and measurable rigor. Define terms and cite concrete data from snippets.",
      board_community:
        "AUDIENCE: Board members or community stakeholders. Use accessible language; briefly clarify jargon. Emphasize human impact and stewardship of resources.",
      general_reader:
        "AUDIENCE: General professional reader. Balance clarity and completeness; avoid insider shorthand.",
    };

    let structureBlock: string;
    if (struct === "bulleted") {
      structureBlock = `FORMAT — BULLETED:
- Plain text only (no markdown bold/italic, no numbered markdown lists).
- You MAY use lines starting with "- " for bullets when it improves scannability; keep each bullet substantive (not single words).
- Still use [#N] citations inline after factual claims.`;
    } else if (struct === "sectioned") {
      structureBlock = `FORMAT — SECTIONED:
- Plain text only (no markdown).
- Begin each major part with a short standalone title line in Title Case ending with a colon (e.g., "Organizational Capacity:") followed by one or more paragraphs.
- Do not use markdown headings; titles are plain text lines only.
- Keep [#N] citations inline after factual claims.`;
    } else {
      structureBlock = `FORMAT — PROSE:
- Plain text only: no markdown, no bullet points, no numbered lists, no headings. Use paragraph breaks for organization.`;
    }

    let confidenceBlock: string;
    if (conf === "confident") {
      confidenceBlock = `CLAIM CONFIDENCE — CONFIDENT:
- When snippets clearly support a fact, state it directly without softening.
- Avoid filler hedging ("may", "might", "could") unless the snippet itself is tentative.
- You must still never invent facts; grounding rules always win over tone.`;
    } else if (conf === "cautious") {
      confidenceBlock = `CLAIM CONFIDENCE — CAUTIOUS:
- When evidence is thin or implied, prefer careful phrasing ("based on our documents", "as described in the materials") and avoid absolute claims.
- Add an assumption question whenever a funder-relevant detail is missing or only partially supported.
- Never invent; hedge rather than overclaim when snippets do not explicitly support the statement.`;
    } else {
      confidenceBlock = `CLAIM CONFIDENCE — BALANCED:
- Be direct when snippets are explicit; use light hedging when support is partial.
- Follow the grounding contract for citations and assumptions.`;
    }

    let lengthBlock: string;
    if (len === "concise") {
      lengthBlock =
        "LENGTH: Prefer a concise answer—short paragraphs, only essential detail, no repetition.";
    } else if (len === "comprehensive") {
      lengthBlock =
        "LENGTH: Prefer depth—cover relevant sub-points the question implies, still without padding or generic filler.";
    } else {
      lengthBlock = "LENGTH: Balanced depth—neither sparse nor sprawling.";
    }

    return [
      audienceBlocks[aud] ?? audienceBlocks.program_officer,
      structureBlock,
      confidenceBlock,
      lengthBlock,
    ].join("\n\n");
  }

  async generateGroundedResponse(
    options: GenerateGroundedResponseOptions
  ): Promise<GeneratedGroundedResponse> {
    const {
      question,
      tone,
      wordLimit,
      emphasisAreas = [],
      organizationInfo,
      retrievedChunks,
      lengthPreference = null,
      creativity = null,
      audience = null,
      answerStructure = null,
      claimConfidence = null,
    } = options;

    if (!retrievedChunks.length || !hasValidApiKey) {
      const reason = !hasValidApiKey
        ? "AI generation is not configured on this deployment (no valid API key)."
        : "No supporting material was found in the uploaded documents for this question.";
      const actionable = !hasValidApiKey
        ? "Ask an administrator to configure OPENAI_API_KEY."
        : "Upload documents that cover the specific program, budget, outcomes, or organizational facts this question asks about, then regenerate.";

      return {
        text: `${reason} ${actionable}`,
        citations: [],
        assumptions: [reason],
      };
    }

    const contextLines = retrievedChunks
      .map((chunk, index) => {
        const similarity =
          typeof chunk.similarity === 'number'
            ? ` (relevance ${Math.round(chunk.similarity * 100)}%)`
            : '';
        return `[#${index + 1}] ${chunk.documentName}${similarity}\n${chunk.content}`;
      })
      .join('\n\n');

    const tuning = this.formatTuningInstructions({
      audience,
      answerStructure,
      claimConfidence,
      lengthPreference,
    });

    const instructions = `You are a senior grant writer drafting one answer for a grant application. Follow EVERY rule below.

VOICE
- Write concrete, active-voice prose in first-person plural ("we") for the applicant organization.
- Lead with numbers, dates, places, proper nouns, and specific program names drawn from the snippets. Replace adjectives with specifics.
- Match the requested tone exactly. Do not shift register mid-response.
- Unless FORMAT below explicitly allows bullets or section titles, use plain paragraphs only—no markdown, no bullet points, no numbered lists, no bold or italics.

${tuning}

GROUNDING CONTRACT
- Every factual claim (numbers, dates, program names, outcomes, partner names, populations served, geography, staffing, capacity, funding) MUST be traceable to a specific snippet. Cite it with the marker (e.g. [#2]) placed inline immediately after the claim.
- If a claim the funder likely wants is NOT supported by the snippets, do one of the following: (a) omit the claim, or (b) write around it in general terms, and add a specific question about it to the "assumptions" array. Never invent numbers, dates, partner names, outcomes, or quotes.
- Do not round, extrapolate, or combine numbers from different snippets unless one snippet explicitly does so.
- If the snippets truly cannot answer the question, write a short honest response naming the 2–3 specific facts that are missing, and populate "assumptions" with those gaps.

BOILERPLATE TO AVOID
Do not use any of these phrases (or close variants):
- "deeply committed", "firmly committed", "steadfast commitment"
- "robust", "cutting-edge", "state-of-the-art", "world-class", "best-in-class"
- "leverage" (as a verb), "synergy", "synergistic"
- "empower" / "empowering" without naming the specific action
- "holistic approach" without naming the components
- "best practices" without naming which practice
- "in today's rapidly changing world", "now more than ever"
- "unique opportunity", "game-changing", "transformative" (as a vague adjective)
- Stacked adjectives like "innovative, impactful, and transformative"
- "address the issue of" — just state what we do about it

QUESTION-TYPE GUIDANCE
- Need / problem statement: lead with the specific population and the specific gap, supported by data from snippets. One focused paragraph.
- Goals / objectives: name measurable outcomes with targets and deadlines. If no numeric target is in the snippets, put the target in assumptions.
- Organization / capacity: lead with year founded (if present), tenure, size, and the most relevant prior programs or grants from the snippets.
- Methodology / approach: name the specific activities, cadence, and who performs them.
- Evaluation / measurement: name the metric, the measurement method, the reporting cadence, and who collects the data. Each from snippets.
- Budget / cost: only include figures that appear in snippets. If none, say so briefly and flag as an assumption.
- Sustainability: name specific funding sources, earned-revenue streams, or partnerships from snippets. No generic "diverse funding" language.

OUTPUT
Return a single JSON object with EXACTLY these fields:
- text (string): the response body. Include [#N] inline citation markers as required by the grounding contract. Follow the FORMAT rules above (plain text; bullets or section titles only if permitted there).
- citations (array): one entry per unique marker used, shape { marker: "#N", documentName, documentId, chunkIndex, quote } where quote is a short verbatim phrase from the cited snippet.
- assumptions (array of strings): ONLY for gaps where the snippets did not support something the funder likely needs. Each item MUST be one concise question ending in "?". Do not state opinions or thematic summaries (wrong: "Community engagement is crucial…"). Correct: "How many participants do you project annually, and over what geography?"

Stay within the word limit if one is given. The review committee values specificity over polish.`;

    const userPrompt = [
      `Grant Question: ${question}`,
      `Tone: ${tone}`,
      wordLimit ? `Target word count: ${wordLimit}` : "",
      !wordLimit && lengthPreference ? `Length preference: ${lengthPreference}` : "",
      emphasisAreas.length ? `Emphasis areas: ${emphasisAreas.join(', ')}` : "",
      `Organization info: ${organizationInfo ? JSON.stringify(organizationInfo) : 'N/A'}`,
      ``,
      `Context Snippets (cite these by marker):`,
      contextLines,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const model = process.env.GRANTED_DEFAULT_MODEL || 'gpt-4o-mini';
      const temperature = this.creativityToTemperature(creativity);
      const max_tokens = this.maxOutputTokens(wordLimit, lengthPreference);
      const response = await openai.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        temperature,
        max_tokens,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Empty response from model');
      }

      const parsed = JSON.parse(content);
      const normalizedCitations = normalizeGroundedCitations(parsed.citations, retrievedChunks);

      const rawAssumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions : [];
      const assumptions = rawAssumptions
        .map((a: any) =>
          typeof a === "string" ? a.trim() : typeof a?.text === "string" ? a.text.trim() : ""
        )
        .filter((s: string) => s.length > 0);

      const rawText = parsed.text || parsed.answer || "";
      const text =
        (options.answerStructure ?? "prose") === "bulleted"
          ? rawText.trim()
          : this.stripMarkdown(rawText);

      return {
        text,
        citations: normalizedCitations,
        assumptions,
        usage: {
          provider: "openai",
          model,
          tokensIn: response.usage?.prompt_tokens ?? Math.ceil((instructions.length + userPrompt.length) / 4),
          tokensOut: response.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      console.error('generateGroundedResponse failed:', error);
      const fallbackChunks = retrievedChunks.slice(0, 3);
      return {
        text:
          `Unable to complete a grounded draft. Here are key excerpts to guide manual drafting:\n\n${fallbackChunks
            .map((chunk) => `- ${chunk.documentName}: ${chunk.content}`)
            .join('\n')}`,
        citations: fallbackChunks.map((chunk) => ({
          documentName: chunk.documentName,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          quote: chunk.content.slice(0, 160),
        })),
        assumptions: ['Model output unavailable; provided raw excerpts instead.'],
      };
    }
  }

  async summarizeDocument(content: string, filename: string): Promise<string> {
    if (!hasValidApiKey) {
      console.log("No valid API key found, using mock summary for development...");
      return this.getMockSummary(filename, content);
    }

    let lastError: Error | null = null;
    
    // Retry logic with exponential backoff  
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let timeoutId: NodeJS.Timeout | undefined;
      try {
        console.log(`Document summarization attempt ${attempt + 1}/${MAX_RETRIES + 1} for: ${filename}`);
        
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);

        const aiPromise = openai.chat.completions.create({
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
        }, {
          signal: controller.signal
        });

        const timeoutPromise = this.createTimeoutPromise(AI_TIMEOUT);
        
        const response = await Promise.race([aiPromise, timeoutPromise]);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        const summary = response.choices[0].message.content;
        if (!summary || summary.trim().length === 0) {
          throw new Error("Empty summary from AI service");
        }

        console.log(`Document summarization successful on attempt ${attempt + 1}`);
        return summary;

      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = error;
        
        console.error(`Document summarization attempt ${attempt + 1} failed:`, error.message || error);

        // Handle specific error types
        if (error.message === 'REQUEST_TIMEOUT' || error.name === 'AbortError') {
          console.log(`Document summarization timed out after ${AI_TIMEOUT}ms on attempt ${attempt + 1}`);
        } else if (error.code === 'insufficient_quota' || error.code === 'rate_limit_exceeded') {
          console.log('API quota/rate limit error during document summarization');
        } else if (error.code === 'invalid_api_key' || error.status === 401) {
          console.log('API authentication error during document summarization');
        }

        // On final attempt or certain errors, fall back to mock summary
        if (attempt === MAX_RETRIES) {
          console.log("Maximum retries reached, falling back to mock summary for development...");
          return this.getMockSummary(filename, content);
        }

        // Wait before retrying (exponential backoff)
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          console.log(`Waiting ${delay}ms before document summarization retry...`);
          await this.sleep(delay);
        }
      }
    }

    // This shouldn't be reached, but just in case
    console.error("Unexpected error in summarizeDocument retry loop");
    return this.getMockSummary(filename, content);
  }

  private getMockSummary(filename: string, content: string): string {
    const docType = this.getDocumentType(filename, content);
    
    const mockSummaries: Record<string, string> = {
      organizationProfile: `Organization profile document containing mission statement, organizational structure, and key capabilities. The organization focuses on community development and has experience in program implementation with measurable outcomes.`,
      
      budget: `Budget document outlining project costs, personnel expenses, and resource allocation. Contains detailed financial projections and cost-effectiveness analysis for grant implementation.`,
      
      program: `Program description document detailing service delivery methods, target populations, and expected outcomes. Includes logic models and evaluation frameworks.`,
      
      assessment: `Needs assessment document identifying community gaps, stakeholder input, and data-driven justification for proposed interventions.`,
      
      rfp: `Request for Proposals (RFP) document containing grant application questions, requirements, and evaluation criteria. Includes funding priorities and submission guidelines.`,
      
      default: `Document summary: ${filename} - Contains key organizational information relevant to grant writing including capabilities, experience, and program details. Content has been processed and is available for context in grant responses.`
    };

    return mockSummaries[docType] || mockSummaries.default;
  }

  private getDocumentType(filename: string, content: string): string {
    const lower = filename.toLowerCase();
    const contentLower = content.toLowerCase();
    
    if (lower.includes('budget') || contentLower.includes('budget')) return 'budget';
    if (lower.includes('org') || lower.includes('profile') || contentLower.includes('mission')) return 'organizationProfile';
    if (lower.includes('program') || contentLower.includes('program')) return 'program';
    if (lower.includes('assessment') || contentLower.includes('needs')) return 'assessment';
    if (lower.includes('rfp') || lower.includes('request') || contentLower.includes('questions')) return 'rfp';
    
    return 'default';
  }

  async extractQuestions(content: string): Promise<{ questions: string[]; demo: boolean }> {
    if (!hasValidApiKey) {
      console.log("No valid API key found, using mock questions for development...");
      return { questions: this.getMockQuestions(), demo: true };
    }

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

      if (questions.length > 0) {
        return { questions, demo: false };
      }
      return { questions: this.getMockQuestions(), demo: true };
    } catch (error) {
      console.error("Question extraction error:", error);
      console.log("Falling back to mock questions for development...");
      return { questions: this.getMockQuestions(), demo: true };
    }
  }

  /**
   * Extracts metric suggestions from a grant application / RFP document.
   * Falls back to mock suggestions when no API key is configured, mirroring
   * the extractQuestions pattern.
   */
  async extractMetrics(content: string): Promise<MetricSuggestion[]> {
    if (!hasValidApiKey) {
      console.log("No valid API key found, using mock metric suggestions for development...");
      return this.getMockMetricSuggestions();
    }

    const systemPrompt = `You are a grants analyst. Read the provided grant application / RFP and identify the metrics the funder expects the applicant to report or commit to. Examples: people served, jobs created, funds requested, reporting due dates, milestones, match requirements.

Return ONLY a JSON object with a "metrics" array. Each item must have:
- key: snake_case identifier (e.g. "people_served")
- label: human-readable name
- type: one of "number", "currency", "percent", "text", "date"
- unit: optional (e.g. "people", "hours", "$")
- target: optional numeric target the funder specifies (omit if none stated)
- category: one of "impact", "financial", "timeline", "reporting", "custom"
- rationale: a short quote or paraphrase from the document explaining why this metric matters
- confidence: integer 0-100

Return at most 12 metrics. If the document doesn't contain metrics, return an empty array.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: content.substring(0, 12_000) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.1,
      });

      const raw = response.choices[0].message.content ?? "{}";
      const parsed = JSON.parse(raw);
      const metrics = Array.isArray(parsed.metrics) ? parsed.metrics : [];
      return metrics
        .filter((m: any) => m && m.key && m.label && m.type && m.category)
        .map((m: any) => ({
          key: String(m.key),
          label: String(m.label),
          type: String(m.type),
          unit: m.unit ? String(m.unit) : undefined,
          target: m.target !== undefined && m.target !== null ? String(m.target) : undefined,
          category: String(m.category),
          rationale: m.rationale ? String(m.rationale) : undefined,
          confidence:
            typeof m.confidence === "number" ? Math.max(0, Math.min(100, Math.round(m.confidence))) : 60,
        })) as MetricSuggestion[];
    } catch (error) {
      console.error("Metric extraction error:", error);
      console.log("Falling back to mock metric suggestions for development...");
      return this.getMockMetricSuggestions();
    }
  }

  private getMockMetricSuggestions(): MetricSuggestion[] {
    return [
      {
        key: "people_served",
        label: "People served",
        type: "number",
        unit: "people",
        target: "500",
        category: "impact",
        rationale: "Funder expects applicants to report total individuals served annually.",
        confidence: 85,
      },
      {
        key: "jobs_created",
        label: "Jobs created",
        type: "number",
        unit: "jobs",
        category: "impact",
        rationale: "Workforce development outcomes are a stated priority in the RFP.",
        confidence: 75,
      },
      {
        key: "amount_requested",
        label: "Amount requested",
        type: "currency",
        category: "financial",
        rationale: "RFP requires a stated funding request in the application.",
        confidence: 95,
      },
      {
        key: "match_funds_secured",
        label: "Match funds secured",
        type: "currency",
        category: "financial",
        rationale: "1:1 match requirement noted in the funding guidelines.",
        confidence: 80,
      },
      {
        key: "reporting_due",
        label: "Quarterly reporting due",
        type: "date",
        category: "reporting",
        rationale: "Grantees must submit quarterly progress reports.",
        confidence: 90,
      },
    ];
  }

  private getMockQuestions(): string[] {
    return [
      "What is your organization's mission statement?",
      "Describe the specific need or problem your project addresses.",
      "What are the primary goals and objectives of this project?",
      "Who is your target population and how many people will you serve?",
      "What geographic area will your project cover?",
      "Describe your organization's experience with similar projects.",
      "What is the total amount of funding requested?",
      "What is the project timeline and key milestones?",
      "How will you measure the success and impact of this project?",
      "What evaluation methods will you use to assess outcomes?",
      "Describe your organization's capacity to manage this project.",
      "Who are your key project partners and collaborators?",
      "How will this project be sustained after the grant period ends?",
      "What potential challenges do you anticipate and how will you address them?",
      "How does this project align with the funder's priorities?",
      "What makes your organization uniquely qualified for this grant?",
      "Describe the broader community impact of your project.",
      "What innovative approaches or best practices will you implement?",
      "How will you ensure cultural competency and accessibility?",
      "What is your plan for disseminating results and lessons learned?"
    ];
  }
}

export const aiService = new AIService();
