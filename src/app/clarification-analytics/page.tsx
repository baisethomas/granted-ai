"use client";

import { ClarificationDashboard } from "@/components/clarifications/ClarificationDashboard";

export default function ClarificationAnalyticsPage() {
  // In a real app, this would come from authentication/user context
  const organizationId = "default"; // TODO: Get from user session

  return (
    <div className="container py-8">
      <ClarificationDashboard organizationId={organizationId} />
    </div>
  );
}