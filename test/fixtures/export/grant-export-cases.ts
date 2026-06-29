import type { ExportData } from "@/lib/export";

/** Representative grant export payloads for GRA-14 verification. */
export const GRANT_EXPORT_FIXTURE: ExportData = {
  project: {
    id: "proj-1",
    title: "Community Food Access Initiative",
    funder: "Riverside Foundation",
    amount: "$125,000",
    deadline: "2026-09-30",
    status: "draft",
    description:
      "Expand mobile pantry routes to reach underserved neighborhoods with fresh produce and nutrition education.",
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-06-01"),
  },
  questions: [
    {
      id: "q1",
      projectId: "proj-1",
      question: "Describe your organization's mission and community impact.",
      wordLimit: 500,
      priority: "high",
      response:
        "**Riverside Community Food Bank** serves over *850 families* monthly.\n\nOur mission is to eliminate hunger through dignified food access.",
      responseStatus: "complete",
      createdAt: new Date("2026-01-15"),
      assumptions: [
        {
          id: "a1",
          text: "Confirm latest monthly family count",
          category: "impact",
          confidence: 0.8,
          suggestedQuestion: "What is the current monthly families served figure?",
          resolved: false,
        },
      ],
    },
    {
      id: "q2",
      projectId: "proj-1",
      question: "Outline your program budget and fiscal oversight.",
      wordLimit: 300,
      priority: "high",
      response: "Annual budget is $1.2M with 72% allocated to direct program services.",
      responseStatus: "edited",
      createdAt: new Date("2026-01-15"),
    },
    {
      id: "q3",
      projectId: "proj-1",
      question: "Pending draft question",
      wordLimit: 200,
      priority: "medium",
      response: "",
      responseStatus: "pending",
      createdAt: new Date("2026-01-15"),
    },
  ],
  metadata: {
    exportDate: new Date("2026-06-28T12:00:00.000Z"),
    organizationName: "Riverside Community Food Bank",
  },
};
