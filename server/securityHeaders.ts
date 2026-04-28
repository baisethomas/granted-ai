import type { Express } from "express";
import helmet from "helmet";

/**
 * Baseline HTTP hardening for the Express API and the Vercel serverless entry.
 * CSP is disabled in development so Vite HMR / dev tooling keep working.
 */
export function setupSecurityHeaders(app: Express): void {
  const isDev = process.env.NODE_ENV === "development";

  app.use(
    helmet({
      contentSecurityPolicy: isDev
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "https:", "blob:"],
              fontSrc: ["'self'", "data:", "https:"],
              connectSrc: ["'self'", "https:", "wss:"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
            },
          },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts:
        process.env.NODE_ENV === "production"
          ? { maxAge: 15552000, includeSubDomains: true, preload: true }
          : false,
    }),
  );
}
