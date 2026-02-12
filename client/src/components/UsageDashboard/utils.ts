/**
 * Utility functions for UsageDashboard component
 */

export function formatUsageData(data: any) {
  // Add any data transformation logic here
  return data;
}

export function calculateUsagePercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

export function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-600';
  if (percentage >= 75) return 'text-yellow-600';
  return 'text-green-600';
}
