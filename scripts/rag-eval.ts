/**
 * Citation-faithfulness eval for the generation pipeline (driven by /rag-eval).
 *
 * Runs a fixed set of grant-question cases through
 * aiService.generateGroundedResponse() with known context chunks, then checks
 * the output with verifiers that are INDEPENDENT of the pipeline's own
 * grounding code (so a regression in normalizeGroundedCitations or
 * findUnsupportedSpecifics is caught rather than mirrored):
 *
 *   1. Marker validity  — every [#N] in the text points at a supplied chunk.
 *   2. Citation trace   — every returned citation maps to a supplied chunk.
 *   3. Number grounding — every number in the text appears in the supplied
 *                         chunks, the question, or a flagged assumption.
 *   4. Entity grounding — every proper-noun phrase in the text appears in the
 *                         chunks, the question/org info, or an assumption
 *                         (the GRA-52 "named the unnamed counties" class).
 *   5. Honest gaps      — cases with thin/irrelevant context must surface
 *                         assumptions rather than confident specifics.
 *
 * Billing note: this is a dev-only script run by hand against the developer's
 * own OPENAI_API_KEY. It has no user or organization, so the
 * billingService.checkLimit gate (which governs user-facing token spend) does
 * not apply. A full live run costs roughly $0.02–0.05 on gpt-4o-mini.
 *
 * Usage:
 *   npx tsx scripts/rag-eval.ts --dry-run           # checker self-test, no API calls
 *   npx tsx scripts/rag-eval.ts                     # live eval, compares to baseline
 *   npx tsx scripts/rag-eval.ts --update-baseline   # live eval, rewrites baseline
 *
 * Baseline: docs/rag-eval-baseline.json (committed).
 * Exit codes: 0 = pass / no regression; 1 = regression, missing key, or
 * checker self-test failure.
 */
import "../server/config.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  aiService,
  type GeneratedGroundedResponse,
  type RetrievedContextChunk,
} from "../server/services/ai.js";

const BASELINE_PATH = path.resolve(process.cwd(), "docs/rag-eval-baseline.json");

interface EvalCase {
  id: string;
  question: string;
  chunks: RetrievedContextChunk[];
  /** When true, the case gives the model little/irrelevant context and we
   * require a non-empty assumptions array (honest-gap behavior). */
  expectAssumptions?: boolean;
}

const ORG_INFO = {
  organizationName: "Riverside Community Food Bank",
  organizationType: "nonprofit",
  mission: "Reduce food insecurity for families in our region.",
};

function chunk(index: number, documentName: string, content: string): RetrievedContextChunk {
  return {
    documentName,
    documentId: `doc-${documentName}`,
    content,
    chunkIndex: index,
    similarity: 0.8,
  };
}

const CASES: EvalCase[] = [
  {
    id: "capacity-basics",
    question: "Describe your organization's capacity to deliver this program.",
    chunks: [
      chunk(
        0,
        "impact-brief.docx",
        "Riverside Community Food Bank has served the region since 2009. We provide meals to over 850 families each month across three counties. Our annual budget is $1.2 million, with 72% directed to program services."
      ),
      chunk(
        1,
        "annual-report.pdf",
        "In the last fiscal year we distributed 410,000 pounds of food and coordinated 180 volunteers. Our warehouse operates five days per week."
      ),
    ],
  },
  {
    id: "unnamed-entities-trap",
    question: "Which geographic areas and partners does your program serve?",
    chunks: [
      chunk(
        0,
        "impact-brief.docx",
        "We provide meals to over 850 families each month across three counties in the region, working with several partner agencies including local schools and faith communities."
      ),
    ],
  },
  {
    id: "budget-numbers",
    question: "What is your organization's annual budget and how is it allocated?",
    chunks: [
      chunk(
        0,
        "budget-summary.pdf",
        "Annual operating budget: $1.2 million. Program services: 72%. Administration: 18%. Fundraising: 10%. The finance committee reviews spending quarterly."
      ),
    ],
  },
  {
    id: "outcomes-partial-support",
    question: "What measurable outcomes will this project achieve, and how will you track them?",
    chunks: [
      chunk(
        0,
        "impact-brief.docx",
        "We provide meals to over 850 families each month. Client surveys are collected twice per year to assess food security status."
      ),
    ],
    expectAssumptions: true,
  },
  {
    id: "no-context-honesty",
    question: "How many jobs will this project create and what wages will it pay?",
    chunks: [
      chunk(
        0,
        "hr-policy.pdf",
        "Employees accrue paid time off monthly. Remote work requires supervisor approval. The office closes on federal holidays."
      ),
    ],
    expectAssumptions: true,
  },
  {
    id: "history-and-people",
    question: "Describe your organization's history and leadership experience.",
    chunks: [
      chunk(
        0,
        "org-profile.docx",
        "Founded in 2009, Riverside Community Food Bank grew from a single church pantry into a regional distributor. Our executive director has led the organization for eleven years and previously managed county nutrition programs."
      ),
    ],
  },
];

// ---------------------------------------------------------------------------
// Independent verifiers (deliberately NOT reusing ai.ts helpers)
// ---------------------------------------------------------------------------

const SENTENCE_STARTER_STOPWORDS = new Set([
  "We", "Our", "The", "This", "That", "These", "Those", "In", "Since", "As",
  "For", "With", "Over", "Each", "Annual", "Founded", "January", "February",
  "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December",
]);

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Strips thousands separators inside digit runs ("410,000" → "410000") so
 * number lookups are format-independent. */
function stripDigitCommas(s: string): string {
  return s.replace(/(\d),(?=\d)/g, "$1");
}

/** All digit-bearing tokens in the text, commas stripped (e.g. "1.2", "850"). */
function extractNumbers(text: string): string[] {
  const withoutMarkers = text.replace(/\[#\d+\]/g, " ");
  const matches = withoutMarkers.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return matches.map((m) => m.replace(/,/g, ""));
}

/** Proper-noun-shaped phrases: multi-word capitalized runs anywhere, plus
 * single capitalized words that are not sentence-initial. */
function extractEntities(text: string): string[] {
  const withoutMarkers = text.replace(/\[#\d+\]/g, " ");
  const sentences = withoutMarkers.split(/(?<=[.!?])\s+/);
  const entities: string[] = [];
  for (const sentence of sentences) {
    const runs = sentence.match(/\b[A-Z][a-zA-Z.'-]*(?:\s+[A-Z][a-zA-Z.'-]*)*\b/g) ?? [];
    for (const run of runs) {
      const words = run.split(/\s+/).filter((w) => !SENTENCE_STARTER_STOPWORDS.has(w));
      if (!words.length) continue;
      const phrase = words.join(" ");
      const isSentenceInitial = sentence.trimStart().startsWith(run);
      if (words.length === 1 && (isSentenceInitial || phrase.length <= 2)) continue;
      entities.push(phrase);
    }
  }
  return entities;
}

interface CaseResult {
  id: string;
  pass: boolean;
  failures: string[];
  citations: number;
  assumptions: number;
}

function checkResponse(c: EvalCase, r: GeneratedGroundedResponse): CaseResult {
  const failures: string[] = [];
  const chunkText = c.chunks.map((ch) => normalize(ch.content)).join(" \n ");
  const allowedContext = normalize(
    `${chunkText} ${c.question} ${JSON.stringify(ORG_INFO)}`
  );
  const assumptionText = normalize((r.assumptions ?? []).join(" \n "));

  // 1. Marker validity
  for (const m of r.text.matchAll(/\[#(\d+)\]/g)) {
    const n = parseInt(m[1], 10);
    if (n < 1 || n > c.chunks.length) {
      failures.push(`marker [#${n}] points at no supplied chunk (have ${c.chunks.length})`);
    }
  }

  // 2. Citation traceability
  for (const cit of r.citations ?? []) {
    const match = c.chunks.find(
      (ch) => ch.documentId === cit.documentId && ch.chunkIndex === cit.chunkIndex
    );
    if (!match) {
      failures.push(`citation to ${cit.documentName}#${cit.chunkIndex} maps to no supplied chunk`);
    } else if (cit.quote && !normalize(match.content).includes(normalize(cit.quote))) {
      failures.push(`citation quote not verbatim in source: "${cit.quote.slice(0, 60)}"`);
    }
  }

  // 3. Number grounding
  const numberHaystack = stripDigitCommas(allowedContext);
  const numberAssumptions = stripDigitCommas(assumptionText);
  for (const num of new Set(extractNumbers(r.text))) {
    if (!numberHaystack.includes(num) && !numberAssumptions.includes(num)) {
      failures.push(`number "${num}" appears in the draft but nowhere in the sources`);
    }
  }

  // 4. Entity grounding
  for (const entity of new Set(extractEntities(r.text))) {
    const needle = normalize(entity);
    if (!allowedContext.includes(needle) && !assumptionText.includes(needle)) {
      failures.push(`entity "${entity}" appears in the draft but nowhere in the sources`);
    }
  }

  // 5. Honest gaps
  if (c.expectAssumptions && (r.assumptions ?? []).length === 0) {
    failures.push("context is thin/irrelevant but no assumptions were surfaced");
  }

  return {
    id: c.id,
    pass: failures.length === 0,
    failures,
    citations: (r.citations ?? []).length,
    assumptions: (r.assumptions ?? []).length,
  };
}

// ---------------------------------------------------------------------------
// Dry-run: prove the checkers themselves work, no API calls
// ---------------------------------------------------------------------------

function dryRun(): number {
  const c = CASES[0];
  const clean: GeneratedGroundedResponse = {
    text:
      "Riverside Community Food Bank has served the region since 2009 [#1]. We provide meals to over 850 families each month across three counties [#1], distributing 410,000 pounds of food last fiscal year with support from 180 volunteers [#2]. Our annual budget is $1.2 million, with 72% directed to program services [#1].",
    citations: [
      { documentName: "impact-brief.docx", documentId: "doc-impact-brief.docx", chunkIndex: 0, quote: "over 850 families each month" },
      { documentName: "annual-report.pdf", documentId: "doc-annual-report.pdf", chunkIndex: 1, quote: "410,000 pounds of food" },
    ],
    assumptions: [],
  };
  const poisoned: GeneratedGroundedResponse = {
    text:
      "We serve families across Riverside, San Bernardino, and Orange counties [#1], reaching 850 families monthly with a $4.7 million budget [#1].",
    citations: [
      { documentName: "impact-brief.docx", documentId: "doc-impact-brief.docx", chunkIndex: 0, quote: "over 850 families each month" },
    ],
    assumptions: [],
  };

  const cleanResult = checkResponse(c, clean);
  const poisonedResult = checkResponse(c, poisoned);

  console.log("[dry-run] clean response  →", cleanResult.pass ? "PASS (expected)" : `FAIL: ${cleanResult.failures.join("; ")}`);
  console.log("[dry-run] poisoned response →", poisonedResult.pass ? "PASSED (checker is broken!)" : `caught ${poisonedResult.failures.length} fabrications (expected)`);
  for (const f of poisonedResult.failures) console.log(`           - ${f}`);

  const ok = cleanResult.pass && !poisonedResult.pass && poisonedResult.failures.length >= 2;
  console.log(ok ? "[dry-run] checker self-test PASSED" : "[dry-run] checker self-test FAILED");
  return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Live eval
// ---------------------------------------------------------------------------

interface Baseline {
  generatedAt: string;
  model: string;
  totalFailures: number;
  cases: Record<string, { pass: boolean; failures: string[] }>;
}

async function liveRun(updateBaseline: boolean): Promise<number> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.startsWith("sk-")) {
    console.error("[rag-eval] OPENAI_API_KEY missing or invalid — cannot run a live eval. Use --dry-run to test the checkers.");
    return 1;
  }

  const model = process.env.GRANTED_DEFAULT_MODEL || "gpt-4o-mini";
  console.log(`[rag-eval] Running ${CASES.length} cases against ${model} (≈$0.02–0.05)...`);

  const results: CaseResult[] = [];
  for (const c of CASES) {
    const response = await aiService.generateGroundedResponse({
      question: c.question,
      tone: "professional",
      organizationInfo: ORG_INFO,
      retrievedChunks: c.chunks,
    });
    const result = checkResponse(c, response);
    results.push(result);
    console.log(
      `  ${result.pass ? "✓" : "✗"} ${c.id}  (citations=${result.citations}, assumptions=${result.assumptions})`
    );
    for (const f of result.failures) console.log(`      - ${f}`);
  }

  const totalFailures = results.reduce((n, r) => n + r.failures.length, 0);
  const scorecard: Baseline = {
    generatedAt: new Date().toISOString(),
    model,
    totalFailures,
    cases: Object.fromEntries(results.map((r) => [r.id, { pass: r.pass, failures: r.failures }])),
  };

  console.log(`\n[rag-eval] ${results.filter((r) => r.pass).length}/${results.length} cases clean, ${totalFailures} total failures.`);

  if (updateBaseline || !existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(scorecard, null, 2) + "\n");
    console.log(`[rag-eval] Baseline written to ${BASELINE_PATH}${updateBaseline ? "" : " (first run)"}.`);
    return 0;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as Baseline;
  const regressions: string[] = [];
  for (const r of results) {
    const base = baseline.cases[r.id];
    if (base?.pass && !r.pass) {
      regressions.push(`${r.id}: passed in baseline, now fails (${r.failures.join("; ")})`);
    }
  }
  if (totalFailures > baseline.totalFailures) {
    regressions.push(`total failures rose ${baseline.totalFailures} → ${totalFailures}`);
  }

  if (regressions.length) {
    console.error("\n[rag-eval] REGRESSION vs. baseline:");
    for (const r of regressions) console.error(`  - ${r}`);
    console.error("[rag-eval] Fix the pipeline, or if the change is an intentional improvement, rerun with --update-baseline.");
    return 1;
  }

  console.log(`[rag-eval] No regression vs. baseline (${baseline.generatedAt}, ${baseline.model}).`);
  return 0;
}

async function main() {
  const args = process.argv.slice(2);
  const code = args.includes("--dry-run")
    ? dryRun()
    : await liveRun(args.includes("--update-baseline"));
  process.exit(code);
}

main().catch((err) => {
  console.error("[rag-eval] Unexpected error:", err);
  process.exit(1);
});
