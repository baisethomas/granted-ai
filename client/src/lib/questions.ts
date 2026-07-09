// The questions endpoint's response status has been observed in both
// camelCase and snake_case shapes — resolve both so counts don't silently
// undercount when a caller forgets which one they got.
export function resolveResponseStatus(
  question: { responseStatus?: string | null; response_status?: string | null },
): string | null | undefined {
  return question.responseStatus ?? question.response_status;
}

export function isQuestionAnswered(responseStatus: string | undefined | null): boolean {
  return responseStatus === "complete" || responseStatus === "edited";
}
