const DEFAULT_PDF_PARSE_MS = 45_000;

if (!(Promise as unknown as { try?: unknown }).try) {
  (Promise as unknown as { try: <T>(fn: () => T | PromiseLike<T>) => Promise<T> }).try = (fn) =>
    Promise.resolve().then(fn);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/**
 * Extract plain text from a PDF buffer using unpdf (PDF.js server build).
 * Hard-timeout guards against malicious PDFs that hang the worker.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const ms = Number(process.env.PDF_PARSE_TIMEOUT_MS) || DEFAULT_PDF_PARSE_MS;
  const { extractText } = await import("unpdf");
  const data = new Uint8Array(buffer);
  const result = await withTimeout(
    extractText(data, { mergePages: true }),
    ms,
    "PDF extraction",
  );
  return result.text;
}
