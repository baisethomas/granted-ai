import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import crypto from "crypto";

type RateLimitedRequest = Request & {
  rateLimit?: {
    resetTime?: Date;
  };
};

function getRetryAfter(req: Request, fallbackMs: number): number {
  const resetTime = (req as RateLimitedRequest).rateLimit?.resetTime?.getTime();
  const retryAt = resetTime ?? Date.now() + fallbackMs;
  return Math.ceil((retryAt - Date.now()) / 1000);
}

/**
 * Rate-limit key generator that prefers a stable per-token bucket when an
 * Authorization bearer is present, and falls back to the (now-trustworthy
 * because of `app.set('trust proxy')`) client IP otherwise.
 *
 * We hash the token rather than using it directly so an attacker who can
 * read rate-limiter telemetry can't recover a session JWT, and we slice
 * the digest so stored memory stays small.
 *
 * `ipKeyGenerator` is the IPv6-safe normalizer recommended by the
 * `express-rate-limit` v7 docs.
 */
function tokenOrIpKeyGenerator(req: Request): string {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      const digest = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")
        .slice(0, 16);
      return `tok:${digest}`;
    }
  }
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

/**
 * Rate limiting middleware to prevent API abuse
 * Configurable via environment variables:
 * - RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 15 minutes)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 100)
 */
export const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10), // 100 requests per window
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: tokenOrIpKeyGenerator,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Too many requests from this IP, please try again later.",
      retryAfter: getRetryAfter(req, 900000),
    });
  },
});

/**
 * Stricter rate limiter for authentication endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes default
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || "5", 10), // 5 attempts per window
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth attempts
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Too many authentication attempts, please try again later.",
      retryAfter: getRetryAfter(req, 900000),
    });
  },
});

/**
 * Rate limiter for file upload endpoints
 */
export const uploadRateLimiter = rateLimit({
  windowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || "3600000", 10), // 1 hour default
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX_REQUESTS || "10", 10), // 10 uploads per hour
  message: {
    error: "Too many file uploads, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: tokenOrIpKeyGenerator,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Too many file uploads, please try again later.",
      retryAfter: getRetryAfter(req, 3600000),
    });
  },
});

/**
 * Stricter limiter for worker / cron endpoints that authenticate via a
 * shared secret. These should never be hit by an interactive user, so
 * the budget is intentionally tight to slow down brute-force attempts
 * against the secret. Vercel's own cron scheduler hits each path on a
 * fixed cadence and stays well inside the cap.
 */
export const workerRateLimiter = rateLimit({
  windowMs: parseInt(process.env.WORKER_RATE_LIMIT_WINDOW_MS || "60000", 10), // 1 minute
  max: parseInt(process.env.WORKER_RATE_LIMIT_MAX_REQUESTS || "10", 10), // 10 / minute
  message: {
    error: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Always use IP for worker/cron — these endpoints don't carry user JWTs.
  keyGenerator: (req: Request) => `ip:${ipKeyGenerator(req.ip ?? "")}`,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Too many requests, please try again later.",
      retryAfter: getRetryAfter(req, 60000),
    });
  },
});
