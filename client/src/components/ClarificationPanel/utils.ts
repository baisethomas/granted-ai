/**
 * Utility functions for ClarificationPanel component
 */

export function getCategoryColor(category: string) {
  const colors = {
    budget: 'bg-green-100 text-green-800',
    timeline: 'bg-blue-100 text-blue-800',
    outcomes: 'bg-purple-100 text-purple-800',
    methodology: 'bg-yellow-100 text-yellow-800',
    team: 'bg-pink-100 text-pink-800',
    sustainability: 'bg-indigo-100 text-indigo-800',
    evidence: 'bg-orange-100 text-orange-800',
    specificity: 'bg-gray-100 text-gray-800'
  };
  return colors[category as keyof typeof colors] || colors.specificity;
}

export function calculateCompletionRate(questions: any[]): number {
  if (questions.length === 0) return 0;
  const answeredCount = questions.filter(q => q.isAnswered).length;
  return (answeredCount / questions.length) * 100;
}
