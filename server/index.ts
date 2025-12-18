// Load environment variables FIRST, before any other imports
import { config } from "dotenv";
config(); // This must run before any other code that reads process.env

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { validateEnvironment } from "./config";
import { corsMiddleware } from "./middleware/cors";
import { apiRateLimiter, authRateLimiter, uploadRateLimiter } from "./middleware/rateLimiter";

const app = express();

// CORS middleware - must come early to handle preflight requests
app.use(corsMiddleware);

// Request body size limits - prevent memory exhaustion from large payloads
// JSON body limit: 1MB (configurable via REQUEST_BODY_LIMIT env var)
const jsonBodyLimit = process.env.REQUEST_BODY_LIMIT || "1mb";
app.use(express.json({ limit: jsonBodyLimit }));
// URL-encoded body limit: 10MB (for file uploads via form data)
const urlEncodedLimit = process.env.REQUEST_URLENCODED_LIMIT || "10mb";
app.use(express.urlencoded({ extended: false, limit: urlEncodedLimit }));

// Rate limiting - apply to all API routes
app.use("/api", apiRateLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const startTime = Date.now();
  log("Starting server initialization...");
  
  // Add error handler for uncaught errors
  process.on('unhandledRejection', (error) => {
    console.error('[FATAL] Unhandled rejection:', error);
    process.exit(1);
  });
  
  process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught exception:', error);
    process.exit(1);
  });
  
  try {
  
  const envStart = Date.now();
  validateEnvironment();
  log(`Environment validated in ${Date.now() - envStart}ms`);

  // sessions & auth
  const authStart = Date.now();
  await setupAuth(app);
  log(`Auth setup completed in ${Date.now() - authStart}ms`);

  const routesStart = Date.now();
  const server = await registerRoutes(app);
  log(`Routes registered in ${Date.now() - routesStart}ms`);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const viteStart = Date.now();
    log("Setting up Vite dev server...");
    await setupVite(app, server);
    log(`Vite setup completed in ${Date.now() - viteStart}ms`);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const listenOptions: {
    port: number;
    host: string;
    // reusePort is not supported on all platforms; enable only when explicitly requested
    reusePort?: boolean;
  } = {
    port,
    host: "0.0.0.0",
  };

  if (process.env.REUSE_PORT === '1') {
    listenOptions.reusePort = true;
  }

    server.listen(listenOptions, () => {
      const totalTime = Date.now() - startTime;
      log(`serving on port ${port} (startup took ${totalTime}ms)`);
    });
  } catch (error) {
    console.error('[FATAL] Error during server startup:', error);
    process.exit(1);
  }
})();
