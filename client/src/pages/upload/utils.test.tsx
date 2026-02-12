import { describe, it, expect } from 'vitest';
import { getFileIcon, getCategoryColor, getCategoryLabel, getProcessingBadge } from './utils';

describe('upload/utils', () => {
  describe('getFileIcon', () => {
    it('should return PDF icon for PDF files', () => {
      expect(getFileIcon('application/pdf')).toContain('fa-file-pdf');
    });

    it('should return Word icon for Word documents', () => {
      expect(getFileIcon('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toContain('fa-file-word');
    });

    it('should return Excel icon for spreadsheets', () => {
      expect(getFileIcon('application/vnd.ms-excel')).toContain('fa-file-excel');
    });

    it('should return default icon for unknown file types', () => {
      expect(getFileIcon('text/plain')).toContain('fa-file-alt');
    });
  });

  describe('getCategoryColor', () => {
    it('should return blue for organization-info', () => {
      expect(getCategoryColor('organization-info')).toBe('bg-blue-100 text-blue-800');
    });

    it('should return green for past-successes', () => {
      expect(getCategoryColor('past-successes')).toBe('bg-green-100 text-green-800');
    });

    it('should return purple for budgets', () => {
      expect(getCategoryColor('budgets')).toBe('bg-purple-100 text-purple-800');
    });

    it('should return gray for unknown category', () => {
      expect(getCategoryColor('unknown')).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('getCategoryLabel', () => {
    it('should return correct label for organization-info', () => {
      expect(getCategoryLabel('organization-info')).toBe('Organization Info');
    });

    it('should return correct label for past-successes', () => {
      expect(getCategoryLabel('past-successes')).toBe('Past Successes');
    });

    it('should return "Other" for undefined category', () => {
      expect(getCategoryLabel(undefined)).toBe('Other');
    });

    it('should return category name for unknown category', () => {
      expect(getCategoryLabel('custom-category')).toBe('custom-category');
    });
  });

  describe('getProcessingBadge', () => {
    it('should return Ready badge for completed documents', () => {
      const document = { processingStatus: 'complete' };
      const badge = getProcessingBadge(document);
      expect(badge.label).toBe('Ready');
      expect(badge.color).toContain('green');
    });

    it('should return Failed badge for failed documents', () => {
      const document = { processingStatus: 'failed' };
      const badge = getProcessingBadge(document);
      expect(badge.label).toBe('Failed');
      expect(badge.color).toContain('red');
    });

    it('should return Processing badge for pending documents', () => {
      const document = { processingStatus: 'pending' };
      const badge = getProcessingBadge(document);
      expect(badge.label).toBe('Processing');
      expect(badge.color).toContain('yellow');
    });

    it('should check processed flag if no processingStatus', () => {
      const document = { processed: true };
      const badge = getProcessingBadge(document);
      expect(badge.label).toBe('Ready');
    });
  });
});
