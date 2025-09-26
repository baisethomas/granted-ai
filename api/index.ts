// Vercel serverless function with hybrid Supabase/Express auth
import { config } from "dotenv";
config();

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, getUserId } from "../server/hybrid-auth";
import { fileProcessor } from "../server/services/fileProcessor";

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure multer for file uploads (in-memory for serverless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// CORS for Vercel deployment
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    auth: 'hybrid (Supabase + Express)'
  });
});

// Auth status endpoint
app.get('/api/auth/me', async (req, res) => {
  try {
    const { getAuthenticatedUser } = await import("../server/hybrid-auth");
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.json(null);
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      organizationName: user.organizationName,
      auth_type: user.auth_type
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

// Document upload (protected route)
app.post("/api/documents/upload", requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = getUserId(req);
    const { originalname, mimetype, size } = req.file;
    const category = req.body.category || "organization-info";

    // Process the file using the buffer from multer
    const processed = await fileProcessor.processFile(req.file.buffer, originalname, mimetype);

    // For now, return the processed result without database storage
    // In a full implementation, you'd store in Supabase
    res.json({
      id: `temp-${Date.now()}`,
      filename: originalname,
      originalName: originalname,
      fileType: mimetype,
      fileSize: size,
      category,
      summary: processed.summary,
      processed: true,
      uploadedAt: new Date().toISOString(),
      userId,
      note: "File processed successfully (in-memory for demo)"
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// Documents list (protected route)
app.get("/api/documents", requireAuth, async (req, res) => {
  try {
    // For demo purposes, return empty array
    // In full implementation, fetch from Supabase
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// API status
app.get('/api/status', (req, res) => {
  res.json({
    api: 'online',
    features: {
      auth: 'hybrid (Supabase + Express)',
      uploads: 'enabled with Supabase auth',
      static_files: 'enabled',
      database: 'demo mode (no persistence)'
    },
    instructions: {
      frontend: 'Use Supabase auth for authentication',
      api: 'Include Authorization: Bearer <token> header'
    }
  });
});

// Serve static files for SPA
app.use(express.static('/var/task/dist/public'));

// Catch-all for SPA routing
app.get('*', (req, res) => {
  try {
    res.sendFile('/var/task/dist/public/index.html');
  } catch {
    res.status(404).json({
      error: 'Page not found',
      path: req.path,
      suggestion: 'Visit /api/status for API information'
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