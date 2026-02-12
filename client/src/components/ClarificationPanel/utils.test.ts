import { describe, it, expect } from 'vitest';
import { getCategoryColor, calculateCompletionRate } from './utils';

describe('ClarificationPanel/utils', () => {
  describe('getCategoryColor', () => {
    it('should return correct color for budget category', () => {
      expect(getCategoryColor('budget')).toBe('bg-green-100 text-green-800');
    });

    it('should return correct color for timeline category', () => {
      expect(getCategoryColor('timeline')).toBe('bg-blue-100 text-blue-800');
    });

    it('should return correct color for outcomes category', () => {
      expect(getCategoryColor('outcomes')).toBe('bg-purple-100 text-purple-800');
    });

    it('should return default color for unknown category', () => {
      expect(getCategoryColor('unknown')).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('calculateCompletionRate', () => {
    it('should return 0 for empty array', () => {
      expect(calculateCompletionRate([])).toBe(0);
    });

    it('should return 100 when all questions are answered', () => {
      const questions = [
        { id: '1', isAnswered: true },
        { id: '2', isAnswered: true },
        { id: '3', isAnswered: true }
      ];
      expect(calculateCompletionRate(questions)).toBe(100);
    });

    it('should return 0 when no questions are answered', () => {
      const questions = [
        { id: '1', isAnswered: false },
        { id: '2', isAnswered: false }
      ];
      expect(calculateCompletionRate(questions)).toBe(0);
    });

    it('should return correct percentage for partial completion', () => {
      const questions = [
        { id: '1', isAnswered: true },
        { id: '2', isAnswered: false },
        { id: '3', isAnswered: true },
        { id: '4', isAnswered: false }
      ];
      expect(calculateCompletionRate(questions)).toBe(50);
    });
  });
});
