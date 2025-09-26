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

// Supabase database operations (inline to avoid import issues)
const dbSupabase = createClient(supabaseUrl, supabaseAnonKey);

const db = {
  documents: {
    async insert(data: any) {
      try {
        const result = await dbSupabase.from('documents').insert(data).select().single();
        console.log('Database insert result:', result);
        return result;
      } catch (error) {
        console.error('Database insert error:', error);
        return { error };
      }
    },
    async findByUserId(userId: string) {
      try {
        const result = await dbSupabase.from('documents').select('*').eq('user_id', userId);
        console.log('Database query result:', result);
        return result;
      } catch (error) {
        console.error('Database query error:', error);
        return { error };
      }
    },
    async deleteById(id: string, userId: string) {
      try {
        const result = await dbSupabase.from('documents').delete().eq('id', id).eq('user_id', userId);
        console.log('Database delete result:', result);
        return result;
      } catch (error) {
        console.error('Database delete error:', error);
        return { error };
      }
    }
  }
};

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

      // Also store the token for database operations
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        (req as any).authToken = authHeader.substring(7);
      }

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

    const documentData = {
      filename: originalname,
      original_name: originalname,
      file_type: mimetype,
      file_size: size,
      category,
      summary,
      processed: true,
      user_id: user.id,
      // Default organization_id - in real app this would come from user's org
      organization_id: user.id // Using user.id as org for now
    };

    console.log('Inserting document into database:', documentData);

    // Store document in Supabase
    const result = await db.documents.insert(documentData);

    if (result.error) {
      console.error('Database insert error:', result.error);
      return res.status(500).json({
        error: "Failed to save document to database",
        details: result.error.message || result.error
      });
    }

    const document = result.data;
    console.log('Document stored successfully:', document.id);

    // Return document in frontend-expected format
    res.json({
      id: document.id,
      filename: document.filename,
      originalName: document.original_name,
      fileType: document.file_type,
      fileSize: document.file_size,
      category: document.category,
      summary: document.summary,
      processed: document.processed,
      uploadedAt: document.uploaded_at,
      userId: document.user_id
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// Documents list (protected route)
app.get("/api/documents", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    console.log('Documents list request for user:', user.id);

    // Fetch documents from Supabase
    const result = await db.documents.findByUserId(user.id);

    if (result.error) {
      console.error('Database query error:', result.error);
      return res.status(500).json({
        error: "Failed to fetch documents from database",
        details: result.error.message || result.error
      });
    }

    const documents = result.data || [];
    console.log('Total documents from database:', documents.length);
    console.log('Document IDs:', documents.map((d: any) => d.id));

    // Transform to frontend format
    const transformedDocs = documents.map((doc: any) => ({
      id: doc.id,
      filename: doc.filename,
      originalName: doc.original_name,
      fileType: doc.file_type,
      fileSize: doc.file_size,
      category: doc.category,
      summary: doc.summary,
      processed: doc.processed,
      uploadedAt: doc.uploaded_at,
      userId: doc.user_id
    }));

    res.json(transformedDocs);
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

    console.log('Deleting document:', documentId, 'for user:', user.id);

    // Delete from Supabase
    const result = await db.documents.deleteById(documentId, user.id);

    if (result.error) {
      console.error('Database delete error:', result.error);
      return res.status(500).json({ error: "Failed to delete document from database" });
    }

    console.log('Document deleted successfully');
    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Projects endpoints (simplified to avoid 500 errors)
app.get("/api/projects", requireAuth, async (req, res) => {
  try {
    // Return empty array for now
    res.json([]);
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
      user_id: user.id,
      status: req.body.status || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Settings endpoints (simplified for now)
app.get("/api/settings", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const defaultSettings = {
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
    res.json(defaultSettings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.put("/api/settings", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    // Just return the sent settings for now
    const updatedSettings = {
      ...req.body,
      userId: user.id,
      updatedAt: new Date().toISOString()
    };
    res.json(updatedSettings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Questions endpoints (simplified)
app.get("/api/projects/:projectId/questions", requireAuth, async (req, res) => {
  try {
    // Return empty array for now
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

// Stats endpoint (added to fix 500 error)
app.get("/api/stats", requireAuth, async (req, res) => {
  try {
    const defaultStats = {
      activeProjects: 0,
      successRate: "0%",
      totalAwarded: "$0",
      dueThisWeek: 0
    };
    res.json(defaultStats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
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