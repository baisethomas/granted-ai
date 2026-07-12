// Vercel serverless entry point for the full Express backend.
// Delegates to server/routes.ts so the production API stays in lockstep with
// the dev server instead of drifting against an inline route list.

import { config as loadDotenv } from "dotenv";
loadDotenv();

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { registerRoutes } from "../server/routes.js";
import { setupAuth } from "../server/auth.js";
import { corsMiddleware } from "../server/middleware/cors.js";
import { apiRateLimiter } from "../server/middleware/rateLimiter.js";
import { setupSecurityHeaders } from "../server/securityHeaders.js";

let cachedApp: Express | null = null;
let initPromise: Promise<Express> | null = null;

export async function createApp(): Promise<Express> {
  const app = express();

  // Trust Vercel's edge proxy so `req.ip` is the real client address.
  // Without this, `express-rate-limit` keys every request to the proxy IP
  // and effectively does nothing in production.
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS) || 1);

  setupSecurityHeaders(app);

  app.use(corsMiddleware);

  // Stripe webhook signature verification needs the exact raw request
  // bytes, so this must be mounted (scoped to the webhook path) before the
  // global JSON parser below — otherwise express.json() consumes the body
  // and stripe.webhooks.constructEvent() fails signature verification on
  // every request. Mirrors server/index.ts (the local dev entry); this file
  // is the Vercel production entry, which previously lacked this carve-out
  // (GRA-66).
  const jsonBodyLimit = process.env.REQUEST_BODY_LIMIT || "1mb";
  app.use(
    "/api/billing/webhook",
    express.raw({ type: "application/json", limit: jsonBodyLimit }),
  );
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(
    express.urlencoded({
      extended: false,
      limit: process.env.REQUEST_URLENCODED_LIMIT || "10mb",
    }),
  );

  app.use("/api", apiRateLimiter);

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api")) {
        const duration = Date.now() - start;
        console.log(
          `[api] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`,
        );
      }
    });
    next();
  });

  await setupAuth(app);
  await registerRoutes(app);

  app.use(
    (err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("[api] Unhandled error:", err);
      const status = err.status || err.statusCode || 500;
      res
        .status(status)
        .json({ message: err.message || "Internal Server Error" });
    },
  );

  return app;
}

async function getApp(): Promise<Express> {
  if (cachedApp) return cachedApp;
  if (!initPromise) {
    initPromise = createApp()
      .then((app) => {
        cachedApp = app;
        return app;
      })
      .catch((error) => {
        initPromise = null;
        throw error;
      });
  }
  return initPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error: any) {
    console.error("[api] Failed to initialize app:", error);
    res
      .status(500)
      .json({
        error: "Server initialization failed",
        message: error?.message || "Unknown error",
      });
  }
}
