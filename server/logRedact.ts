/**
 * Strip high-sensitivity token material from strings before logging.
 * Not a cryptographic guarantee — only shrinks accidental log exfiltration.
 */
export function redactForLog(input: string): string {
  return input
    .replace(/\bBearer\s+[\w.~+/-]+\b/gi, "Bearer <redacted>")
    .replace(/\beyJ[\w-]*\.[\w-]*\.[\w-]*/g, "eyJ…<jwt>")
    .replace(/\bsk_live_[a-zA-Z0-9]{10,}\b/g, "sk_live_<redacted>")
    .replace(/\bsk-[a-zA-Z0-9]{10,}\b/g, "sk-<redacted>");
}

export const verboseHttpLogs = (): boolean =>
  process.env.DEBUG_VERBOSE_HTTP === "1";
