// Vercel serverless function that uses the full /server implementation with database persistence
// This replaces the in-memory api/simple.ts with a database-backed version

import { config } from "dotenv";
config();

import express, { type Request, Response, NextFunction } from "express";
import { storage } from "../server/storage";
import { aiService } from "../server/services/ai";
import { fileProcessor } from "../server/services/fileProcessor";
import { retrieveRelevantChunks } from "../server/services/retrieval";
import multer from "multer";
import { insertProjectSchema, insertGrantQuestionSchema, insertUserSettingsSchema } from "../shared/schema";
import { requireSupabaseUser, supabaseAdminClient, type AuthenticatedRequest } from "../server/middleware/supabaseAuth";
import { corsMiddleware } from "../server/middleware/cors";
import { apiRateLimiter, uploadRateLimiter } from "../server/middleware/rateLimiter";
import { setupAuth } from "../server/auth";

const app = express();

// CORS middleware
app.use(corsMiddleware);

// Request body size limits
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "1mb" }));
app.use(express.urlencoded({ extended: false, limit: process.env.REQUEST_URLENCODED_LIMIT || "10mb" }));

// Rate limiting
app.use("/api", apiRateLimiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

function getUserId(req: AuthenticatedRequest): string {
  if (!req.supabaseUser || !req.supabaseUser.id) {
    throw new Error("User not authenticated");
  }
  return req.supabaseUser.id;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Initialize auth once
let authInitialized = false;
async function ensureAuth() {
  if (!authInitialized) {
    await setupAuth(app);
    authInitialized = true;
  }
}

// Health check
app.get("/api/status", (req, res) => {
  res.json({
    api: "server-database-backed",
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? "connected" : "not configured"
  });
});

// Auth
app.get("/api/auth/me", async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdminClient) return res.json(null);

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return res.json(null);

  try {
    const { data, error } = await supabaseAdminClient.auth.getUser(token);
    if (error || !data.user) return res.json(null);

    const { user } = data;
    let dbUser = await storage.getUser(user.id);
    if (!dbUser) {
      dbUser = await storage.createUser({
        id: user.id,
        email: user.email || "",
        username: (user.user_metadata as any)?.username || user.email?.split('@')[0] || user.id,
        organizationName: (user.user_metadata as any)?.organizationName,
        googleId: (user.app_metadata as any)?.provider === 'google' ? (user.user_metadata as any)?.sub : undefined
      });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: dbUser.username,
      organizationName: dbUser.organizationName,
      avatar: (user.user_metadata as any)?.avatar_url,
    });
  } catch (error) {
    console.error("[api/server] Auth error:", error);
    res.json(null);
  }
});

// Projects
app.get("/api/projects", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const projects = await storage.getProjects(getUserId(req));
    res.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.post("/api/projects", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.body.deadline && typeof req.body.deadline === 'string') {
      req.body.deadline = new Date(req.body.deadline);
    }
    const validatedData = insertProjectSchema.parse(req.body);
    const project = await storage.createProject(getUserId(req), validatedData);
    res.json(project);
  } catch (error) {
    console.error("Project creation error:", error);
    res.status(400).json({ error: "Invalid project data" });
  }
});

app.put("/api/projects/:id", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const project = await storage.updateProject(req.params.id, req.body);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Failed to update project" });
  }
});

app.put("/api/projects/:id/finalize", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const finalizedProject = await storage.updateProject(req.params.id, {
      status: 'final',
      updatedAt: new Date()
    });
    if (!finalizedProject) return res.status(404).json({ error: "Project not found" });
    res.json(finalizedProject);
  } catch (error) {
    console.error("Failed to finalize project:", error);
    res.status(500).json({ error: "Failed to finalize project" });
  }
});

// Documents
app.get("/api/documents", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const documents = await storage.getDocuments(getUserId(req));
    const enriched = await Promise.all(
      documents.map(async (doc) => {
        let signedUrl: string | null = null;
        if (doc.storageBucket && doc.storagePath && supabaseAdminClient) {
          const { data } = await supabaseAdminClient.storage
            .from(doc.storageBucket)
            .createSignedUrl(doc.storagePath, 60 * 60);
          signedUrl = data?.signedUrl ?? null;
        }
        return { ...doc, storageUrl: signedUrl || doc.storageUrl || null };
      })
    );
    res.json(enriched);
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

app.post("/api/documents/upload", uploadRateLimiter, requireSupabaseUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  let documentRecord: any;
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!supabaseAdminClient) return res.status(500).json({ error: "Storage is not configured" });

    const userId = getUserId(req);
    const { originalname, buffer, mimetype, size } = req.file;
    const category = req.body.category || "organization-info";
    const bucket = process.env.DOCUMENTS_BUCKET || "documents";
    const sanitizedName = originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await supabaseAdminClient.storage
      .from(bucket)
      .upload(storagePath, buffer, { contentType: mimetype, duplex: "half" });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return res.status(500).json({ error: "Failed to store file" });
    }

    documentRecord = await storage.createDocument(userId, {
      filename: sanitizedName,
      originalName: originalname,
      fileType: mimetype,
      fileSize: size,
      category,
      organizationId: userId,
      storageBucket: bucket,
      storagePath,
      processingStatus: "processing",
      processed: false,
    });

    const processed = await fileProcessor.processFile(buffer, originalname, mimetype, documentRecord);
    const updatedDocument = await storage.updateDocument(documentRecord.id, {
      summary: processed.summary,
      processed: true,
      processingStatus: "complete",
      summaryExtractedAt: new Date(),
      processedAt: new Date(),
      embeddingStatus: "pending",
    });

    if (!updatedDocument) throw new Error("Failed to persist document metadata");
    await storage.createProcessingJob(documentRecord.id, "embedding", "queued");

    res.json({ ...updatedDocument, summary: processed.summary, processed: true });
  } catch (error) {
    console.error("Upload error:", error);
    if (documentRecord) {
      await storage.updateDocument(documentRecord.id, {
        processingStatus: "failed",
        processingError: error instanceof Error ? error.message : "Unknown error",
      });
    }
    res.status(500).json({ error: "Failed to process upload" });
  }
});

app.delete("/api/documents/:id", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const document = await storage.getDocument(req.params.id);
    if (!document) return res.status(404).json({ error: "Document not found" });

    if (document.storageBucket && document.storagePath && supabaseAdminClient) {
      await supabaseAdminClient.storage.from(document.storageBucket).remove([document.storagePath]);
    }

    const success = await storage.deleteDocument(req.params.id);
    if (!success) return res.status(404).json({ error: "Document not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Questions
app.get("/api/projects/:projectId/questions", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const questions = await storage.getGrantQuestions(req.params.projectId);
    const enriched = await Promise.all(
      questions.map(async (q: any) => {
        const projectId = q.projectId ?? q.project_id ?? req.params.projectId;
        const citations = await storage.getDraftCitations(q.id);
        const assumptions = await storage.getAssumptionLabels(projectId, q.id);
        return { ...q, citations, assumptions };
      })
    );
    res.json(enriched);
  } catch (error) {
    console.error("Failed to fetch questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

app.post("/api/projects/:projectId/questions", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = insertGrantQuestionSchema.parse(req.body);
    const question = await storage.createGrantQuestion(req.params.projectId, validatedData);
    res.json(question);
  } catch (error) {
    console.error("Failed to create question:", error);
    res.status(400).json({ error: "Invalid question data" });
  }
});

app.post("/api/questions/:id/generate", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  const questionId = req.params.id;
  try {
    const question = await storage.getGrantQuestion(questionId);
    if (!question) return res.status(404).json({ error: "Question not found" });

    console.log(`[api/server] Starting AI generation for question ${questionId}`);
    await storage.updateGrantQuestion(questionId, { responseStatus: "generating" });

    const userId = getUserId(req);
    const { tone = "professional", emphasisAreas = [] } = req.body;
    const documents = await storage.getDocuments(userId);
    const processedDocs = documents.filter((doc) => doc.processed && doc.summary);
    const organizationContext = processedDocs.map((doc) => `${doc.originalName}: ${doc.summary}`).join('\n');

    const retrievalResult = await retrieveRelevantChunks({
      userId,
      query: question.question,
      limit: 8,
      semanticLimit: 8,
      keywordLimit: 4,
    });

    const user = await storage.getUser(userId);
    const startTime = Date.now();

    const grounded = await aiService.generateGroundedResponse({
      question: question.question,
      tone,
      wordLimit: question.wordLimit || undefined,
      emphasisAreas,
      organizationInfo: { ...user, contextSummary: organizationContext },
      retrievedChunks: retrievalResult.chunks.map((chunk) => ({
        documentName: chunk.documentName,
        documentId: chunk.documentId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        similarity: chunk.similarity,
      })),
    });

    const projectId = (question as any).project_id || (question as any).projectId;

    // Save citations
    await storage.deleteDraftCitations(question.id);
    for (const citation of grounded.citations || []) {
      if (!citation.documentId) continue;
      await storage.createDraftCitation({
        draftId: question.id,
        section: "response",
        sourceDocumentId: citation.documentId,
        chunkRefs: [{ chunkIndex: citation.chunkIndex ?? 0, quote: citation.quote ?? "" }],
      });
    }

    // Save assumptions
    if (projectId) {
      await storage.deleteAssumptionLabels(projectId, question.id);
      for (const assumption of grounded.assumptions || []) {
        await storage.createAssumptionLabel({
          projectId,
          draftId: question.id,
          text: assumption,
          category: "general",
          confidence: 50,
          suggestedQuestion: assumption,
          position: { start: 0, end: 0 },
        });
      }
    }

    // Format response
    let responseText = grounded.text?.trim() || '';
    if (grounded.citations?.length) {
      const citationsBlock = grounded.citations
        .map((c, i) => `[#${i + 1}] ${c.documentName} (chunk ${c.chunkIndex + 1})${c.quote ? ` – "${c.quote}"` : ''}`)
        .join('\n');
      responseText += `\n\nCitations:\n${citationsBlock}`;
    }
    if (grounded.assumptions?.length) {
      const assumptionsBlock = grounded.assumptions.map((a, i) => `${i + 1}. ${a}`).join('\n');
      responseText += `\n\nAssumptions & Follow-ups:\n${assumptionsBlock}`;
    }

    const duration = Date.now() - startTime;
    console.log(`[api/server] AI generation completed in ${duration}ms`);

    let responseStatus = "complete";
    let errorMessage: string | null = null;
    if (!retrievalResult.chunks.length) {
      responseStatus = "needs_context";
      errorMessage = "No relevant document context found. Upload more documents or refine the question.";
    } else if (grounded.text?.includes("Unable to complete")) {
      responseStatus = "failed";
      errorMessage = "AI service unavailable; provided excerpts instead.";
    }

    const versions = await storage.getResponseVersions(question.id);
    await storage.createResponseVersion(question.id, responseText, tone, versions.length + 1);

    const updatedQuestion = await storage.updateGrantQuestion(questionId, {
      response: responseText,
      responseStatus,
      ...(errorMessage && { errorMessage })
    });

    const payload = {
      ...updatedQuestion,
      citations: grounded.citations,
      assumptions: grounded.assumptions,
      retrievedChunks: retrievalResult.chunks,
    };

    if (responseStatus === "complete") {
      res.json(payload);
    } else {
      res.status(206).json({ ...payload, warning: errorMessage, canRetry: responseStatus === "failed" });
    }
  } catch (error: any) {
    console.error(`[api/server] Generation error:`, error);
    await storage.updateGrantQuestion(questionId, {
      responseStatus: "failed",
      errorMessage: "Unexpected server error during generation"
    });
    res.status(500).json({ error: "Failed to generate response", details: error.message, canRetry: true });
  }
});

// Settings
app.get("/api/settings", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    let settings = await storage.getUserSettings(userId);
    if (!settings) {
      settings = await storage.createUserSettings(userId, {
        defaultTone: "professional",
        lengthPreference: "balanced",
        emphasisAreas: ["Impact & Outcomes", "Innovation", "Sustainability"],
        aiModel: "gpt-4o",
        fallbackModel: "gpt-3.5-turbo",
        creativity: 30,
        contextUsage: 80,
        emailNotifications: true,
        autoSave: true,
        analytics: true,
        autoDetection: true
      });
    }
    res.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.put("/api/settings", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const validatedData = insertUserSettingsSchema.parse(req.body);
    const settings = await storage.updateUserSettings(userId, validatedData);
    if (!settings) return res.status(404).json({ error: "Settings not found" });
    res.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    res.status(400).json({ error: "Invalid settings data" });
  }
});

// Stats
app.get("/api/stats", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const stats = await storage.getUserStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Extract questions
app.post("/api/extract-questions", uploadRateLimiter, requireSupabaseUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { originalname, buffer, mimetype } = req.file;
    const questions = await fileProcessor.extractQuestionsFromFile(buffer, originalname, mimetype);
    res.json({ questions });
  } catch (error) {
    console.error("Question extraction error:", error);
    res.status(500).json({ error: "Failed to extract questions" });
  }
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[api/server] Error:", err);
  res.status(err.status || err.statusCode || 500).json({ message: err.message || "Internal Server Error" });
});

export default app;
