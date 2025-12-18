import { config } from "dotenv";
config();

import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const app = express();

// Initialize Supabase clients (inline to avoid import issues)
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const supabaseAdminClient =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// Initialize OpenAI client
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
console.log('[api/simple] Environment check:', {
  hasOpenAIKey: !!openaiApiKey,
  keyPrefix: openaiApiKey?.substring(0, 7),
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseServiceRoleKey,
  grantedProvider: process.env.GRANTED_DEFAULT_PROVIDER
});

const openai = openaiApiKey && openaiApiKey.startsWith("sk-")
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

// Inline auth middleware
function requireSupabaseUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method === "OPTIONS") {
    return next();
  }

  if (!supabaseAdminClient) {
    console.error("[api/simple] Supabase configuration missing:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceRoleKey,
      envVars: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_PROJECT_URL: !!process.env.SUPABASE_PROJECT_URL,
        VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
        SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY,
      }
    });
    return res.status(500).json({ 
      error: "Server authentication is not configured",
      message: "Please configure Supabase environment variables in Vercel: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
    });
  }

  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  supabaseAdminClient.auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      (req as any).supabaseUser = data.user;
      return next();
    })
    .catch((error) => {
      console.error("Supabase auth verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    });
}

function getUserId(req: any): string {
  if (!req.supabaseUser || !req.supabaseUser.id) {
    throw new Error("User not authenticated");
  }
  return req.supabaseUser.id;
}

// Database client for Supabase operations
const supabaseDB = supabaseAdminClient; // Use admin client for database operations

// Helper: Create user record if it doesn't exist
async function ensureUserExists(userId: string, email: string) {
  if (!supabaseDB) return;

  const { data: existing } = await supabaseDB
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (!existing) {
    // Create user
    await supabaseDB.from('users').insert({
      id: userId,
      email,
      username: email.split('@')[0] || 'user'
    });

    // Create default organization for user
    await supabaseDB.from('organizations').insert({
      id: userId, // Use same ID as user for simplicity
      name: `${email.split('@')[0]}'s Organization`,
      plan: 'starter'
    });
  }
}

// Basic middleware
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// File upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Upload endpoint
app.post("/api/documents/upload", requireSupabaseUser, upload.single('file'), async (req: any, res) => {
  console.log('Simple upload received');

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (!supabaseDB) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    const userId = getUserId(req);

    const { data: document, error } = await supabaseDB
      .from('documents')
      .insert({
        user_id: userId,
        organization_id: userId,
        filename: req.file.originalname,
        original_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        category: req.body.category || "organization-info",
        summary: `Uploaded ${req.file.originalname}`,
        processed: true,
        processing_status: 'complete'
      })
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return res.status(500).json({ error: "Failed to save document" });
    }

    console.log('Document stored in database:', document.id);
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
    console.error('Upload error:', error);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// List documents
app.get("/api/documents", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);

    const { data: documents, error } = await supabaseDB
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ error: "Failed to fetch documents" });
    }

    console.log('Documents list requested. Count:', documents?.length || 0);

    const formatted = (documents || []).map((doc: any) => ({
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

    res.json(formatted);
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Delete document
app.delete("/api/documents/:id", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);
    const id = req.params.id;

    const { error } = await supabaseDB
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Database delete error:', error);
      return res.status(404).json({ error: "Document not found" });
    }

    console.log('Document deleted:', id);
    res.json({ message: "Document deleted" });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Projects endpoints
app.get("/api/projects", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);

    const { data: projects, error } = await supabaseDB
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ error: "Failed to fetch projects" });
    }

    console.log('Projects list requested. Count:', projects?.length || 0);
    res.json(projects || []);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.post("/api/projects", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);
    console.log('Create project request:', req.body);

    const { data: project, error } = await supabaseDB
      .from('projects')
      .insert({
        user_id: userId,
        organization_id: userId, // Use userId as org_id for single-user setup
        title: req.body.title || "Untitled Project",
        funder: req.body.funder || "",
        amount: req.body.amount || null,
        deadline: req.body.deadline || null,
        description: req.body.description || "",
        status: "draft"
      })
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return res.status(500).json({ error: "Failed to create project" });
    }

    console.log('Project created:', project.id);
    res.json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.put("/api/projects/:id", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);
    const id = req.params.id;

    const { data: project, error } = await supabaseDB
      .from('projects')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return res.status(404).json({ error: "Project not found" });
    }

    console.log('Project updated:', id);
    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

app.put("/api/projects/:id/finalize", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);
    const projectId = req.params.id;

    const { data: project, error } = await supabaseDB
      .from('projects')
      .update({
        status: 'final',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return res.status(404).json({ error: "Project not found" });
    }

    console.log('Project finalized:', projectId);
    res.json(project);
  } catch (error) {
    console.error('Finalize project error:', error);
    res.status(500).json({ error: "Failed to finalize project" });
  }
});

// Questions endpoints
app.get("/api/projects/:id/questions", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);
    const projectId = req.params.id;

    const { data: questions, error } = await supabaseDB
      .from('questions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ error: "Failed to fetch questions" });
    }

    console.log('Questions for project', projectId, ':', questions?.length || 0);
    
    // Transform snake_case to camelCase for client compatibility
    const formatted = (questions || []).map((q: any) => ({
      id: q.id,
      projectId: q.project_id,
      question: q.question,
      response: q.response,
      responseStatus: q.response_status || 'pending',
      errorMessage: q.error_message,
      wordLimit: q.word_limit,
      priority: q.priority,
      createdAt: q.created_at
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('List questions error:', error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

app.post("/api/projects/:projectId/questions", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);
    const projectId = req.params.projectId;
    console.log('Create question for project:', projectId, req.body);

    const { data: question, error } = await supabaseDB
      .from('questions')
      .insert({
        project_id: projectId,
        question: req.body.question || "",
        word_limit: req.body.wordLimit || null,
        priority: req.body.priority || "medium"
      })
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return res.status(500).json({ error: "Failed to create question" });
    }

    console.log('Question created:', question.id);
    
    // Transform to camelCase for client compatibility
    res.json({
      id: question.id,
      projectId: question.project_id,
      question: question.question,
      response: question.response,
      responseStatus: question.response_status || 'pending',
      errorMessage: question.error_message,
      wordLimit: question.word_limit,
      priority: question.priority,
      createdAt: question.created_at
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: "Failed to create question" });
  }
});

// Generate response endpoint - INLINE IMPLEMENTATION (no server module imports)
app.post("/api/questions/:id/generate", requireSupabaseUser, async (req: any, res) => {
  const questionId = req.params.id;
  const userId = getUserId(req);
  
  // SECURITY: Input validation
  const { tone = "professional", emphasisAreas = [] } = req.body;
  
  // Validate tone
  const validTones = ['professional', 'conversational', 'formal', 'friendly'];
  if (tone && !validTones.includes(tone)) {
    return res.status(400).json({ error: "Invalid tone. Must be one of: " + validTones.join(', ') });
  }
  
  // Validate emphasisAreas (prevent DoS via large arrays)
  if (!Array.isArray(emphasisAreas)) {
    return res.status(400).json({ error: "emphasisAreas must be an array" });
  }
  if (emphasisAreas.length > 10) {
    return res.status(400).json({ error: "Too many emphasis areas (max 10)" });
  }
  // Validate each emphasis area is a string and not too long
  for (const area of emphasisAreas) {
    if (typeof area !== 'string' || area.length > 100) {
      return res.status(400).json({ error: "Invalid emphasis area format" });
    }
  }

  if (!supabaseAdminClient) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  if (!openai) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  try {
    // Get question from database
    const { data: question, error: questionError } = await supabaseDB
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return res.status(404).json({ error: "Question not found" });
    }

    console.log(`[api/simple] Starting AI generation for question ${questionId}`);

    // Update question status in database
    await supabaseDB
      .from('questions')
      .update({ response_status: 'generating' })
      .eq('id', questionId);

    // Get documents from database
    const { data: userDocs } = await supabaseDB
      .from('documents')
      .select('*')
      .eq('user_id', userId);

    const processedDocs = (userDocs || []).filter((doc: any) => doc.processed && doc.summary);
    const organizationContext = processedDocs
      .map((doc: any) => `${doc.originalName || doc.filename}: ${doc.summary}`)
      .join('\n');

    // Mock user info
    const user = {
      id: userId,
      username: 'Test User',
      organizationName: 'Test Organization',
    };

    // Create mock document chunks from uploaded documents
    const retrievedChunks = processedDocs.slice(0, 8).map((doc: any, idx: number) => ({
      documentName: doc.originalName || doc.filename,
      documentId: doc.id,
      content: doc.summary || 'Document content',
      chunkIndex: 0,
      similarity: 0.9 - (idx * 0.1), // Mock similarity
    }));

    // Generate AI response
    const contextLines = retrievedChunks
      .map((chunk: any, index: number) => {
        return `[#${index + 1}] ${chunk.documentName}\n${chunk.content}`;
      })
      .join('\n\n');

    const instructions = `You are an expert grant writer. Use the provided snippets to answer the question with explicit citations. Return JSON with fields: text (string), citations (array of {documentName, documentId, chunkIndex, quote}), and assumptions (array of strings). Do not fabricate details.`;

    const userPrompt = `Grant Question: ${question.question}\n\nTone: ${tone}\n${
      question.word_limit ? `Target word count: ${question.word_limit}` : ''
    }\n${
      emphasisAreas.length ? `Emphasis areas: ${emphasisAreas.join(', ')}` : ''
    }\nOrganization info: ${user ? JSON.stringify(user) : 'N/A'}\n${organizationContext ? `\nContext: ${organizationContext}` : ''}\n\nContext Snippets:\n${contextLines}`;

    const startTime = Date.now();
    const aiResponse = await openai.chat.completions.create({
      model: process.env.GRANTED_DEFAULT_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: question.word_limit ? Math.min(question.word_limit * 3, 1500) : 1500,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = aiResponse.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from AI model');
    }

    const parsed = JSON.parse(content);
    const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
    const normalizedCitations = citations.map((entry: any, idx: number) => {
      const matchingChunk = retrievedChunks[idx] || retrievedChunks[0];
      return {
        documentName: entry.documentName || matchingChunk.documentName,
        documentId: entry.documentId || matchingChunk.documentId,
        chunkIndex: typeof entry.chunkIndex === 'number' ? entry.chunkIndex : matchingChunk.chunkIndex,
        quote: entry.quote || matchingChunk.content.slice(0, 160),
      };
    });

    const responseText = (parsed.text || parsed.answer || '').trim();
    const assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions : [];

    // Format response with citations
    let finalResponse = responseText;
    if (normalizedCitations.length) {
      finalResponse = finalResponse.replace(/\s+$/, '');
      const citationsBlock = normalizedCitations
        .map((citation: any, index: number) => {
          return `[#${index + 1}] ${citation.documentName} (chunk ${citation.chunkIndex + 1})${
            citation.quote ? ` – "${citation.quote}"` : ''
          }`;
        })
        .join('\n');
      finalResponse += `\n\nCitations:\n${citationsBlock}`;
    }

    if (assumptions.length) {
      const assumptionsBlock = assumptions
        .map((assumption: string, index: number) => `${index + 1}. ${assumption}`)
        .join('\n');
      finalResponse += `\n\nAssumptions & Follow-ups:\n${assumptionsBlock}`;
    }

    const duration = Date.now() - startTime;
    console.log(`[api/simple] AI generation completed in ${duration}ms`);

    // Determine status
    let responseStatus = 'complete';
    let errorMessage: string | null = null;
    if (!retrievedChunks.length) {
      responseStatus = 'needs_context';
      errorMessage = 'No relevant document context found. Upload more documents or refine the question.';
    } else if (responseText.includes('Unable to complete')) {
      responseStatus = 'failed';
      errorMessage = 'AI service unavailable; provided excerpts instead.';
    }

    // Update question in database
    const { data: updatedQuestion } = await supabaseDB
      .from('questions')
      .update({
        response: finalResponse,
        response_status: responseStatus,
        ...(errorMessage && { error_message: errorMessage })
      })
      .eq('id', questionId)
      .select()
      .single();

    const payload = {
      ...(updatedQuestion || question),
      citations: normalizedCitations,
      assumptions: assumptions,
      retrievedChunks: retrievedChunks,
    };

    if (responseStatus === 'complete') {
      res.json(payload);
    } else {
      res.status(206).json({
        ...payload,
        warning: errorMessage,
        canRetry: responseStatus === 'failed'
      });
    }
  } catch (error: any) {
    console.error(`[api/simple] Generation error for question ${questionId}:`, error);

    // Update question status to failed in database
    await supabaseDB
      .from('questions')
      .update({
        response_status: 'failed',
        error_message: error.message || 'Unexpected server error during generation'
      })
      .eq('id', questionId);

    // SECURITY: Don't leak error details in production
    res.status(500).json({
      error: 'Failed to generate response',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      canRetry: true
    });
  }
});

// Other endpoints
app.get("/api/stats", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);

    const { data: projects } = await supabaseDB
      .from('projects')
      .select('*')
      .eq('user_id', userId);

    res.json({ activeProjects: projects?.length || 0 });
  } catch (error) {
    console.error('Stats error:', error);
    res.json({ activeProjects: 0 });
  }
});

app.get("/api/settings", requireSupabaseUser, async (req: any, res) => {
  try {
    if (!supabaseDB) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const userId = getUserId(req);

    const { data: settings } = await supabaseDB
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settings) {
      res.json(settings);
    } else {
      // Return default settings if none exist
      res.json({ defaultTone: "professional" });
    }
  } catch (error) {
    console.error('Settings error:', error);
    res.json({ defaultTone: "professional" });
  }
});

// Extract questions from uploaded document (simplified)
app.post("/api/extract-questions", upload.single('file'), (req, res) => {
  console.log('Extract questions request received');

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Simple mock extraction - return some sample questions
  const sampleQuestions = [
    "Describe your organization's mission and primary objectives.",
    "What specific problem does your proposed project address?",
    "How will you measure the success of your project?",
    "What is your organization's experience with similar projects?",
    "Provide a detailed budget breakdown for the requested funds."
  ];

  console.log('Returning sample questions for:', req.file.originalname);

  res.json({
    questions: sampleQuestions,
    filename: req.file.originalname,
    extractedCount: sampleQuestions.length
  });
});

// Auth endpoints
app.get("/api/auth/me", async (req, res) => {
  if (!supabaseAdminClient) {
    // If Supabase is not configured, return null (not an error)
    return res.json(null);
  }

  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    // No token = not authenticated, but return null (not 401)
    return res.json(null);
  }

  try {
    const { data, error } = await supabaseAdminClient.auth.getUser(token);
    if (error || !data.user) {
      return res.json(null);
    }

    const { user } = data;

    // Ensure user exists in database
    if (supabaseDB) {
      await ensureUserExists(user.id, user.email || '');
    }

    res.json({
      id: user.id,
      email: user.email,
      username: (user.user_metadata as any)?.username || user.email || user.id,
      organizationName: (user.user_metadata as any)?.organizationName,
      avatar: (user.user_metadata as any)?.avatar_url,
    });
  } catch (error) {
    console.error("[api/simple] Failed to resolve Supabase user for /api/auth/me:", error);
    return res.json(null);
  }
});

// Health check
app.get("/api/status", (req, res) => {
  res.json({
    api: "simple-version-database-backed",
    database: process.env.DATABASE_URL ? "connected" : "not configured",
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express error handler:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

export default app;