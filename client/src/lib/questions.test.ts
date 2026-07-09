import { describe, expect, it } from "vitest";
import { isQuestionAnswered, resolveResponseStatus } from "./questions";

describe("resolveResponseStatus", () => {
  it("prefers camelCase responseStatus when present", () => {
    expect(resolveResponseStatus({ responseStatus: "complete", response_status: "pending" })).toBe(
      "complete",
    );
  });

  it("falls back to snake_case response_status", () => {
    expect(resolveResponseStatus({ response_status: "complete" })).toBe("complete");
  });

  it("returns undefined when neither field is present", () => {
    expect(resolveResponseStatus({})).toBeUndefined();
  });
});

describe("isQuestionAnswered", () => {
  it("treats complete and edited as answered", () => {
    expect(isQuestionAnswered("complete")).toBe(true);
    expect(isQuestionAnswered("edited")).toBe(true);
  });

  it("treats pending, failed, and missing status as not answered", () => {
    expect(isQuestionAnswered("pending")).toBe(false);
    expect(isQuestionAnswered("failed")).toBe(false);
    expect(isQuestionAnswered(undefined)).toBe(false);
    expect(isQuestionAnswered(null)).toBe(false);
  });

  it("counts a snake_case-only question as answered once resolved", () => {
    const question = { response_status: "complete" };
    expect(isQuestionAnswered(resolveResponseStatus(question))).toBe(true);
  });
});
