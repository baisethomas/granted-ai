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

// In-memory storage for data (temporary solution)
const documentsStore: Record<string, any[]> = {};
const projectsStore: Record<string, any[]> = {};
const questionsStore: Record<string, any[]> = {};
const settingsStore: Record<string, any> = {};

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
  console.log('Auth middleware called for:', req.method, req.path);
  console.log('Authorization header:', req.headers.authorization ? 'Present' : 'Missing');

  getAuthenticatedUser(req)
    .then(user => {
      if (!user) {
        console.log('Authentication failed - no user found');
        return res.status(401).json({
          error: "Authentication required",
          hint: "Include 'Authorization: Bearer <token>' header with Supabase token"
        });
      }
      console.log('Authentication successful for user:', user.id);
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
    console.log('Upload request received:', {
      hasFile: !!req.file,
      user: (req as any).user?.id,
      category: req.body.category
    });

    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: "No file uploaded" });
    }

    const user = (req as any).user;
    const { originalname, mimetype, size } = req.file;
    const category = req.body.category || "organization-info";

    console.log('Processing file:', { originalname, mimetype, size, category });

    // Simple file processing (no external AI service for now)
    const summary = `Uploaded ${originalname} (${mimetype}, ${Math.round(size/1024)}KB) in category: ${category}`;

    const document = {
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
    };

    // Store document in memory
    if (!documentsStore[user.id]) {
      documentsStore[user.id] = [];
    }
    documentsStore[user.id].push(document);

    console.log('Document stored successfully:', document.id);
    console.log('Total documents for user:', documentsStore[user.id].length);

    res.json(document);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// Documents list (protected route)
app.get("/api/documents", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const userDocuments = documentsStore[user.id] || [];

    console.log('Documents list request for user:', user.id);
    console.log('Total documents in store for user:', userDocuments.length);
    console.log('Document IDs:', userDocuments.map(d => d.id));

    res.json(userDocuments);
  } catch (error) {
    console.error('Documents list error:', error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Delete document (protected route)
app.delete("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const documentId = req.params.id;

    if (!documentsStore[user.id]) {
      return res.status(404).json({ error: "Document not found" });
    }

    const documentIndex = documentsStore[user.id].findIndex(doc => doc.id === documentId);
    if (documentIndex === -1) {
      return res.status(404).json({ error: "Document not found" });
    }

    documentsStore[user.id].splice(documentIndex, 1);
    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Projects endpoints
app.get("/api/projects", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const userProjects = projectsStore[user.id] || [];
    res.json(userProjects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.post("/api/projects", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const project = {
      id: `project-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: user.id
    };

    if (!projectsStore[user.id]) {
      projectsStore[user.id] = [];
    }
    projectsStore[user.id].push(project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Settings endpoints
app.get("/api/settings", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const userSettings = settingsStore[user.id] || {
      id: `settings-${user.id}`,
      userId: user.id,
      defaultTone: "professional",
      lengthPreference: "medium",
      emphasisAreas: [],
      aiModel: "gpt-4",
      fallbackModel: "gpt-3.5-turbo",
      creativity: 0.7,
      contextUsage: 0.8,
      emailNotifications: true,
      autoSave: true,
      analytics: true,
      autoDetection: true,
      updatedAt: new Date().toISOString()
    };
    res.json(userSettings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.put("/api/settings", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const updatedSettings = {
      ...settingsStore[user.id],
      ...req.body,
      userId: user.id,
      updatedAt: new Date().toISOString()
    };

    settingsStore[user.id] = updatedSettings;
    res.json(updatedSettings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Questions endpoints
app.get("/api/projects/:projectId/questions", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const projectId = req.params.projectId;
    const userQuestions = questionsStore[user.id] || [];
    const projectQuestions = userQuestions.filter(q => q.projectId === projectId);
    res.json(projectQuestions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch questions" });
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

// Root route - redirect to API status since frontend is handled by Vercel static
app.get('/', (req, res) => {
  res.redirect('/api/status');
});

// API catch-all for unknown API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    available_endpoints: {
      auth: '/api/auth/me',
      upload: '/api/documents/upload',
      documents: '/api/documents',
      status: '/api/status',
      health: '/health'
    }
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