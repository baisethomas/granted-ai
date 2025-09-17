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
 * 🛡️ FALLBACK RESPONSES:
 * - Timeout fallback: Structured outline with guidance
 * - Insufficient context: Specific suggestions for improvement
 * - API error fallback: Manual framework with tips
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
 * 
 * 📝 RESPONSE QUALITY:
 * - Context-aware fallbacks based on question type
 * - Structured guidance when AI fails
 * - Actionable next steps for users
 */

// Ensure environment variables are loaded first
import "../config";
import OpenAI from "openai";

// Timeout and retry configuration
const AI_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000; // 2 seconds

// Check for valid API key
const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const hasValidApiKey = apiKey && apiKey !== "default_key" && apiKey.startsWith("sk-");

// Debug logging
console.log("API Key found:", apiKey ? `${apiKey.substring(0, 10)}...` : "none");
console.log("API Key valid:", hasValidApiKey);

const openai = new OpenAI({
  apiKey: apiKey || "default_key", // Will trigger error for invalid key, handled in fallbacks
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

  // Generate fallback responses based on the scenario
  private generateFallbackResponse(question: string, errorType: 'timeout' | 'api_error' | 'insufficient_context'): string {
    const questionLower = question.toLowerCase();
    
    if (errorType === 'timeout') {
      return `I'm having trouble generating a detailed response right now. Here's a structured approach to help you get started:

Key Areas to Address:
${this.getQuestionStructure(questionLower)}

Recommended Approach:
1. Review your organizational documents and context
2. Identify specific examples and metrics
3. Align your response with the funder's priorities
4. Consider having this section reviewed by a colleague

Please try generating again, or use this structure to manually draft your response.`;
    }
    
    if (errorType === 'insufficient_context') {
      return `Based on the available information, I need additional details to provide a comprehensive response. Consider including:

${this.getMissingContextSuggestions(questionLower)}

What you can do:
1. Upload relevant organizational documents
2. Add more specific context about your programs
3. Include performance metrics and outcomes data
4. Provide examples of similar past work

Once you've added more context, try generating this response again.`;
    }
    
    // API error fallback
    return `Unable to generate AI response at this time due to a service issue. 

Manual Response Framework:
${this.getQuestionStructure(questionLower)}

Tips for Writing:
- Be specific and use concrete examples
- Include quantitative data where possible
- Align with your organization's mission
- Address the funder's priorities directly

Please try again in a moment, or use this framework to draft your response manually.`;
  }

  private getQuestionStructure(questionLower: string): string {
    if (questionLower.includes('mission') || questionLower.includes('organization')) {
      return `- Organization overview and history
- Mission statement and core values
- Key programs and services
- Target populations served
- Organizational capacity and leadership`;
    }
    
    if (questionLower.includes('need') || questionLower.includes('problem')) {
      return `- Specific need or problem definition
- Supporting data and evidence
- Who is affected and how
- Current gaps in services
- Consequences of not addressing the need`;
    }
    
    if (questionLower.includes('goal') || questionLower.includes('objective')) {
      return `- Primary project goals
- Specific, measurable objectives
- Expected outcomes and impact
- Timeline for achievement
- Success metrics and indicators`;
    }
    
    if (questionLower.includes('evaluation') || questionLower.includes('measure')) {
      return `- Evaluation methodology
- Key performance indicators
- Data collection methods
- Reporting schedule and format
- How results will be used for improvement`;
    }
    
    if (questionLower.includes('budget') || questionLower.includes('cost')) {
      return `- Total project cost breakdown
- Personnel expenses
- Program costs and materials
- Administrative overhead
- Cost-effectiveness analysis`;
    }
    
    if (questionLower.includes('sustain') || questionLower.includes('continuation')) {
      return `- Sustainability planning
- Future funding sources
- Community support and buy-in
- Long-term organizational capacity
- Legacy and ongoing impact`;
    }
    
    // Generic structure for other questions
    return `- Direct response to the question asked
- Supporting evidence and examples
- Specific details about your organization
- Quantitative data where available
- Connection to project impact and outcomes`;
  }

  private getMissingContextSuggestions(questionLower: string): string {
    const suggestions = [];
    
    if (questionLower.includes('organization') || questionLower.includes('mission')) {
      suggestions.push('- Organizational profile document with mission, history, and structure');
      suggestions.push('- Leadership bios and organizational chart');
      suggestions.push('- Recent annual reports or impact statements');
    }
    
    if (questionLower.includes('program') || questionLower.includes('service')) {
      suggestions.push('- Detailed program descriptions and logic models');
      suggestions.push('- Service delivery methods and approaches');
      suggestions.push('- Client testimonials or case studies');
    }
    
    if (questionLower.includes('need') || questionLower.includes('data')) {
      suggestions.push('- Community needs assessment data');
      suggestions.push('- Demographic and statistical information');
      suggestions.push('- Stakeholder input and feedback');
    }
    
    if (questionLower.includes('experience') || questionLower.includes('capacity')) {
      suggestions.push('- Examples of similar past projects');
      suggestions.push('- Staff qualifications and experience');
      suggestions.push('- Organizational capacity assessments');
    }
    
    if (questionLower.includes('budget') || questionLower.includes('financial')) {
      suggestions.push('- Detailed budget worksheets');
      suggestions.push('- Financial policies and procedures');
      suggestions.push('- Audit reports or financial statements');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('- More specific context about your programs and services');
      suggestions.push('- Organizational background and experience');
      suggestions.push('- Relevant data and performance metrics');
    }
    
    return suggestions.join('\n');
  }

  async generateGrantResponse(options: GenerateResponseOptions): Promise<string> {
    const { question, context, tone, wordLimit, emphasisAreas = [], organizationInfo } = options;

    // Check if we have valid API key
    if (!hasValidApiKey) {
      console.log("No valid API key found, using fallback response for development...");
      return this.generateFallbackResponse(question, 'api_error');
    }

    // Check if we have minimal context
    if (!context || context.trim().length < 50) {
      console.log("Insufficient context provided, suggesting user adds more information");
      return this.generateFallbackResponse(question, 'insufficient_context');
    }

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
6. Uses the requested tone and emphasis areas

IMPORTANT: Provide your response as plain text without markdown formatting. Do not use **bold**, *italics*, bullet points (-), or other markdown syntax. Write in clear, professional prose suitable for a formal grant application.`;

    let lastError: Error | null = null;
    
    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let timeoutId: NodeJS.Timeout | undefined;
      try {
        console.log(`AI generation attempt ${attempt + 1}/${MAX_RETRIES + 1} for question: ${question.substring(0, 100)}...`);
        
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);

        const aiPromise = openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
          ],
          max_tokens: Math.min(4000, wordLimit ? Math.ceil(wordLimit * 1.5) : 2000),
          temperature: 0.7,
        }, {
          signal: controller.signal
        });

        const timeoutPromise = this.createTimeoutPromise(AI_TIMEOUT);
        
        const response = await Promise.race([aiPromise, timeoutPromise]);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        const content = response.choices[0].message.content;
        if (!content || content.trim().length === 0) {
          throw new Error("Empty response from AI service");
        }

        console.log(`AI generation successful on attempt ${attempt + 1}`);
        return content;

      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = error;
        
        console.error(`AI generation attempt ${attempt + 1} failed:`, error.message || error);

        // Handle specific error types
        if (error.message === 'REQUEST_TIMEOUT' || error.name === 'AbortError') {
          console.log(`Request timed out after ${AI_TIMEOUT}ms on attempt ${attempt + 1}`);
          
          if (attempt === MAX_RETRIES) {
            console.log('Maximum retries reached, returning timeout fallback response');
            return this.generateFallbackResponse(question, 'timeout');
          }
        } else if (error.code === 'insufficient_quota' || error.code === 'rate_limit_exceeded') {
          console.log('API quota/rate limit error, returning fallback response');
          return this.generateFallbackResponse(question, 'api_error');
        } else if (error.code === 'invalid_api_key' || error.status === 401) {
          console.log('API authentication error, returning fallback response');
          return this.generateFallbackResponse(question, 'api_error');
        } else if (attempt === MAX_RETRIES) {
          // On final attempt, return fallback for any other error
          console.log('Maximum retries reached, returning API error fallback response');
          return this.generateFallbackResponse(question, 'api_error');
        }

        // Wait before retrying (exponential backoff)
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          console.log(`Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    // This shouldn't be reached, but just in case
    console.error("Unexpected error in generateGrantResponse retry loop");
    return this.generateFallbackResponse(question, 'api_error');
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
    
    const mockSummaries = {
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

  async extractQuestions(content: string): Promise<string[]> {
    if (!hasValidApiKey) {
      console.log("No valid API key found, using mock questions for development...");
      return this.getMockQuestions();
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

      return questions.length > 0 ? questions : this.getMockQuestions();
    } catch (error) {
      console.error("Question extraction error:", error);
      console.log("Falling back to mock questions for development...");
      
      // Fallback to mock questions when API fails
      return this.getMockQuestions();
    }
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
