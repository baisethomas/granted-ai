/**
 * Utility functions for EvidenceMap component
 */

export function getEvidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function getEvidenceLabel(score: number): string {
  if (score >= 0.8) return 'Strong';
  if (score >= 0.6) return 'Moderate';
  return 'Weak';
}

export function calculateAverageScore(data: any[]): number {
  if (data.length === 0) return 0;
  const sum = data.reduce((acc, item) => acc + item.evidenceStrength, 0);
  return sum / data.length;
}
