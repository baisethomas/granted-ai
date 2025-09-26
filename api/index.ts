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

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Grant Writing Platform API',
    status: 'working',
    timestamp: new Date().toISOString(),
    features: {
      auth: 'Supabase',
      uploads: 'enabled',
      cors: 'enabled'
    }
  });
});

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