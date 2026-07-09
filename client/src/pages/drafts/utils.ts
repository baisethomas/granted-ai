/**
 * Strip any trailing "Citations:" / "Assumptions & Follow-ups:" blocks that
 * legacy drafts may have appended to the response body. Citations and
 * assumptions are tracked separately; the document text itself should not
 * contain them.
 */
export function stripMetaBlocks(text: string): string {
  if (!text) return text;

  // Remove from the first occurrence of either section header to end of string.
  // The marker must appear at the start of a line.
  return text.replace(
    /\n{1,}\s*(?:Citations|Assumptions(?:\s*&\s*Follow-?ups)?|Follow-?ups)\s*:\s*[\s\S]*$/i,
    '',
  );
}

/**
 * Strip markdown formatting from text
 */
export function stripMarkdown(text: string): string {
  if (!text) return text;

  const withoutMeta = stripMetaBlocks(text);

  return withoutMeta
    // Remove bold/italic markers
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points
    .replace(/^\s*[-*+]\s+/gm, '')
    // Remove numbered lists formatting but keep the content
    .replace(/^\s*\d+\.\s+/gm, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalize question data (handles both camelCase and snake_case)
 */
export function normalizeQuestion(question: any) {
  const response = question.response || question.response_text || '';
  return {
    ...question,
    response: stripMarkdown(response),
    responseStatus: question.responseStatus || question.response_status || 'pending',
  };
}
