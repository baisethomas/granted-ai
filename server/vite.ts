import express, { type Express } from "express";
import fs from "fs";
import path from "path";
// Lazy import vite to avoid blocking startup - vite is a large package
// import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import { nanoid } from "nanoid";

// Lazy load vite logger - will be initialized in setupVite
let viteLogger: any = null;
function getViteLogger() {
  if (!viteLogger) {
    throw new Error("Vite logger not initialized - call setupVite first");
  }
  return viteLogger;
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  log("Loading Vite package (lazy)...");
  const viteLoadStart = Date.now();
  // Lazy import vite - it's a large package and can slow down startup
  const viteModule = await import("vite");
  const { createServer: createViteServer, createLogger } = viteModule;
  viteLogger = createLogger();
  log(`Vite package loaded in ${Date.now() - viteLoadStart}ms`);
  
  log("Loading Vite config...");
  const configStart = Date.now();
  // Import config synchronously - it's now a simple object, not async
  const viteConfigModule = await import("../vite.config.js");
  const viteConfig = viteConfigModule.default;
  log(`Vite config loaded in ${Date.now() - configStart}ms`);
  
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  log("Creating Vite server instance...");
  const viteStart = Date.now();
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...getViteLogger(),
      error: (msg, options) => {
        getViteLogger().error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });
  log(`Vite server created in ${Date.now() - viteStart}ms (total config + server: ${Date.now() - configStart}ms)`);

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
