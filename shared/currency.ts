/**
 * Shared currency utilities used by both the client and server.
 *
 * The `projects.amount` field is stored as text to support legacy
 * values. New values are stored as clean numeric strings
 * (e.g. "150000" or "150000.50"), but these helpers also accept
 * legacy formatted strings like "$150,000" and shorthand like "1.2M".
 */

/**
 * Parse any stored amount string (clean numeric, "$150,000", "1.2M", etc.)
 * to a number. Returns 0 for empty or invalid input.
 */
export function parseAmountToNumber(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const text = String(raw).trim();
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.kKmMbB]/g, "");
  if (!cleaned) return 0;
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)([kKmMbB]?)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return 0;
  const suffix = match[2].toLowerCase();
  const multiplier =
    suffix === "k"
      ? 1_000
      : suffix === "m"
        ? 1_000_000
        : suffix === "b"
          ? 1_000_000_000
          : 1;
  return num * multiplier;
}

/**
 * Format a dollar amount for display with full precision
 * (e.g. "$150,000" or "$1,250.50"). Returns "" for empty/invalid values.
 */
export function formatCurrencyDisplay(
  raw: string | number | null | undefined,
): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const value = typeof raw === "number" ? raw : parseAmountToNumber(raw);
  if (!Number.isFinite(value) || value <= 0) return "";
  const hasCents = value % 1 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value);
}

/**
 * Compact currency format for dashboard stats (e.g. "$1.2M", "$150K").
 * Uses K/M/B suffixes for readability at a glance.
 */
export function formatCurrencyCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000) {
    const n = value / 1_000_000_000;
    return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    const n = value / 1_000_000;
    return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}M`;
  }
  if (value >= 10_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
