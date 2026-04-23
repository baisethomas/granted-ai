/**
 * Client-side currency utilities. Re-exports the shared parsing and
 * formatting helpers and adds UI-specific helpers for the CurrencyInput.
 */

export {
  parseAmountToNumber,
  formatCurrencyDisplay,
  formatCurrencyCompact,
} from "@shared/currency";

/**
 * Normalize raw user input to a clean numeric string suitable for storage.
 * Keeps digits and at most one decimal point (with up to 2 decimals).
 */
export function parseCurrencyInput(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
    const [whole, dec = ""] = cleaned.split(".");
    cleaned = dec.length > 2 ? `${whole}.${dec.slice(0, 2)}` : cleaned;
  }
  return cleaned;
}

/**
 * Format a clean numeric input value (e.g. "150000", "150000.5", "150000.")
 * for in-progress display in the CurrencyInput. Preserves trailing
 * decimals so users can keep typing.
 */
export function formatCurrencyInputValue(clean: string): string {
  if (!clean) return "";
  const [whole, dec] = clean.split(".");
  const wholeNum = whole ? parseInt(whole, 10) : 0;
  const formattedWhole = Number.isFinite(wholeNum)
    ? wholeNum.toLocaleString("en-US")
    : "";
  if (clean.endsWith(".")) return `$${formattedWhole}.`;
  if (dec !== undefined) return `$${formattedWhole}.${dec}`;
  return `$${formattedWhole}`;
}
