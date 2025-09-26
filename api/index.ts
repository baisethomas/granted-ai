// Working Vercel serverless function without problematic auth
import { config } from "dotenv";
config();

import express from "express";

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from dist/public if they exist
import { serveStatic } from "../server/vite";
if (process.env.NODE_ENV === "production") {
  try {
    serveStatic(app);
  } catch (error) {
    console.log("Static files not available:", error);
  }
}

// Basic routes
app.get('/', (req, res) => {
  res.json({
    message: 'Grant Writing Platform API',
    status: 'working',
    timestamp: new Date().toISOString(),
    note: 'Auth disabled for Vercel compatibility - full app runs on port 3001'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API status
app.get('/api/status', (req, res) => {
  res.json({
    api: 'online',
    features: {
      auth: 'disabled (serverless limitation)',
      uploads: 'disabled (requires auth)',
      static_files: 'enabled'
    },
    recommendation: 'Use local development server (npm run dev) for full functionality'
  });
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  // Try to serve index.html for client-side routing
  try {
    res.sendFile('/var/task/dist/public/index.html');
  } catch {
    res.status(404).json({
      error: 'Page not found',
      path: req.path,
      suggestion: 'This may be a client-side route. Visit / for the main app.'
    });
  }
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message
  });
});

export default app;