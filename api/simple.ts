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

// Simple in-memory storage
let documents: any[] = [];
let projects: any[] = [];
let questions: any[] = [];
let nextId = 1;
let nextProjectId = 1;
let nextQuestionId = 1;

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
app.post("/api/documents/upload", upload.single('file'), (req, res) => {
  console.log('Simple upload received');

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const document = {
    id: `doc-${nextId++}`,
    filename: req.file.originalname,
    originalName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    category: req.body.category || "organization-info",
    summary: `Uploaded ${req.file.originalname}`,
    processed: true,
    uploadedAt: new Date().toISOString(),
    userId: "user-123"
  };

  documents.push(document);
  console.log('Document stored. Total documents:', documents.length);

  res.json(document);
});

// List documents
app.get("/api/documents", (req, res) => {
  console.log('Documents list requested. Count:', documents.length);
  res.json(documents);
});

// Delete document
app.delete("/api/documents/:id", (req, res) => {
  const id = req.params.id;
  const index = documents.findIndex(doc => doc.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Document not found" });
  }

  documents.splice(index, 1);
  console.log('Document deleted. Remaining:', documents.length);

  res.json({ message: "Document deleted" });
});

// Projects endpoints
app.get("/api/projects", (req, res) => {
  console.log('Projects list requested. Count:', projects.length);
  res.json(projects);
});

app.post("/api/projects", (req, res) => {
  console.log('Create project request:', req.body);

  const project = {
    id: `project-${nextProjectId++}`,
    title: req.body.title || "Untitled Project",
    funder: req.body.funder || "",
    amount: req.body.amount || null,
    deadline: req.body.deadline || null,
    description: req.body.description || "",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: "user-123"
  };

  projects.push(project);
  console.log('Project created:', project.id);

  res.json(project);
});

app.put("/api/projects/:id", (req, res) => {
  const id = req.params.id;
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Project not found" });
  }

  projects[index] = {
    ...projects[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  console.log('Project updated:', id);
  res.json(projects[index]);
});

// Questions endpoints
app.get("/api/projects/:id/questions", (req, res) => {
  const projectId = req.params.id;
  const projectQuestions = questions.filter(q => q.projectId === projectId);
  console.log('Questions for project', projectId, ':', projectQuestions.length);
  res.json(projectQuestions);
});

app.post("/api/projects/:projectId/questions", (req, res) => {
  const projectId = req.params.projectId;
  console.log('Create question for project:', projectId, req.body);

  const question = {
    id: `question-${nextQuestionId++}`,
    projectId: projectId,
    question: req.body.question || "",
    wordLimit: req.body.wordLimit || null,
    priority: req.body.priority || "medium",
    createdAt: new Date().toISOString(),
    userId: "user-123"
  };

  questions.push(question);
  console.log('Question created:', question.id);

  res.json(question);
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
    // SECURITY: Validate questionId format (prevent injection attempts)
    if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
      return res.status(400).json({ error: "Invalid question ID format" });
    }

    // SECURITY: Get question AND verify it belongs to user's project
    const { data: question, error: questionError } = await supabaseAdminClient
      .from('grant_questions')
      .select(`
        *,
        projects!inner(id, user_id)
      `)
      .eq('id', questionId)
      .eq('projects.user_id', userId)
      .single();

    if (questionError || !question) {
      // Don't reveal if question exists but user doesn't own it
      return res.status(404).json({ error: "Question not found" });
    }

    // SECURITY: Double-check ownership (defense in depth)
    if (question.projects?.user_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    console.log(`[api/simple] Starting AI generation for question ${questionId}`);

    // Update status to generating (with ownership check)
    await supabaseAdminClient
      .from('grant_questions')
      .update({ response_status: 'generating' })
      .eq('id', questionId)
      .eq('project_id', question.project_id); // Additional security: verify project_id matches

    // Get user documents from Supabase
    const { data: documents } = await supabaseAdminClient
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .eq('processed', true);

    const processedDocs = (documents || []).filter((doc: any) => doc.summary);
    const organizationContext = processedDocs
      .map((doc: any) => `${doc.original_name || doc.filename}: ${doc.summary}`)
      .join('\n');

    // Get user info
    const { data: user } = await supabaseAdminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Simple retrieval - get document chunks (simplified, no embedding search for now)
    const { data: chunks } = await supabaseAdminClient
      .from('doc_chunks')
      .select(`
        *,
        documents!inner(id, original_name, filename, category)
      `)
      .eq('documents.user_id', userId)
      .limit(8);

    const retrievedChunks = (chunks || []).slice(0, 8).map((chunk: any, idx: number) => ({
      documentName: chunk.documents?.original_name || chunk.documents?.filename || 'Document',
      documentId: chunk.documents?.id || '',
      content: chunk.content || '',
      chunkIndex: chunk.chunk_index || idx,
      similarity: 0.8 - (idx * 0.1), // Mock similarity
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

    // Update question in Supabase (with ownership check)
    const { data: updatedQuestion } = await supabaseAdminClient
      .from('grant_questions')
      .update({
        response: finalResponse,
        response_status: responseStatus,
        error_message: errorMessage,
      })
      .eq('id', questionId)
      .eq('project_id', question.project_id) // SECURITY: Verify project_id matches
      .select()
      .single();

    const payload = {
      ...updatedQuestion,
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
    
    // Update question status to failed
    try {
      await supabaseAdminClient
        .from('grant_questions')
        .update({
          response_status: 'failed',
          error_message: error.message || 'Unexpected server error during generation'
        })
        .eq('id', questionId);
    } catch (updateError) {
      console.error('[api/simple] Failed to update question status:', updateError);
    }

    // SECURITY: Don't leak error details in production
    res.status(500).json({
      error: 'Failed to generate response',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      canRetry: true
    });
  }
});

// Other endpoints
app.get("/api/stats", (req, res) => res.json({ activeProjects: projects.length }));
app.get("/api/settings", (req, res) => res.json({ defaultTone: "professional" }));

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
    api: "simple-version",
    documents: documents.length,
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