import { getLLMProvider } from "@/lib/llm";
import type { InformationGap, ClarificationQuestion, ClarificationConfig } from "./types";

/**
 * Generates targeted clarifying questions based on identified information gaps
 */
export class QuestionGenerator {
  private llmProvider = getLLMProvider();
  private config: ClarificationConfig = {
    maxQuestions: 5,
    minCriticalQuestions: 2, 
    skipThreshold: 1,
    assumptionThreshold: 0.7
  };

  constructor(config?: Partial<ClarificationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async generateQuestions(
    gaps: InformationGap[], 
    grantQuestions: string[]
  ): Promise<ClarificationQuestion[]> {
    
    // Skip if too few gaps found
    if (gaps.length < this.config.skipThreshold) {
      return [];
    }

    // Ensure we have enough critical/high priority gaps
    const priorityGaps = gaps.filter(g => g.severity === 'critical' || g.severity === 'high');
    if (priorityGaps.length < this.config.minCriticalQuestions) {
      return [];
    }

    const questionPromises = gaps
      .slice(0, this.config.maxQuestions)
      .map(gap => this.generateQuestionForGap(gap, grantQuestions));

    const questions = await Promise.all(questionPromises);
    return questions.filter(Boolean) as ClarificationQuestion[];
  }

  private async generateQuestionForGap(
    gap: InformationGap, 
    grantQuestions: string[]
  ): Promise<ClarificationQuestion | null> {
    
    const prompt = this.buildQuestionPrompt(gap, grantQuestions);
    
    try {
      const result = await this.llmProvider.generate({
        instructions: prompt,
        questions: grantQuestions,
        context: `Missing information category: ${gap.category}`,
        maxTokens: 400
      });

      return this.parseQuestionResult(result, gap);
    } catch (error) {
      console.error(`Error generating question for gap: ${gap.category}`, error);
      return this.getFallbackQuestion(gap);
    }
  }

  private buildQuestionPrompt(gap: InformationGap, grantQuestions: string[]): string {
    return `You are a senior grant consultant with deep expertise in federal, foundation, and corporate funding. Your questions have helped clients secure $50M+ in funding by addressing exactly what reviewers need to see.

CRITICAL GAP TO RESOLVE:
Category: ${gap.category}
Severity: ${gap.severity}  
Description: ${gap.description}
Missing Data Points: ${gap.missingDataPoints.join(', ')}
Reviewer Impact: ${gap.potentialImpact}

RELATED GRANT QUESTIONS:
${grantQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

TASK: Craft ONE strategic clarifying question that addresses this gap with the specificity and detail that separates funded from unfunded applications.

**QUESTION DESIGN PRINCIPLES:**
- Ask for QUANTIFIABLE data that reviewers can evaluate objectively
- Request EVIDENCE that demonstrates organizational capacity and readiness
- Gather SPECIFICS that make the proposal stand out from generic applications
- Focus on information that addresses common reviewer concerns and scoring criteria
- Ensure answers will provide concrete details for compelling narrative

**CATEGORY-SPECIFIC EXPERTISE:**

**BUDGET Questions should gather:**
- Detailed cost calculations with clear methodologies
- Realistic salary/benefit rates with justifications
- Indirect cost documentation and compliance requirements
- Multi-year financial projections and sustainability strategies
- Cost-per-outcome metrics that demonstrate value

**TIMELINE Questions should gather:**
- Specific milestone dates with critical path dependencies
- Resource allocation timelines and capacity management
- Risk mitigation strategies and contingency planning
- Stakeholder coordination schedules and decision points
- Evaluation and reporting timeline integration

**OUTCOMES Questions should gather:**
- Baseline data and assessment methodologies
- Validated measurement tools and evaluation frameworks
- Target population specifications and recruitment strategies
- Logic model components linking activities to impacts
- Comparison group design and control methodologies

**METHODOLOGY Questions should gather:**
- Evidence-based practice documentation and adaptation plans
- Implementation protocols with fidelity monitoring systems
- Staff training requirements and competency assessments
- Quality assurance processes and continuous improvement cycles
- Community engagement strategies and cultural adaptations

**TEAM Questions should gather:**
- Specific qualifications, credentials, and relevant experience
- Role definitions with time allocations and deliverable responsibilities
- Organizational chart with reporting relationships and decision authority
- Professional development plans and capacity building strategies
- Succession planning and key personnel retention approaches

**SUSTAINABILITY Questions should gather:**
- Revenue diversification strategies with realistic projections
- Partnership agreements and stakeholder commitment levels
- Policy change advocacy and systems integration plans
- Community ownership development and local capacity building
- Long-term funding pipeline and relationship development

**EVIDENCE Questions should gather:**
- Community needs assessment data with methodology details
- Demographic profiles and target population characteristics
- Literature review findings and theoretical framework applications
- Pilot program results and lessons learned documentation
- Stakeholder input processes and community validation methods

**SPECIFICITY Questions should gather:**
- Concrete numbers, percentages, and measurable targets
- Geographic boundaries and service delivery locations
- Participant selection criteria and eligibility requirements
- Program components with detailed implementation specifications
- Success metrics with benchmarks and comparative standards

FORMAT RESPONSE EXACTLY AS:
QUESTION: [Strategic, specific question that elicits reviewer-ready details]
TYPE: [number|date|text|list|boolean]
CONTEXT: [Why this specific information is critical for reviewer evaluation and scoring]
EXAMPLES: [2-3 concrete examples of strong answers that would impress reviewers]
RELATED: [Specific grant questions this directly strengthens]

Your question should elicit information that makes reviewers say "This organization clearly knows what they're doing and can deliver results."`;
  }

  private parseQuestionResult(
    result: string, 
    gap: InformationGap
  ): ClarificationQuestion | null {
    const lines = result.split('\n');
    let question = '';
    let answerType: ClarificationQuestion['expectedAnswerType'] = 'text';
    let context = '';
    let examples: string[] = [];
    let relatedQuestions: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('QUESTION:')) {
        question = trimmedLine.substring(9).trim();
      } else if (trimmedLine.startsWith('TYPE:')) {
        const type = trimmedLine.substring(5).trim();
        if (['number', 'date', 'text', 'list', 'boolean'].includes(type)) {
          answerType = type as ClarificationQuestion['expectedAnswerType'];
        }
      } else if (trimmedLine.startsWith('CONTEXT:')) {
        context = trimmedLine.substring(8).trim();
      } else if (trimmedLine.startsWith('EXAMPLES:')) {
        const exampleText = trimmedLine.substring(9).trim();
        examples = exampleText.split(',').map(e => e.trim()).filter(Boolean);
      } else if (trimmedLine.startsWith('RELATED:')) {
        const relatedText = trimmedLine.substring(8).trim();
        relatedQuestions = relatedText.split(',').map(r => r.trim()).filter(Boolean);
      }
    }

    if (!question || !context) {
      return null;
    }

    return {
      id: this.generateQuestionId(gap),
      question,
      category: gap.category,
      priority: gap.severity,
      expectedAnswerType: answerType,
      context,
      examples: examples.length > 0 ? examples : undefined,
      relatedQuestions: relatedQuestions.length > 0 ? relatedQuestions : undefined
    };
  }

  private getFallbackQuestion(gap: InformationGap): ClarificationQuestion {
    const fallbackQuestions: Record<string, Omit<ClarificationQuestion, 'id'>> = {
      budget: {
        question: "Provide detailed budget breakdown including: total project cost, cost per participant/beneficiary, personnel costs with FTE allocations, indirect rate documentation, and your 3-year sustainability funding strategy.",
        category: 'budget',
        priority: gap.severity,
        expectedAnswerType: 'text',
        context: "Reviewers need comprehensive budget justification to assess financial feasibility, organizational capacity, and long-term viability. Missing budget details are a top reason for application rejection.",
        examples: [
          "$150,000 total: $90K personnel (1.5 FTE), $25K direct costs, $35K indirect (23% federally negotiated rate). Cost per participant: $750 serving 200 individuals.",
          "Year 1: $100K foundation grant. Year 2: $60K foundation + $40K corporate sponsorship. Year 3: $50K earned revenue + $50K government contract.",
          "Personnel: Project Director (1.0 FTE @ $65K), Case Manager (0.5 FTE @ $45K), Admin Assistant (0.25 FTE @ $35K). Benefits at 28% of salary."
        ]
      },
      outcomes: {
        question: "Detail your evaluation plan including: baseline data collection methods, validated assessment instruments, target outcomes with specific metrics, comparison group design, and data collection timeline.",
        category: 'outcomes', 
        priority: gap.severity,
        expectedAnswerType: 'text',
        context: "Strong evaluation plans with measurable outcomes are essential for reviewer confidence in program effectiveness and accountability. Vague outcomes signal weak program design.",
        examples: [
          "Pre/post assessment using validated STAR Reading Assessment. Target: 75% of participants improve reading level by 1.5 grades. Baseline collection Month 1, interim Month 6, final Month 12.",
          "Primary outcome: 80% job placement rate within 90 days of program completion (vs. 45% historical average). Secondary: Average wage $16/hour (vs. $12 community average). Data via employer surveys and participant self-report.",
          "Youth Risk Behavior Survey (YRBS) at baseline, 6-month, 12-month intervals. Target 40% reduction in risky behaviors. Waitlist control group design with 100 treatment, 100 control participants."
        ]
      },
      timeline: {
        question: "Provide a detailed implementation timeline including: major milestones with specific dates, critical path dependencies, risk mitigation strategies, staff onboarding schedule, and evaluation reporting deadlines.",
        category: 'timeline',
        priority: gap.severity, 
        expectedAnswerType: 'text',
        context: "Realistic, detailed timelines demonstrate project management competency and implementation feasibility. Overly optimistic timelines signal inexperience and implementation risk.",
        examples: [
          "Month 1-2: Staff recruitment and hiring (contingency: temp staff if delays). Month 3: Staff training and program setup. Month 4-10: Service delivery with monthly progress reviews. Month 11-12: Evaluation and reporting.",
          "Quarter 1: Baseline data collection (March completion critical path). Quarter 2: Intervention launch with 25% participant enrollment. Quarter 3: Full enrollment (100 participants). Quarter 4: Final assessments and 6-month follow-up scheduling.",
          "Week 1-4: IRB approval submission. Week 5-8: Community partner agreements. Week 9-12: Participant recruitment (backup: social media campaign if referrals insufficient). Week 13-52: Service delivery with bi-weekly supervision meetings."
        ]
      },
      methodology: {
        question: "Describe your evidence-based approach including: theoretical framework, proven model adaptations, implementation protocols with fidelity measures, quality assurance processes, and literature review supporting your methods.",
        category: 'methodology',
        priority: gap.severity,
        expectedAnswerType: 'text',
        context: "Evidence-based approaches demonstrate professional competency and increase likelihood of success. Reviewers prioritize proposals grounded in research over untested innovations.",
        examples: [
          "Utilizing Trauma-Informed Care framework adapted from SAMHSA guidelines. Implementation: Staff training on TIC principles, environmental modifications per TIC checklist, fidelity monitoring via monthly observational assessments using established rubrics.",
          "Cognitive Behavioral Therapy model adapted for group settings based on Clarke et al. (2015) RCT showing 65% efficacy. Protocol: 12-week curriculum, licensed therapist delivery, session fidelity checklists, weekly supervision per CBT standards.",
          "Positive Youth Development approach following Lerner & Lerner (2013) framework. Five C's implementation: structured activities building Competence, Confidence, Connection, Character, Caring. Fidelity: monthly youth surveys, program observation using PYD assessment tool."
        ]
      },
      team: {
        question: "Detail key personnel including: specific qualifications and relevant experience, role definitions with time allocations, organizational chart with reporting structure, professional development plans, and succession/retention strategies.",
        category: 'team',
        priority: gap.severity,
        expectedAnswerType: 'text', 
        context: "Staff qualifications and organizational capacity are primary factors in funding decisions. Reviewers need confidence the team can deliver proposed outcomes with available expertise.",
        examples: [
          "Project Director: Sarah Johnson, MSW, 12 years program management, led 3 similar initiatives with 85% outcome achievement. Role: overall management, stakeholder relations (25% time). Succession: Associate Director promoted if departure.",
          "Clinical Supervisor: Dr. Maria Rodriguez, PhD Psychology, Licensed Clinical Psychologist, 15 years trauma-informed care. Role: clinical oversight, staff supervision, treatment planning (0.5 FTE). Professional development: Annual TIC conference attendance.",
          "Case Manager: Open position requiring BA Social Work + 3 years experience. Recruitment: Partnership with University MSW program for candidates. Training: 40-hour onboarding including evidence-based practices, cultural competency, data systems."
        ]
      },
      sustainability: {
        question: "Outline your sustainability strategy including: diversified funding pipeline with specific prospects, revenue generation models, partnership commitments, community ownership development, and 5-year financial projections.",
        category: 'sustainability',
        priority: gap.severity,
        expectedAnswerType: 'text',
        context: "Sustainability planning demonstrates strategic thinking and ensures lasting impact. Funders increasingly prioritize proposals with realistic continuation strategies over one-time interventions.",
        examples: [
          "Year 2: 50% fee-for-service via Medicaid billing ($75K), 30% corporate sponsors ($45K), 20% foundation grants ($30K). Years 3-5: Medicaid expansion to 70%, corporate partnerships to 20%, earned revenue 10% through training services.",
          "Partnership agreements: City committed $25K annually Years 2-5. School district providing in-kind space ($15K value). United Way included in priority funding for $40K Year 2. Hospital system exploring partnership for $20K ongoing.",
          "Community ownership: Parent advisory board established Month 6, taking governance role Year 2. Local champions identified and trained. Program embedded in existing community infrastructure. Policy advocacy for sustainable funding streams initiated Year 1."
        ]
      },
      evidence: {
        question: "Present comprehensive needs assessment data including: community demographic analysis, problem scope quantification, target population characteristics, stakeholder input documentation, and baseline metrics with data sources.",
        category: 'evidence',
        priority: gap.severity,
        expectedAnswerType: 'text', 
        context: "Strong needs assessment data demonstrates community demand and provides baseline for impact measurement. Weak needs documentation suggests insufficient planning and community engagement.",
        examples: [
          "Census data: 35% residents below poverty line (vs 18% state average). School district data: 45% students chronic absenteeism (state average 22%). Community survey (n=250): 78% report mental health as top concern, 65% unable to access services due to cost/transportation.",
          "Target population: 500 homeless individuals in downtown core per Point-in-Time count. 60% report substance use disorders, 40% serious mental illness. Housing authority waitlist: 18-month average. Emergency shelter utilization: 95% capacity year-round.",
          "Youth Risk Behavior Survey: Local high school 23% students report depression symptoms (state 18%), 15% substance use (state 12%). Focus groups with 45 parents identified lack of after-school programming. Police data: 30% increase in juvenile incidents past 2 years."
        ]
      },
      specificity: {
        question: "Provide precise program specifications including: exact target population numbers and selection criteria, geographic service boundaries, detailed eligibility requirements, service intensity and duration, and concrete deliverable commitments.",
        category: 'specificity',
        priority: gap.severity,
        expectedAnswerType: 'text',
        context: "Specific details enable accurate proposal evaluation and demonstrate thorough planning. Vague descriptions suggest insufficient preparation and make impact assessment impossible.",
        examples: [
          "Target: 120 low-income families (income ≤150% FPL) with children ages 3-8 in Lincoln Elementary catchment area (zip codes 12345, 12346). Eligibility: English/Spanish speaking, willing to participate 6-month program, no active CPS involvement. Service: 2-hour weekly sessions, 24 total contacts per family.",
          "Geographic scope: 5-mile radius from community center (specific address: 123 Main St). Population: 200 veterans experiencing homelessness, prioritizing chronically homeless (>1 year) with disabilities. Exclusions: active psychosis requiring hospitalization, violent criminal history. Intensity: Daily contact first 30 days, weekly thereafter.",
          "Participants: 75 high school students grades 9-12 with 2+ risk factors (poor grades, absenteeism, disciplinary referrals, family stress). Recruitment: School counselor referrals, self-referral option. Program: 3 days/week after school, 2.5 hours daily, academic support + life skills curriculum. Duration: Full school year (32 weeks)."
        ]
      }
    };

    const fallback = fallbackQuestions[gap.category] || fallbackQuestions.specificity;
    return {
      id: this.generateQuestionId(gap),
      ...fallback
    };
  }

  private generateQuestionId(gap: InformationGap): string {
    return `clarification-${gap.category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Filters and prioritizes questions to stay within limits
   */
  optimizeQuestionSelection(questions: ClarificationQuestion[]): ClarificationQuestion[] {
    // Sort by priority (critical -> high -> medium -> low)
    const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    const sorted = questions.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
    
    // Ensure we have diverse categories represented
    const selected: ClarificationQuestion[] = [];
    const usedCategories = new Set<string>();
    
    // First pass: Select highest priority from each category
    for (const question of sorted) {
      if (selected.length >= this.config.maxQuestions) break;
      if (!usedCategories.has(question.category)) {
        selected.push(question);
        usedCategories.add(question.category);
      }
    }
    
    // Second pass: Fill remaining slots with highest priority questions
    for (const question of sorted) {
      if (selected.length >= this.config.maxQuestions) break;
      if (!selected.includes(question)) {
        selected.push(question);
      }
    }
    
    return selected;
  }
}