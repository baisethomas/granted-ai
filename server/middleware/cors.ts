import type { Request, Response, NextFunction } from "express";

// Fire the "ALLOWED_ORIGINS missing" warning at most once per process
// instead of on every single request (which spams Vercel logs).
let warnedMissingAllowedOrigins = false;

/**
 * CORS middleware that restricts origins to specific allowed domains
 * Configure via ALLOWED_ORIGINS environment variable (comma-separated)
 * Example: ALLOWED_ORIGINS=http://localhost:5173,https://granted.ai
 *
 * Same-origin requests (frontend and API on the same Vercel deployment) are
 * always allowed regardless of ALLOWED_ORIGINS.
 *
 * In development, defaults to allowing common localhost origins if not configured.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const isDevelopment = process.env.NODE_ENV === "development";

  // Parse allowed origins from environment variable
  let allowedOrigins: string[];

  if (allowedOriginsEnv) {
    allowedOrigins = allowedOriginsEnv.split(",").map((origin) => origin.trim()).filter(Boolean);
  } else if (isDevelopment) {
    allowedOrigins = [
      "http://localhost:5000",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ];
  } else {
    if (!warnedMissingAllowedOrigins) {
      warnedMissingAllowedOrigins = true;
      console.warn(
        "[CORS] ALLOWED_ORIGINS not configured in production. " +
        "Set ALLOWED_ORIGINS with comma-separated origins. " +
        "Same-origin requests will continue to be allowed."
      );
    }
    allowedOrigins = [];
  }

  const origin = req.headers.origin;

  // Same-origin requests are always safe regardless of ALLOWED_ORIGINS
  // (frontend and API on the same deployment).
  const host = req.headers.host;
  const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined) || host;
  const forwardedProto =
    (req.headers["x-forwarded-proto"] as string | undefined) ||
    (req.secure ? "https" : "http");
  const sameOriginCandidates = new Set<string>();
  if (host) {
    sameOriginCandidates.add(`http://${host}`);
    sameOriginCandidates.add(`https://${host}`);
  }
  if (forwardedHost) {
    sameOriginCandidates.add(`${forwardedProto}://${forwardedHost}`);
    sameOriginCandidates.add(`http://${forwardedHost}`);
    sameOriginCandidates.add(`https://${forwardedHost}`);
  }
  const isSameOrigin = !!origin && sameOriginCandidates.has(origin);

  const isAllowed = !!origin && (isSameOrigin || allowedOrigins.includes(origin));

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    if (isAllowed) {
      res.header("Access-Control-Allow-Origin", origin!);
      res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,PATCH,OPTIONS");
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Content-Length, X-Requested-With, X-API-Key"
      );
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Max-Age", "86400"); // 24 hours
      return res.sendStatus(200);
    }
    return res.sendStatus(403);
  }

  // Handle actual requests
  if (isAllowed) {
    res.header("Access-Control-Allow-Origin", origin!);
    res.header("Access-Control-Allow-Credentials", "true");
  } else if (origin) {
    if (!isDevelopment) {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
    }
    return res.status(403).json({ error: "Origin not allowed" });
  }

  next();
}

