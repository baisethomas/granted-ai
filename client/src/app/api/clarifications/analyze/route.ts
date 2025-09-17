import { NextRequest, NextResponse } from 'next/server';

export interface ClarificationQuestion {
  id: string;
  category: 'budget' | 'timeline' | 'outcomes' | 'methodology' | 'team' | 'sustainability' | 'evidence' | 'specificity';
  priority: 'critical' | 'high' | 'medium' | 'low';
  questionText: string;
  contextExplanation: string;
  exampleAnswer?: string;
  isAnswered: boolean;
  answer?: string;
  followUpNeeded: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, questions, organizationContext } = body;

    // Mock clarification questions based on common grant application gaps
    const mockQuestions: ClarificationQuestion[] = [
      {
        id: 'budget-breakdown',
        category: 'budget',
        priority: 'critical',
        questionText: 'What is the detailed breakdown of your project budget, including personnel, equipment, and indirect costs?',
        contextExplanation: 'Reviewers need to see exactly how funds will be used. A detailed budget breakdown demonstrates fiscal responsibility and helps reviewers assess cost-effectiveness.',
        exampleAnswer: 'Personnel costs (65%): $130,000 for PI and research staff. Equipment (20%): $40,000 for specialized software and hardware. Indirect costs (15%): $30,000 for institutional overhead.',
        isAnswered: false,
        followUpNeeded: false
      },
      {
        id: 'timeline-milestones',
        category: 'timeline',
        priority: 'high',
        questionText: 'What are the specific milestones and deliverables for each project phase, with realistic timeframes?',
        contextExplanation: 'A detailed timeline with milestones shows you have thought through the project implementation and can manage it effectively.',
        exampleAnswer: 'Phase 1 (Months 1-6): Literature review and methodology development. Phase 2 (Months 7-18): Data collection and analysis. Phase 3 (Months 19-24): Report writing and dissemination.',
        isAnswered: false,
        followUpNeeded: false
      },
      {
        id: 'success-metrics',
        category: 'outcomes',
        priority: 'high',
        questionText: 'How will you measure success? What specific, quantifiable metrics will demonstrate your project\'s impact?',
        contextExplanation: 'Funders want to see measurable outcomes. Clear metrics help demonstrate accountability and enable impact assessment.',
        exampleAnswer: 'Success metrics include: 25% increase in student test scores, 500+ community members trained, 80% participant satisfaction rate, and 3 peer-reviewed publications.',
        isAnswered: false,
        followUpNeeded: false
      },
      {
        id: 'team-qualifications',
        category: 'team',
        priority: 'medium',
        questionText: 'What specific qualifications and relevant experience does each key team member bring to this project?',
        contextExplanation: 'Reviewers assess whether your team has the expertise to successfully complete the proposed work. Highlight relevant credentials and past successes.',
        exampleAnswer: 'Dr. Smith (PI): 15 years in educational research, led 3 similar NSF projects. Dr. Johnson (Co-PI): Expert in data analysis, published 25 papers in education statistics.',
        isAnswered: false,
        followUpNeeded: false
      }
    ];

    // In a real implementation, this would:
    // 1. Analyze the questions and existing organizational context
    // 2. Use AI to identify information gaps
    // 3. Generate targeted questions based on gaps
    // 4. Prioritize questions by importance to grant success
    // 5. Limit to ≤5 most critical questions

    const response = {
      questions: mockQuestions.slice(0, 4), // Limit to 4 questions for demo
      totalGapsIdentified: 8,
      criticalGapsCount: 2,
      analysisConfidence: 0.87,
      recommendations: [
        'Focus on providing specific budget details and timeline milestones',
        'Include quantifiable success metrics and evaluation methods',
        'Highlight team qualifications and relevant experience'
      ]
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in clarification analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze clarification needs' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return sample clarification questions for testing
  const sampleQuestions: ClarificationQuestion[] = [
    {
      id: 'sample-1',
      category: 'budget',
      priority: 'critical',
      questionText: 'What is your total project budget and how is it allocated across different categories?',
      contextExplanation: 'Budget information is essential for reviewers to assess project feasibility and cost-effectiveness.',
      exampleAnswer: 'Total budget: $200,000. Personnel: 60%, Equipment: 25%, Travel: 10%, Other: 5%',
      isAnswered: false,
      followUpNeeded: false
    },
    {
      id: 'sample-2',
      category: 'outcomes',
      priority: 'high',
      questionText: 'What specific, measurable outcomes do you expect from this project?',
      contextExplanation: 'Clear outcome metrics demonstrate impact and accountability to funders.',
      exampleAnswer: 'We expect to train 200 teachers, improve student scores by 15%, and publish 2 research papers.',
      isAnswered: false,
      followUpNeeded: false
    }
  ];

  return NextResponse.json({ questions: sampleQuestions });
}