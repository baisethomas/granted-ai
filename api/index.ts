// Working Vercel deployment with inline Supabase auth
import { config } from "dotenv";
config();

import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ieicdrcpckcjgcgfylaj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaWNkcmNwY2tjamdjZ2Z5bGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDAzODQsImV4cCI6MjA3MDM3NjM4NH0.5mgWjDuVk4-udmSC23TocxZjlXooF4ciWRRTAIdF2mo';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Inline auth helper (no external dependencies)
async function getAuthenticatedUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        return {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          organizationName: user.user_metadata?.organizationName,
        };
      }
    } catch (error) {
      console.log('Supabase auth failed:', error);
    }
  }
  return null;
}

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  getAuthenticatedUser(req)
    .then(user => {
      if (!user) {
        return res.status(401).json({
          error: "Authentication required",
          hint: "Include 'Authorization: Bearer <token>' header with Supabase token"
        });
      }
      (req as any).user = user;
      next();
    })
    .catch(error => {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: "Authentication error" });
    });
}

// API Routes first (specific routes before catch-all)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    auth: 'Supabase ready'
  });
});

// Auth status endpoint
app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.json(null);
    }
    res.json(user);
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

    const user = (req as any).user;
    const { originalname, mimetype, size } = req.file;
    const category = req.body.category || "organization-info";

    // Simple file processing (no external AI service for now)
    const summary = `Uploaded ${originalname} (${mimetype}, ${Math.round(size/1024)}KB) in category: ${category}`;

    res.json({
      id: `upload-${Date.now()}`,
      filename: originalname,
      originalName: originalname,
      fileType: mimetype,
      fileSize: size,
      category,
      summary,
      processed: true,
      uploadedAt: new Date().toISOString(),
      userId: user.id,
      note: "File uploaded successfully (Vercel demo mode)"
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// Documents list (protected route)
app.get("/api/documents", requireAuth, async (req, res) => {
  try {
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
      auth: 'Supabase JWT',
      uploads: 'enabled (in-memory processing)',
      cors: 'enabled',
      database: 'demo mode'
    },
    instructions: {
      auth: 'Login with Supabase, include Authorization: Bearer <token> header',
      upload: 'POST /api/documents/upload with file and category'
    }
  });
});

// Serve static files for SPA - try multiple possible locations
import path from "path";
import fs from "fs";

// Root route - check for frontend files
app.get('/', (req, res) => {
  // List what files are actually available
  const debugInfo: any = {
    message: 'Grant Writing Platform API - Frontend Debug',
    timestamp: new Date().toISOString(),
    directories_checked: [],
    files_found: []
  };

  // Check multiple possible locations for index.html
  const possiblePaths = [
    '/var/task/dist/public/index.html',
    '/var/task/dist/public',
    '/tmp/dist/public/index.html',
    path.join(process.cwd(), 'dist/public/index.html'),
    path.join(__dirname, '../dist/public/index.html')
  ];

  for (const checkPath of possiblePaths) {
    try {
      debugInfo.directories_checked.push(checkPath);
      if (fs.existsSync(checkPath)) {
        debugInfo.files_found.push(checkPath);
        if (checkPath.endsWith('index.html')) {
          console.log('Found index.html at:', checkPath);
          return res.sendFile(checkPath);
        }
      }
    } catch (error) {
      debugInfo.directories_checked.push(`${checkPath} (error: ${error})`);
    }
  }

  // List actual directory contents to debug
  try {
    const taskContents = fs.readdirSync('/var/task');
    debugInfo.var_task_contents = taskContents;
  } catch (error) {
    debugInfo.var_task_error = String(error);
  }

  // If no frontend found, show debug info
  debugInfo.status = 'Frontend files not found';
  debugInfo.api_endpoints = {
    auth: '/api/auth/me',
    upload: '/api/documents/upload',
    status: '/api/status'
  };
  debugInfo.suggestion = 'Frontend build may not be included in deployment';

  res.json(debugInfo);
});

// Static file serving for assets
app.get('/*.(js|css|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)', (req, res) => {
  const filePath = `/var/task/dist/public${req.path}`;
  try {
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Static file not found', path: req.path });
    }
  } catch {
    res.status(404).json({ error: 'Static file error', path: req.path });
  }
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  // For non-API routes, try to serve index.html
  if (!req.path.startsWith('/api/')) {
    const possiblePaths = [
      '/var/task/dist/public/index.html',
      '/tmp/dist/public/index.html',
      path.join(process.cwd(), 'dist/public/index.html')
    ];

    for (const htmlPath of possiblePaths) {
      try {
        if (fs.existsSync(htmlPath)) {
          return res.sendFile(htmlPath);
        }
      } catch (error) {
        // Continue to next path
      }
    }
  }

  res.status(404).json({
    error: 'Page not found',
    path: req.path,
    note: 'Frontend files not available - API only deployment',
    suggestion: 'Visit /api/status for API information'
  });
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