import { config } from "dotenv";
config();

import express from "express";
import multer from "multer";

const app = express();

// Try to import server modules at module level - wrap in try-catch
let storage: any;
let aiService: any;
let retrieveRelevantChunks: any;
let requireSupabaseUser: any;
let AuthenticatedRequest: any;
let modulesAvailable = false;

// Attempt to load modules at initialization time
try {
  // Use dynamic import() but at module level - Vercel should handle this
  const initModules = async () => {
    try {
      console.log("[api/simple] Attempting to load server modules...");
      
      const storageModule = await import("../server/storage.js");
      storage = storageModule.storage;
      console.log("[api/simple] Storage module loaded");

      const aiModule = await import("../server/services/ai.js");
      aiService = aiModule.aiService;
      console.log("[api/simple] AI service module loaded");

      const retrievalModule = await import("../server/services/retrieval.js");
      retrieveRelevantChunks = retrievalModule.retrieveRelevantChunks;
      console.log("[api/simple] Retrieval module loaded");

      const authModule = await import("../server/middleware/supabaseAuth.js");
      requireSupabaseUser = authModule.requireSupabaseUser;
      AuthenticatedRequest = authModule.AuthenticatedRequest;
      console.log("[api/simple] Auth module loaded");

      modulesAvailable = true;
      console.log("[api/simple] All modules loaded successfully");
    } catch (error: any) {
      console.error("[api/simple] Failed to load modules:", error?.message || error);
      console.error("[api/simple] Error stack:", error?.stack);
      console.error("[api/simple] Error details:", {
        name: error?.name,
        code: error?.code,
        message: error?.message
      });
      modulesAvailable = false;
    }
  };
  
  // Start loading but don't block - modules will be available when needed
  initModules().catch((err) => {
    console.error("[api/simple] Module initialization failed:", err);
  });
} catch (error: any) {
  console.error("[api/simple] Failed to initialize module loader:", error?.message || error);
  modulesAvailable = false;
}

async function ensureModulesLoaded() {
  if (modulesAvailable && storage && aiService && retrieveRelevantChunks && requireSupabaseUser) {
    return;
  }
  
  // Wait a bit for async initialization
  let attempts = 0;
  while (attempts < 10 && !modulesAvailable) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!modulesAvailable || !storage || !aiService || !retrieveRelevantChunks || !requireSupabaseUser) {
    throw new Error("Server modules not available. Check Vercel logs for initialization errors.");
  }
}

// Helper function to get authenticated user ID
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

// Generate response endpoint - REAL AI IMPLEMENTATION
app.post("/api/questions/:id/generate", async (req, res, next) => {
  try {
    await ensureModulesLoaded();
    
    if (!requireSupabaseUser) {
      throw new Error("Authentication middleware not available");
    }
    
    // Wrap the middleware call properly
    return requireSupabaseUser(req as any, res, (err?: any) => {
      if (err) {
        return next(err);
      }
      // Authentication succeeded, handle the request
      handleGenerateRequest(req as any, res).catch(next);
    });
  } catch (error: any) {
    console.error("[api/simple] Failed to load server modules:", error);
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;
    console.error("[api/simple] Error details:", {
      message: errorMessage,
      stack: errorStack,
      name: error?.name,
      code: error?.code,
      modulesAvailable,
      hasStorage: !!storage,
      hasAiService: !!aiService,
      hasRetrieval: !!retrieveRelevantChunks,
      hasAuth: !!requireSupabaseUser
    });
    res.status(500).json({
      error: "Failed to initialize server modules",
      details: errorMessage,
      ...(process.env.NODE_ENV === "development" && { stack: errorStack })
    });
  }
});

async function handleGenerateRequest(req: any, res: express.Response) {
  let questionId = req.params.id;
  
  try {
    const question = await storage.getGrantQuestion(questionId);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Update status to generating
    console.log(`Starting AI generation for question ${questionId}: ${question.question.substring(0, 100)}...`);
    await storage.updateGrantQuestion(questionId, { responseStatus: "generating" });

    const userId = getUserId(req);
    const { tone = "professional", emphasisAreas = [] } = req.body;

    // Get user context from documents
    const documents = await storage.getDocuments(userId);
    
    const processedDocs = documents.filter((doc) => doc.processed && doc.summary);
    const organizationContext = processedDocs
      .map((doc) => `${doc.originalName}: ${doc.summary}`)
      .join('\n');

    const retrievalResult = await retrieveRelevantChunks({
      userId,
      query: question.question,
      limit: 8,
      semanticLimit: 8,
      keywordLimit: 4,
    });

    const user = await storage.getUser(userId);

    try {
      const startTime = Date.now();
      
      const grounded = await aiService.generateGroundedResponse({
        question: question.question,
        tone,
        wordLimit: question.wordLimit || undefined,
        emphasisAreas,
        organizationInfo: {
          ...user,
          contextSummary: organizationContext,
        },
        retrievedChunks: retrievalResult.chunks.map((chunk) => ({
          documentName: chunk.documentName,
          documentId: chunk.documentId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          similarity: chunk.similarity,
        })),
      });

      const projectId = (question as any).project_id || (question as any).projectId;

      await storage.deleteDraftCitations(question.id);
      for (const citation of grounded.citations || []) {
        if (!citation.documentId) continue;
        await storage.createDraftCitation({
          draftId: question.id,
          section: "response",
          sourceDocumentId: citation.documentId,
          chunkRefs: [
            {
              chunkIndex: citation.chunkIndex ?? 0,
              quote: citation.quote ?? "",
            },
          ],
        });
      }

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

      let responseText = grounded.text?.trim() || '';
      if (grounded.citations?.length) {
        responseText = responseText.replace(/\s+$/, '');
        const citationsBlock = grounded.citations
          .map((citation, index) => {
            return `[#${index + 1}] ${citation.documentName} (chunk ${citation.chunkIndex + 1})${
              citation.quote ? ` – "${citation.quote}"` : ''
            }`;
          })
          .join('\n');
        responseText += `\n\nCitations:\n${citationsBlock}`;
      }

      if (grounded.assumptions?.length) {
        const assumptionsBlock = grounded.assumptions
          .map((assumption, index) => `${index + 1}. ${assumption}`)
          .join('\n');
        responseText += `\n\nAssumptions & Follow-ups:\n${assumptionsBlock}`;
      }
      
      const duration = Date.now() - startTime;
      console.log(`AI generation completed in ${duration}ms for question ${questionId}`);

      // Determine the status based on the response type
      let responseStatus: string;
      let errorMessage: string | null = null;
      if (!retrievalResult.chunks.length) {
        responseStatus = "needs_context";
        errorMessage = "No relevant document context found. Upload more documents or refine the question.";
      } else if (grounded.text?.includes("Unable to complete a grounded draft")) {
        responseStatus = "failed";
        errorMessage = "AI service unavailable; provided excerpts instead.";
      } else if (grounded.text?.includes("Using available snippets")) {
        responseStatus = "needs_context";
        errorMessage = "Limited context available; refine uploads for a stronger draft.";
      } else {
        responseStatus = "complete";
      }

      console.log(`Setting response status to: ${responseStatus} for question ${questionId}`);

      // Create response version
      const versions = await storage.getResponseVersions(question.id);
      const nextVersion = versions.length + 1;
      
      await storage.createResponseVersion(question.id, responseText, tone, nextVersion);

      // Update question with response and status
      const updatedQuestion = await storage.updateGrantQuestion(questionId, {
        response: responseText,
        responseStatus,
        ...(errorMessage && { errorMessage })
      });

      // Return appropriate status code based on result
      const payload = {
        ...updatedQuestion,
        citations: grounded.citations,
        assumptions: grounded.assumptions,
        retrievedChunks: retrievalResult.chunks,
      };

      if (responseStatus === "complete") {
        res.json(payload);
      } else {
        res.status(206).json({ // 206 Partial Content - request completed but with limitations
          ...payload,
          warning: errorMessage,
          canRetry: responseStatus === "timeout" || responseStatus === "failed"
        });
      }
    } catch (aiError: any) {
      console.error(`AI generation failed for question ${questionId}:`, aiError);
      let failureStatus: string;
      let errorMessage: string;
      if (aiError.message?.includes('timeout') || aiError.name === 'AbortError') {
        failureStatus = "timeout";
        errorMessage = "Request timed out - the AI service took too long to respond";
      } else if (aiError.code === 'insufficient_quota' || aiError.code === 'rate_limit_exceeded') {
        failureStatus = "failed";
        errorMessage = "AI service rate limit reached - please try again later";
      } else if (aiError.code === 'invalid_api_key' || aiError.status === 401) {
        failureStatus = "failed";
        errorMessage = "AI service authentication error";
      } else {
        failureStatus = "failed";
        errorMessage = "AI generation failed due to service error";
      }
      console.log(`Setting failure status to: ${failureStatus} for question ${questionId}`);
      await storage.updateGrantQuestion(questionId, {
        responseStatus: failureStatus,
        errorMessage
      });
      throw new Error(`AI generation failed: ${errorMessage}`);
    }
  } catch (error: any) {
    console.error(`Generation endpoint error for question ${questionId}:`, error);
    try {
      await storage.updateGrantQuestion(questionId, {
        responseStatus: "failed",
        errorMessage: "Unexpected server error during generation"
      });
    } catch (updateError) {
      console.error("Failed to update question status after error:", updateError);
    }
    res.status(500).json({
      error: "Failed to generate response",
      details: error.message,
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