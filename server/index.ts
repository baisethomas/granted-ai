// Load environment variables FIRST, before any other imports
import { config } from "dotenv";
config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { validateEnvironment } from "./config";
import { requestId } from "./middleware/requestId";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimit";
import { logger } from "./utils/logger";

const app = express();

// Request ID middleware (must be first)
app.use(requestId);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logData = {
        method: req.method,
        path,
        statusCode: res.statusCode,
        duration,
        requestId: req.id,
      };

      if (res.statusCode >= 400) {
        logger.warn('API Request', logData);
      } else {
        logger.info('API Request', logData);
      }
    }
  });

  next();
});

// Rate limiting (apply to all API routes except health check)
app.use("/api", apiLimiter);

(async () => {
  validateEnvironment();

  // sessions & auth
  setupAuth(app);

  const server = await registerRoutes(app);

  // Error handler middleware (must be last)
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
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
    log(`serving on port ${port}`);
  });
})();
