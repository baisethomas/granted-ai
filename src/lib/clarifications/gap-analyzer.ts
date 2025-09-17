import { getLLMProvider } from "@/lib/llm";
import { clarificationDb } from "./database";
import type { InformationGap, AnalysisContext } from "./types";

/**
 * Analyzes grant questions and available context to identify critical information gaps
 */
export class InformationGapAnalyzer {
  private llmProvider = getLLMProvider();

  async analyzeGaps(context: AnalysisContext): Promise<InformationGap[]> {
    const { grantQuestions, availableDocuments, existingContext, organizationId } = context;

    // Enhance context with database documents
    const enhancedContext = await clarificationDb.buildEnhancedAnalysisContext(
      grantQuestions,
      organizationId,
      existingContext,
      context.tone
    );

    // Build analysis prompt with enhanced context
    const analysisPrompt = this.buildAnalysisPrompt(
      grantQuestions, 
      enhancedContext.availableDocuments, 
      enhancedContext.existingContext
    );

    try {
      const analysisResult = await this.llmProvider.generate({
        instructions: analysisPrompt,
        questions: grantQuestions,
        context: existingContext,
        maxTokens: 2000
      });

      return this.parseAnalysisResult(analysisResult);
    } catch (error) {
      console.error('Error analyzing information gaps:', error);
      return this.getFallbackGaps(grantQuestions);
    }
  }

  private buildAnalysisPrompt(
    questions: string[], 
    documents: string[], 
    context: string
  ): string {
    return `You are a senior grants consultant with 15+ years experience reviewing $500M+ in successful applications across federal, foundation, and corporate funders. 

GRANT QUESTIONS TO ANALYZE:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

AVAILABLE ORGANIZATIONAL CONTEXT:
${context || 'No organizational context provided'}

AVAILABLE DOCUMENTS: ${documents.length > 0 ? documents.join(', ') : 'None'}

TASK: Apply professional grant review criteria to identify gaps that reviewers consistently flag. Based on my experience reviewing applications for NIH, NSF, Gates Foundation, Ford Foundation, and corporate funders, analyze for these CRITICAL SUCCESS FACTORS:

1. **BUDGET REALISM & JUSTIFICATION**
   - Missing: Cost-per-participant calculations, indirect rate documentation, multi-year sustainability
   - Red flags: Generic percentages, missing match requirements, unrealistic staffing costs
   - Reviewer concern: "Can they deliver the proposed scope within budget?"

2. **IMPLEMENTATION FEASIBILITY** 
   - Missing: Detailed work plans, milestone dependencies, risk mitigation strategies
   - Red flags: Overly optimistic timelines, undefined project phases, missing critical path
   - Reviewer concern: "Do they have a realistic plan to execute this work?"

3. **MEASURABLE IMPACT POTENTIAL**
   - Missing: Baseline data, comparison groups, validated assessment tools, logic models
   - Red flags: Vague outcomes, missing evaluation design, no success metrics
   - Reviewer concern: "How will we know if this investment worked?"

4. **EVIDENCE-BASED APPROACH**
   - Missing: Literature review, theoretical framework, proven model adaptation
   - Red flags: Untested methods, missing citations, weak needs assessment
   - Reviewer concern: "Is this approach likely to work?"

5. **ORGANIZATIONAL READINESS**
   - Missing: Staff qualifications, capacity assessment, infrastructure details
   - Red flags: Undefined roles, missing expertise, unrealistic staffing ratios
   - Reviewer concern: "Can this organization actually deliver?"

6. **LONG-TERM VIABILITY**
   - Missing: Sustainability strategy, partnership commitments, revenue diversification
   - Red flags: Grant dependency, missing stakeholder buy-in, undefined continuation plan
   - Reviewer concern: "Will impact continue after funding ends?"

7. **COMMUNITY NEED & ALIGNMENT**
   - Missing: Demographic data, stakeholder input, needs assessment, target population specifics
   - Red flags: Generic problem statements, missing community voice, undefined beneficiaries
   - Reviewer concern: "Is there actual demand for this intervention?"

8. **INNOVATION & SIGNIFICANCE**
   - Missing: Unique value proposition, scalability potential, field contribution
   - Red flags: "More of the same" approaches, missing innovation narrative, limited scope
   - Reviewer concern: "Why fund this over 50 similar proposals?"

**CRITICAL EVALUATION CRITERIA:**
- Would a program officer immediately flag this for more information?
- Are there obvious questions a review panel would ask?
- Is missing information preventing a fair evaluation?
- Would this application score poorly due to insufficient detail?

For each significant gap, provide:
- Category (budget|timeline|outcomes|methodology|team|sustainability|evidence|specificity)
- Severity (critical=proposal likely rejected, high=major scoring impact, medium=reviewer concern, low=minor improvement)
- Description focusing on REVIEWER EXPECTATIONS
- Specific data points needed to meet professional standards
- Direct impact on funding probability

FORMAT EXACTLY AS:
GAP: [category]|[severity]|[description]|[missing_data_points]|[impact]

Focus on gaps that separate funded from unfunded applications. Maximum 8 most critical gaps.`;
  }

  private parseAnalysisResult(result: string): InformationGap[] {
    const gaps: InformationGap[] = [];
    const lines = result.split('\n');

    for (const line of lines) {
      if (line.startsWith('GAP:')) {
        const parts = line.substring(4).split('|');
        if (parts.length >= 5) {
          const [category, severity, description, missingData, impact] = parts.map(p => p.trim());
          
          if (this.isValidCategory(category) && this.isValidSeverity(severity)) {
            gaps.push({
              category: category as InformationGap['category'],
              severity: severity as InformationGap['severity'], 
              description,
              missingDataPoints: missingData.split(',').map(d => d.trim()).filter(Boolean),
              potentialImpact: impact
            });
          }
        }
      }
    }

    return gaps.slice(0, 8); // Ensure max 8 gaps
  }

  private isValidCategory(category: string): boolean {
    const validCategories = ['budget', 'timeline', 'outcomes', 'methodology', 'team', 'sustainability', 'evidence', 'specificity'];
    return validCategories.includes(category);
  }

  private isValidSeverity(severity: string): boolean {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    return validSeverities.includes(severity);
  }

  private getFallbackGaps(questions: string[]): InformationGap[] {
    // Fallback gaps based on common grant writing issues
    const fallbackGaps: InformationGap[] = [
      {
        category: 'budget',
        severity: 'high',
        description: 'Budget details and cost justification missing',
        missingDataPoints: ['Total project cost', 'Cost per participant', 'Indirect costs', 'Sustainability funding'],
        potentialImpact: 'Reviewers cannot assess financial feasibility and value proposition'
      },
      {
        category: 'outcomes',
        severity: 'high', 
        description: 'Specific measurable outcomes and evaluation metrics not defined',
        missingDataPoints: ['Success metrics', 'Baseline data', 'Target numbers', 'Evaluation timeline'],
        potentialImpact: 'Cannot demonstrate accountability or measure program effectiveness'
      },
      {
        category: 'methodology',
        severity: 'medium',
        description: 'Implementation approach lacks specific details and evidence base',
        missingDataPoints: ['Step-by-step process', 'Evidence-based practices', 'Risk mitigation', 'Quality assurance'],
        potentialImpact: 'Reviewers may question feasibility and effectiveness of approach'
      }
    ];

    return fallbackGaps;
  }

  /**
   * Prioritizes gaps based on severity and potential impact
   */
  prioritizeGaps(gaps: InformationGap[]): InformationGap[] {
    const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    
    return gaps.sort((a, b) => {
      const aWeight = severityWeight[a.severity];
      const bWeight = severityWeight[b.severity];
      
      if (aWeight !== bWeight) {
        return bWeight - aWeight; // Higher severity first
      }
      
      // Secondary sort by category importance
      const categoryWeight = {
        budget: 10, outcomes: 9, methodology: 8, evidence: 7,
        timeline: 6, team: 5, sustainability: 4, specificity: 3
      };
      
      return categoryWeight[b.category] - categoryWeight[a.category];
    });
  }
}