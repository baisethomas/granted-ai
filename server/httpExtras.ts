/** True when responses must not leak stack / exception strings to clients. */
export const isProductionApi = process.env.NODE_ENV === "production";

/**
 * Merge `details` / `message` from a caught error into a JSON payload only
 * outside production (or when explicitly requested for local debugging).
 */
export function mergeDevErrorDetails(
  payload: Record<string, unknown>,
  error: unknown,
): Record<string, unknown> {
  if (isProductionApi) return payload;
  if (error instanceof Error) {
    return { ...payload, details: error.message };
  }
  return { ...payload, details: String(error) };
}

/**
 * Same as mergeDevErrorDetails but for arbitrary `details` (e.g. Zod issue
 * arrays). Omitted entirely in production.
 */
export function mergeDevDetails<T>(payload: Record<string, unknown>, details: T): Record<string, unknown> {
  if (isProductionApi) return payload;
  return { ...payload, details };
}
