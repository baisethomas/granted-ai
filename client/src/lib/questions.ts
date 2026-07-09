export function isQuestionAnswered(responseStatus: string | undefined | null): boolean {
  return responseStatus === "complete" || responseStatus === "edited";
}
