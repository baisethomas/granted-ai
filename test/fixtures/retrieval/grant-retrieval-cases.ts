export interface GrantRetrievalCase {
  id: string;
  question: string;
  expectedDocumentNames: string[];
  notes?: string;
}

/** Representative grant questions mapped to expected nonprofit source documents. */
export const GRANT_RETRIEVAL_CASES: GrantRetrievalCase[] = [
  {
    id: "monthly-families-served",
    question: "How many families does the organization serve each month?",
    expectedDocumentNames: ["community-impact-brief.docx"],
  },
  {
    id: "annual-budget",
    question: "What is the total annual program budget?",
    expectedDocumentNames: ["community-impact-brief.docx"],
  },
  {
    id: "program-services-allocation",
    question: "What percentage of the budget goes to direct program services?",
    expectedDocumentNames: ["community-impact-brief.docx"],
  },
  {
    id: "geographic-reach",
    question: "Which counties does Riverside Community Food Bank serve?",
    expectedDocumentNames: ["community-impact-brief.docx", "annual-report.pdf"],
    notes: "Keyword counties may surface annual report excerpt.",
  },
  {
    id: "mission-statement",
    question: "Summarize the organization mission and community impact.",
    expectedDocumentNames: ["community-impact-brief.docx", "annual-report.pdf"],
    notes: "Semantic retrieval should surface narrative chunks from either doc.",
  },
];
