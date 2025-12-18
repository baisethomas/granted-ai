import type { Request, Response, NextFunction } from "express";

/**
 * CORS middleware that restricts origins to specific allowed domains
 * Configure via ALLOWED_ORIGINS environment variable (comma-separated)
 * Example: ALLOWED_ORIGINS=http://localhost:5173,https://granted.ai
 * 
 * In development, defaults to allowing localhost origins if not configured
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const isDevelopment = process.env.NODE_ENV === "development";

  // Parse allowed origins from environment variable
  let allowedOrigins: string[] = [];
  
  if (allowedOriginsEnv) {
    allowedOrigins = allowedOriginsEnv.split(",").map((origin) => origin.trim()).filter(Boolean);
  } else if (isDevelopment) {
    // In development, allow common localhost origins if not configured
    allowedOrigins = [
      "http://localhost:5000",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ];
  } else {
    // In production, if no origins configured, log warning but don't allow all
    console.warn(
      "[CORS] WARNING: ALLOWED_ORIGINS not configured in production. " +
      "Set ALLOWED_ORIGINS environment variable with comma-separated origins."
    );
    // Don't allow any origins if not configured in production
    allowedOrigins = [];
  }

  const origin = req.headers.origin;

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    if (origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,PATCH,OPTIONS");
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Content-Length, X-Requested-With, X-API-Key"
      );
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Max-Age", "86400"); // 24 hours
      return res.sendStatus(200);
    } else {
      return res.sendStatus(403);
    }
  }

  // Handle actual requests
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  } else if (origin && !allowedOrigins.includes(origin)) {
    // Log blocked origin attempts in production
    if (!isDevelopment) {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
    }
    return res.status(403).json({ error: "Origin not allowed" });
  }

  next();
}

