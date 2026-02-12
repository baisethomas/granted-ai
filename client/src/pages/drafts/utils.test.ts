import { describe, it, expect } from 'vitest';
import { stripMarkdown, normalizeQuestion } from './utils';

describe('drafts/utils', () => {
  describe('stripMarkdown', () => {
    it('should remove bold formatting', () => {
      const input = '**bold text**';
      const output = stripMarkdown(input);
      expect(output).toBe('bold text');
    });

    it('should remove italic formatting', () => {
      const input = '*italic text*';
      const output = stripMarkdown(input);
      expect(output).toBe('italic text');
    });

    it('should remove headers', () => {
      const input = '## Heading';
      const output = stripMarkdown(input);
      expect(output).toBe('Heading');
    });

    it('should remove bullet points', () => {
      const input = '- bullet point';
      const output = stripMarkdown(input);
      expect(output).toBe('bullet point');
    });

    it('should remove inline code', () => {
      const input = 'Some `code` here';
      const output = stripMarkdown(input);
      expect(output).toBe('Some code here');
    });

    it('should remove links but keep text', () => {
      const input = '[Link text](https://example.com)';
      const output = stripMarkdown(input);
      expect(output).toBe('Link text');
    });

    it('should handle empty string', () => {
      expect(stripMarkdown('')).toBe('');
    });

    it('should handle text without markdown', () => {
      const input = 'Plain text without any formatting';
      const output = stripMarkdown(input);
      expect(output).toBe('Plain text without any formatting');
    });
  });

  describe('normalizeQuestion', () => {
    it('should normalize question with camelCase response', () => {
      const question = {
        id: '1',
        response: '**Formatted** response',
        responseStatus: 'complete'
      };
      const normalized = normalizeQuestion(question);
      expect(normalized.response).toBe('Formatted response');
      expect(normalized.responseStatus).toBe('complete');
    });

    it('should normalize question with snake_case response_text', () => {
      const question = {
        id: '1',
        response_text: '**Formatted** response',
        response_status: 'pending'
      };
      const normalized = normalizeQuestion(question);
      expect(normalized.response).toBe('Formatted response');
      expect(normalized.responseStatus).toBe('pending');
    });

    it('should default to pending status if not provided', () => {
      const question = { id: '1', response: 'Test' };
      const normalized = normalizeQuestion(question);
      expect(normalized.responseStatus).toBe('pending');
    });

    it('should handle empty response', () => {
      const question = { id: '1' };
      const normalized = normalizeQuestion(question);
      expect(normalized.response).toBe('');
    });
  });
});
