import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { aiService } from "./services/ai.js";
import { fileProcessor } from "./services/fileProcessor.js";
import { retrieveRelevantChunks } from "./services/retrieval.js";
import { processDocumentJobs } from "./workers/documentProcessor.js";
import multer from "multer";
import fs from "fs";
// Test: Use relative import instead of path alias to see if that's the issue
import { insertProjectSchema, insertGrantQuestionSchema, insertUserSettingsSchema, type Document } from "../shared/schema.js";
import { requireSupabaseUser, supabaseAdminClient, type AuthenticatedRequest } from "./middleware/supabaseAuth.js";
import { uploadRateLimiter } from "./middleware/rateLimiter.js";

// Helper function to get authenticated user ID
function getUserId(req: AuthenticatedRequest): string {
  if (!req.supabaseUser || !req.supabaseUser.id) {
    throw new Error("User not authenticated");
  }
  return req.supabaseUser.id;
}

/**
 * `draft_citations` rows use { sourceDocumentId, chunkRefs } but the drafts UI
 * expects { documentName, documentId, chunkIndex, quote }. The generate endpoint
 * returns the rich shape; list/refetch only had the DB shape, so citations
 * rendered as "[1]" + "Chunk 1" with no document title or quote.
 */
async function enrichCitationsFromDraftRows(
  draftCitations: Array<{
    id?: string;
    sourceDocumentId?: string | null;
    chunkRefs?: unknown;
    section?: string | null;
  }>
) {
  return Promise.all(
    draftCitations.map(async (c) => {
      const sourceId = c.sourceDocumentId || "";
      let documentName = "";
      if (sourceId) {
        const doc = await storage.getDocument(sourceId);
        documentName = doc?.originalName || doc?.filename || "";
      }
      const refs = Array.isArray(c.chunkRefs) ? c.chunkRefs : [];
      const first = refs[0] as { chunkIndex?: number; quote?: string } | undefined;
      const chunkIndex = typeof first?.chunkIndex === "number" ? first.chunkIndex : 0;
      const quote = typeof first?.quote === "string" ? first.quote : "";
      return {
        id: c.id,
        section: c.section,
        documentId: sourceId,
        documentName: documentName || sourceId || "Uploaded document",
        chunkIndex,
        quote,
      };
    })
  );
}

// Columns on `projects` that clients are allowed to update. Anything else
// (id/userId/organizationId/timestamps) is stripped to avoid accidental
// spreads from the client breaking the update.
const PROJECT_UPDATABLE_FIELDS = new Set([
  "title",
  "funder",
  "amount",
  "deadline",
  "status",
  "description",
  "amountRequested",
  "amountAwarded",
  "awardedAt",
  "reportingDueAt",
]);

const PROJECT_DATE_FIELDS = new Set([
  "deadline",
  "awardedAt",
  "reportingDueAt",
]);

function coerceProjectDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }
    return d;
  }
  throw new Error(`Unsupported date value: ${JSON.stringify(value)}`);
}

function sanitizeProjectUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (!PROJECT_UPDATABLE_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    if (PROJECT_DATE_FIELDS.has(key)) {
      updates[key] = coerceProjectDate(value);
    } else {
      updates[key] = value;
    }
  }
  // Always bump updatedAt so downstream sorts reflect the change.
  updates.updatedAt = new Date();
  return updates;
}

// Configure multer for file uploads.
// Use memory storage so uploads work in serverless environments (Vercel) where
// only /tmp is writable. File buffers are read directly from req.file.buffer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure uploads directory exists (best-effort; not required when using
  // multer memoryStorage, and read-only filesystems like Vercel will skip it).
  try {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
  } catch {
    // noop - memory storage is used for uploads
  }

  // Diagnostic endpoint
  app.get("/api/debug/status", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const hasDatabaseUrl = !!process.env.DATABASE_URL;
      const projects = await storage.getProjects(userId);
      
      res.json({
        status: "ok",
        userId,
        database: {
          configured: hasDatabaseUrl,
          url: hasDatabaseUrl ? `${process.env.DATABASE_URL!.substring(0, 20)}...` : null,
          type: hasDatabaseUrl ? "postgres" : "in-memory"
        },
        projects: {
          count: projects.length,
          ids: projects.map(p => ({ id: p.id, title: p.title, userId: p.userId }))
        }
      });
    } catch (error) {
      console.error("Debug status error:", error);
      res.status(500).json({ error: "Failed to get status", message: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Projects routes
  app.get("/api/projects", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      console.log(`[GET /api/projects] Fetching projects for user: ${userId}`);
      const projects = await storage.getProjects(userId);
      console.log(`[GET /api/projects] Found ${projects.length} projects for user ${userId}`);
      res.json(projects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      console.log("Received project data:", JSON.stringify(req.body, null, 2));
      
      // Convert deadline string to Date object if it's a string
      if (req.body.deadline && typeof req.body.deadline === 'string') {
        req.body.deadline = new Date(req.body.deadline);
      }
      
      const validatedData = insertProjectSchema.parse(req.body);
      console.log("Validated data:", JSON.stringify(validatedData, null, 2));
      const project = await storage.createProject(userId, validatedData);
      res.json(project);
    } catch (error) {
      console.error("Project creation error:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
      }
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  app.get("/api/projects/:id", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const projectId = req.params.id;
      console.log(`[GET /api/projects/${projectId}] Fetching project for user: ${userId}`);
      const project = await storage.getProject(projectId);
      if (!project) {
        console.log(`[GET /api/projects/${projectId}] Project not found in database`);
        return res.status(404).json({ error: "Project not found" });
      }
      console.log(`[GET /api/projects/${projectId}] Found project owned by: ${project.userId}`);
      res.json(project);
    } catch (error) {
      console.error(`[GET /api/projects/${req.params.id}] Error:`, error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.put("/api/projects/:id", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const projectId = req.params.id;

      const existing = await storage.getProject(projectId);
      if (!existing) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized to update this project" });
      }

      const updates = sanitizeProjectUpdate(req.body);
      const project = await storage.updateProject(projectId, updates);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error(`[PUT /api/projects/${req.params.id}] Error:`, error);
      res.status(500).json({
        error: "Failed to update project",
        message: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  });

  app.put("/api/projects/:id/finalize", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Update project status to 'final'
      const finalizedProject = await storage.updateProject(req.params.id, { 
        status: 'final', 
        updatedAt: new Date() 
      });
      
      console.log(`Project ${req.params.id} finalized by user ${userId}`);
      res.json(finalizedProject);
    } catch (error) {
      console.error("Failed to finalize project:", error);
      res.status(500).json({ error: "Failed to finalize project" });
    }
  });

  app.delete("/api/projects/:id", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    const projectId = req.params.id;
    try {
      const userId = getUserId(req);
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({
          error: "Project not found",
          message: "This project does not exist or has already been deleted.",
        });
      }

      if (project.userId !== userId) {
        console.warn(
          `[DELETE /api/projects/${projectId}] auth failed: user ${userId} is not owner ${project.userId}`
        );
        return res.status(403).json({
          error: "Unauthorized to delete this project",
          message: "You don't have permission to delete this project.",
        });
      }

      const deleted = await storage.deleteProject(projectId);
      if (!deleted) {
        console.error(`[DELETE /api/projects/${projectId}] deleteProject returned false`);
        return res.status(500).json({
          error: "Failed to delete project",
          message: "An error occurred while deleting the project.",
        });
      }

      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error(`[DELETE /api/projects/${projectId}] exception:`, error);
      res.status(500).json({
        error: "Failed to delete project",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  });

  // Documents routes
  app.get("/api/documents", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const documents = await storage.getDocuments(userId);

      const enriched = await Promise.all(
        documents.map(async (doc) => {
          let signedUrl: string | null = null;
          if (doc.storageBucket && doc.storagePath && supabaseAdminClient) {
            const { data } = await supabaseAdminClient.storage
              .from(doc.storageBucket)
              .createSignedUrl(doc.storagePath, 60 * 60); // 1 hour
            signedUrl = data?.signedUrl ?? null;
          }
          return {
            ...doc,
            storageUrl: signedUrl || doc.storageUrl || null,
          };
        })
      );

      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents/upload", uploadRateLimiter, requireSupabaseUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    let documentRecord: Document | undefined;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!supabaseAdminClient) {
        return res.status(500).json({ error: "Storage is not configured" });
      }

      const userId = getUserId(req);
      const { originalname, mimetype, size, buffer } = req.file;
      const category = req.body.category || "organization-info";

      const bucket = process.env.DOCUMENTS_BUCKET || "documents";
      const sanitizedName = originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabaseAdminClient.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: mimetype,
          duplex: "half",
        });

      if (uploadError) {
        console.error("Supabase storage upload error:", uploadError);
        return res.status(500).json({ error: "Failed to store file" });
      }

      // Create document record
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

      // Process the file
      const processed = await fileProcessor.processFile(
        buffer,
        originalname,
        mimetype,
        documentRecord
      );

      // Update with processing results
      const updatedDocument = await storage.updateDocument(documentRecord.id, {
        summary: processed.summary,
        processed: true,
        processingStatus: "complete",
        summaryExtractedAt: new Date(),
        processedAt: new Date(),
        embeddingStatus: "pending",
      });

      if (!updatedDocument) {
        throw new Error("Failed to persist document metadata");
      }

      await storage.createProcessingJob(documentRecord.id, "embedding", "queued");

      // Run the embedding worker inline so newly uploaded documents are
      // immediately searchable. The job + cron pipeline still exists for
      // retries and backfills, but we don't rely on it for happy-path
      // latency (which matters more on Vercel Hobby where sub-daily crons
      // aren't available).
      try {
        const summary = await processDocumentJobs({ batchSize: 1 });
        console.log(`[upload] inline embedding for ${documentRecord.id}:`, summary);
      } catch (workerErr) {
        console.warn(
          `[upload] inline embedding failed for ${documentRecord.id}, relying on queue:`,
          workerErr
        );
      }

      const freshDocument = await storage.getDocument(documentRecord.id);

      res.json({
        ...(freshDocument ?? updatedDocument),
        summary: processed.summary,
        processed: true,
      });
    } catch (error) {
      console.error("Upload error:", error);
      if (documentRecord) {
        await storage.updateDocument(documentRecord.id, {
          processingStatus: "failed",
          processingError: error instanceof Error ? error.message : "Unknown error",
        });
        await storage.setDocumentExtraction(documentRecord.id, {
          rawText: "",
          rawTextBytes: 0,
          extractionStatus: "failed",
          extractionError: error instanceof Error ? error.message : "Unknown error",
        });
      }
      res.status(500).json({ error: "Failed to process upload" });
    }
  });

  app.delete("/api/documents/:id", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.storageBucket && document.storagePath && supabaseAdminClient) {
        const { error: removeError } = await supabaseAdminClient.storage
          .from(document.storageBucket)
          .remove([document.storagePath]);
        if (removeError) {
          console.error("Failed to delete document from storage:", removeError);
        }
      }

      const success = await storage.deleteDocument(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  app.post("/api/workers/process-documents", async (req, res) => {
    try {
      const expectedKey = process.env.DOCUMENT_WORKER_API_KEY;
      if (!expectedKey) {
        return res.status(500).json({ error: "Worker API key not configured" });
      }

      const headerValue = req.headers["x-api-key"] || req.headers["authorization"];
      let providedKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if (typeof providedKey === "string" && providedKey.startsWith("Bearer ")) {
        providedKey = providedKey.slice(7).trim();
      }

      if (typeof providedKey !== "string" || providedKey !== expectedKey) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const batchSize = Number(req.query.batchSize) || Number(process.env.DOCUMENT_WORKER_BATCH_SIZE || "5");
      const summary = await processDocumentJobs({ batchSize });

      res.json({
        ok: true,
        summary,
      });
    } catch (error: any) {
      console.error("Document worker endpoint failed:", error);
      res.status(500).json({ error: "Worker execution failed", details: error.message });
    }
  });

  // Vercel Cron trigger for the document worker. Vercel automatically
  // sends Authorization: Bearer <CRON_SECRET> for cron invocations
  // configured in vercel.json, so we verify that here. This lets us run
  // the embedding pipeline on a schedule without exposing the manual
  // DOCUMENT_WORKER_API_KEY.
  app.get("/api/cron/process-documents", async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        return res.status(500).json({ error: "CRON_SECRET not configured" });
      }

      const auth = req.headers["authorization"];
      const authValue = Array.isArray(auth) ? auth[0] : auth;
      if (authValue !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const batchSize = Number(req.query.batchSize) || Number(process.env.DOCUMENT_WORKER_BATCH_SIZE || "5");
      const summary = await processDocumentJobs({ batchSize });

      console.log("[cron] process-documents summary:", summary);
      res.json({ ok: true, summary });
    } catch (error: any) {
      console.error("Cron process-documents failed:", error);
      res.status(500).json({ error: "Cron execution failed", details: error.message });
    }
  });

  // Grant questions routes
  app.get("/api/projects/:projectId/questions", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const questions = await storage.getGrantQuestions(req.params.projectId);
      const enriched = await Promise.all(
        questions.map(async (question: any) => {
          const projectId = question.projectId ?? question.project_id ?? req.params.projectId;
          const rawCitations = await storage.getDraftCitations(question.id);
          const citations = await enrichCitationsFromDraftRows(rawCitations as any[]);
          const assumptions = await storage.getAssumptionLabels(projectId, question.id);
          return {
            ...question,
            citations,
            assumptions,
          };
        })
      );
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  app.post("/api/projects/:projectId/questions", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertGrantQuestionSchema.parse(req.body);
      const question = await storage.createGrantQuestion(req.params.projectId, validatedData);
      res.json(question);
    } catch (error: any) {
      console.error("Failed to create question:", error);
      
      // Check for specific error types
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid question data", details: error.errors });
      }
      
      // Database constraint errors (e.g., foreign key violation)
      if (error.code === '23503') {
        return res.status(400).json({ error: "Invalid project ID - project does not exist" });
      }
      
      // Return 500 for unexpected server errors
      res.status(500).json({ error: "Failed to create question", details: error.message });
    }
  });

  app.post("/api/questions/:id/generate", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    let questionId = req.params.id;
    
    try {
      const question = await storage.getGrantQuestion(questionId);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Update status to generating
      console.log(`Starting AI generation for question ${questionId}: ${question.question.substring(0, 100)}...`);
      try {
        await storage.updateGrantQuestion(questionId, { responseStatus: "generating" });
      } catch (statusErr) {
        console.warn(`[generate] Could not mark question ${questionId} as generating:`, statusErr);
      }

      const userId = getUserId(req);
      const { tone = "professional", emphasisAreas = [] } = req.body;

      // Get user context from documents
      const documents = await storage.getDocuments(userId).catch((err) => {
        console.warn(`[generate] getDocuments failed:`, err);
        return [] as Awaited<ReturnType<typeof storage.getDocuments>>;
      });

      const processedDocs = documents.filter((doc) => doc.processed && doc.summary);
      const organizationContext = processedDocs
        .map((doc) => `${doc.originalName}: ${doc.summary}`)
        .join('\n');

      // Retrieval requires the document pipeline tables (doc_chunks, etc.).
      // If that migration hasn't been applied to the connected DB, we don't
      // want to fail the whole generation — fall back to no chunks.
      let retrievalResult: Awaited<ReturnType<typeof retrieveRelevantChunks>> = {
        query: question.question,
        chunks: [],
        embeddingGenerated: false,
      };
      try {
        retrievalResult = await retrieveRelevantChunks({
          userId,
          query: question.question,
          limit: 8,
          semanticLimit: 8,
          keywordLimit: 4,
        });
      } catch (retrievalErr) {
        console.warn(`[generate] retrieveRelevantChunks failed, continuing without context:`, retrievalErr);
      }

      const topSimilarity = retrievalResult.chunks[0]?.similarity;
      const semanticCount = retrievalResult.chunks.filter((c) => c.source === "semantic").length;
      const keywordCount = retrievalResult.chunks.filter((c) => c.source === "keyword").length;
      console.log(
        `[generate q=${questionId}] retrieved ${retrievalResult.chunks.length} chunks ` +
          `(semantic=${semanticCount}, keyword=${keywordCount}, ` +
          `topSim=${typeof topSimilarity === "number" ? topSimilarity.toFixed(2) : "n/a"}, ` +
          `embeddingGenerated=${retrievalResult.embeddingGenerated})`
      );

      const user = await storage.getUser(userId).catch(() => undefined);

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

        // Persist citations/assumptions best-effort. These tables are not
        // strictly required for the user to see a generated response; a
        // missing-table / schema-drift error here should not 500 the request.
        try {
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
        } catch (citationErr) {
          console.warn(`[generate] Failed to persist draft citations:`, citationErr);
        }

        if (projectId) {
          try {
            await storage.deleteAssumptionLabels(projectId, question.id);
            for (const raw of grounded.assumptions || []) {
              const assumptionText =
                typeof raw === "string"
                  ? raw.trim()
                  : typeof (raw as any)?.text === "string"
                    ? (raw as any).text.trim()
                    : "";
              if (!assumptionText) continue;
              await storage.createAssumptionLabel({
                projectId,
                draftId: question.id,
                text: assumptionText,
                category: "context_gap",
                confidence: 50,
                suggestedQuestion: assumptionText,
                position: { start: 0, end: 0 },
              });
            }
          } catch (assumptionErr) {
            console.warn(`[generate] Failed to persist assumption labels:`, assumptionErr);
          }
        }

        const responseText = (grounded.text || '').trim();
        
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

        // Create response version (best-effort)
        try {
          const versions = await storage.getResponseVersions(question.id);
          const nextVersion = versions.length + 1;
          await storage.createResponseVersion(question.id, responseText, tone, nextVersion);
        } catch (versionErr) {
          console.warn(`[generate] Failed to persist response version:`, versionErr);
        }

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
        
        // Determine failure type and set appropriate status
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
        
        // Update status to reflect the specific failure type
        await storage.updateGrantQuestion(questionId, { 
          responseStatus: failureStatus,
          errorMessage 
        });
        
        // This shouldn't happen with our new fallback system, but just in case
        throw new Error(`AI generation failed: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error(`Generation endpoint error for question ${questionId}:`, error);
      
      try {
        // Ensure status is updated even if other errors occur
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

  // Retry endpoint for failed/timeout questions
  app.post("/api/questions/:id/retry", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    const questionId = req.params.id;
    
    try {
      const question = await storage.getGrantQuestion(questionId);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Check if question is in a retryable state
      const retryableStatuses = ["failed", "timeout", "needs_context"];
      if (!retryableStatuses.includes(question.responseStatus || "")) {
        return res.status(400).json({ 
          error: "Question is not in a retryable state",
          currentStatus: question.responseStatus
        });
      }

      console.log(`Retrying AI generation for question ${questionId} (previous status: ${question.responseStatus})`);

      // Reset status and error message
      await storage.updateGrantQuestion(questionId, { 
        responseStatus: "pending",
        errorMessage: null
      });

      // Forward to the regular generation endpoint by making an internal request
      const { tone = "professional", emphasisAreas = [] } = req.body;
      
      // Rather than duplicating logic, we'll redirect to the generate endpoint
      res.status(200).json({ 
        message: "Retry initiated", 
        status: "pending",
        retryId: questionId
      });

      // Note: The frontend should then call the regular generate endpoint
      // This approach avoids code duplication while providing clear status updates

    } catch (error: any) {
      console.error(`Retry endpoint error for question ${questionId}:`, error);
      res.status(500).json({ 
        error: "Failed to initiate retry",
        details: error.message
      });
    }
  });

  // Update question response directly
  app.put("/api/questions/:id/response", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const questionId = req.params.id;
      const { content, preserveVersion = false } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Valid content is required" });
      }

      const question = await storage.getGrantQuestion(questionId);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Calculate word count
      const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
      
      // Check word limit if specified
      if (question.wordLimit && wordCount > question.wordLimit) {
        return res.status(400).json({ 
          error: "Content exceeds word limit",
          wordCount,
          limit: question.wordLimit
        });
      }

      // If preserving version, create a new version entry
      if (preserveVersion) {
        const versions = await storage.getResponseVersions(questionId);
        const nextVersion = versions.length + 1;
        
        await storage.createResponseVersion(questionId, content, "edited", nextVersion);
      }

      // Update the main response
      const updatedQuestion = await storage.updateGrantQuestion(questionId, {
        response: content,
        responseStatus: question.response !== content ? "edited" : question.responseStatus
      });

      res.json({
        id: questionId,
        content: content,
        lastModified: new Date(),
        status: updatedQuestion?.responseStatus ?? question.responseStatus,
        wordCount: wordCount
      });

    } catch (error) {
      console.error("Response update error:", error);
      res.status(500).json({ error: "Failed to update response" });
    }
  });

  // Response versions routes
  app.get("/api/questions/:questionId/versions", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const versions = await storage.getResponseVersions(req.params.questionId);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  app.post("/api/questions/:questionId/versions/:versionId/current", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const success = await storage.setCurrentVersion(req.params.questionId, req.params.versionId);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: "Failed to set current version" });
    }
  });

  // User settings routes
  app.get("/api/settings", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        // Create default settings
        settings = await storage.createUserSettings(userId, {
          defaultTone: "professional",
          lengthPreference: "balanced",
          emphasisAreas: ["Impact & Outcomes", "Innovation", "Sustainability", "Community Engagement"],
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
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const validatedData = insertUserSettingsSchema.parse(req.body);
      const settings = await storage.updateUserSettings(userId, validatedData);
      
      if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
      }
      
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: "Invalid settings data" });
    }
  });

  // Stats routes
  app.get("/api/stats", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ----- Grant Metrics -----
  // Helper: verify the caller owns the given project.
  async function assertProjectAccess(req: AuthenticatedRequest, projectId: string) {
    const userId = getUserId(req);
    const project = await storage.getProject(projectId);
    if (!project) return { ok: false as const, status: 404, error: "Project not found" };
    if (project.userId !== userId) {
      return { ok: false as const, status: 403, error: "Forbidden" };
    }
    return { ok: true as const, project, userId };
  }

  async function assertMetricAccess(req: AuthenticatedRequest, metricId: string) {
    const metric = await storage.getGrantMetric(metricId);
    if (!metric) return { ok: false as const, status: 404, error: "Metric not found" };
    const access = await assertProjectAccess(req, metric.projectId);
    if (!access.ok) return access;
    return { ok: true as const, metric, userId: access.userId };
  }

  function formatReportMetricValue(
    value: string | null | undefined,
    type: string,
    unit: string | null | undefined,
  ) {
    if (!value) return "Not recorded";
    if (type === "currency") {
      const n = Number(value);
      return Number.isFinite(n)
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(n)
        : value;
    }
    if (type === "percent") {
      const n = Number(value);
      return Number.isFinite(n) ? `${n}%` : value;
    }
    if (type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) return value;
      return unit ? `${n.toLocaleString("en-US")} ${unit}` : n.toLocaleString("en-US");
    }
    if (type === "date") {
      const d = new Date(value);
      return Number.isNaN(d.getTime())
        ? value
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return value;
  }

  function reportProgress(value: string | null | undefined, target: string | null | undefined) {
    if (!value || !target) return "";
    const v = Number(value);
    const t = Number(target);
    if (!Number.isFinite(v) || !Number.isFinite(t) || t === 0) return "";
    const pct = Math.max(0, Math.min(100, Math.round((v / t) * 100)));
    return ` (${pct}% of target)`;
  }

  function formatReportDate(value: Date | string | null | undefined) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatReportPeriod(event: { periodStart?: Date | string | null; periodEnd?: Date | string | null }) {
    const start = formatReportDate(event.periodStart);
    const end = formatReportDate(event.periodEnd);
    if (start && end) return `${start} - ${end}`;
    if (start) return `from ${start}`;
    if (end) return `through ${end}`;
    return "";
  }

  function parseOptionalDate(value: unknown, fieldName: string): Date | null {
    if (value === null || value === undefined || value === "") return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Invalid ${fieldName}`);
    }
    return d;
  }

  app.get(
    "/api/projects/:projectId/metrics",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertProjectAccess(req, req.params.projectId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const includeDismissed = req.query.includeDismissed === "true";
        const [metrics, applicationMetrics, metricPresets] = await Promise.all([
          storage.getGrantMetrics(req.params.projectId, { includeDismissed }),
          (await import("./services/metrics.js")).computeApplicationMetrics(
            req.params.projectId,
          ),
          Promise.resolve((await import("./services/metrics.js")).METRIC_PRESETS),
        ]);
        res.json({
          metrics,
          application: applicationMetrics,
          presets: metricPresets,
          project: {
            id: access.project.id,
            amountRequested: (access.project as any).amountRequested ?? null,
            amountAwarded: (access.project as any).amountAwarded ?? null,
            awardedAt: (access.project as any).awardedAt ?? null,
            reportingDueAt: (access.project as any).reportingDueAt ?? null,
          },
        });
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
        res.status(500).json({ error: "Failed to fetch metrics" });
      }
    },
  );

  app.get(
    "/api/projects/:projectId/metrics/report-summary",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertProjectAccess(req, req.params.projectId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const metrics = await storage.getGrantMetrics(req.params.projectId);
        const activeMetrics = metrics.filter(m => m.status === "active");
        const lines = await Promise.all(
          activeMetrics.map(async metric => {
            const value = formatReportMetricValue(metric.value, metric.type, metric.unit);
            const target = metric.target
              ? formatReportMetricValue(metric.target, metric.type, metric.unit)
              : null;
            const events = await storage.getGrantMetricEvents(metric.id);
            const latest = events[0];
            const details: string[] = [];
            if (latest) {
              const period = formatReportPeriod(latest);
              if (period) details.push(`period ${period}`);
              if (latest.status && latest.status !== "recorded") details.push(`status ${latest.status}`);
              if (latest.note) details.push(`note: ${latest.note}`);
              if ((latest as any).evidenceUrl) details.push(`evidence: ${(latest as any).evidenceUrl}`);
            }
            return `- ${metric.label}: ${value}${target ? ` of ${target}` : ""}${reportProgress(metric.value, metric.target)}${
              details.length ? `; ${details.join("; ")}` : ""
            }`;
          })
        );

        const text = [
          `Grant Metrics Report Summary: ${access.project.title}`,
          `Funder: ${access.project.funder}`,
          "",
          ...(lines.length ? lines : ["No active metrics have been recorded yet."]),
        ].join("\n");

        res.json({ text, metricsCount: activeMetrics.length });
      } catch (error: any) {
        console.error("Failed to build metrics report summary:", error);
        res.status(500).json({ error: "Failed to build metrics report summary", details: error?.message });
      }
    },
  );

  app.post(
    "/api/projects/:projectId/metrics",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertProjectAccess(req, req.params.projectId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const body = req.body ?? {};
        const { getPreset } = await import("./services/metrics.js");
        const preset = body.presetKey ? getPreset(String(body.presetKey)) : undefined;

        const metric = await storage.createGrantMetric({
          projectId: req.params.projectId,
          key: String(body.key ?? preset?.key ?? `metric_${Date.now()}`),
          label: String(body.label ?? preset?.label ?? "Untitled metric"),
          type: String(body.type ?? preset?.type ?? "number"),
          value: body.value != null ? String(body.value) : null,
          target: body.target != null ? String(body.target) : null,
          unit: body.unit ?? preset?.unit ?? null,
          category: String(body.category ?? preset?.category ?? "custom"),
          source: preset ? "preset" : (body.source ?? "manual"),
          status: body.status ?? "active",
          sortOrder: body.sortOrder ?? 0,
          rationale: body.rationale ?? null,
        } as any);

        if (metric.value) {
          await storage.createGrantMetricEvent({
            metricId: metric.id,
            value: metric.value,
            note: "Initial value",
            recordedBy: access.userId,
          } as any);
        }
        res.json(metric);
      } catch (error: any) {
        console.error("Failed to create metric:", error);
        res.status(500).json({ error: "Failed to create metric", details: error?.message });
      }
    },
  );

  app.patch(
    "/api/metrics/:id",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertMetricAccess(req, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const body = req.body ?? {};
        const updates: Record<string, unknown> = {};
        const fields = [
          "label",
          "type",
          "value",
          "target",
          "unit",
          "category",
          "status",
          "sortOrder",
          "rationale",
        ] as const;
        for (const f of fields) {
          if (f in body) updates[f] = (body as any)[f];
        }

        const prev = access.metric;
        const updated = await storage.updateGrantMetric(req.params.id, updates as any);

        // Record an event when the value changed.
        if ("value" in updates && updates.value !== prev.value && updated?.value != null) {
          await storage.createGrantMetricEvent({
            metricId: updated.id,
            value: String(updated.value),
            note: body.note ? String(body.note) : null,
            recordedBy: access.userId,
          } as any);
        }
        res.json(updated);
      } catch (error: any) {
        console.error("Failed to update metric:", error);
        res.status(500).json({ error: "Failed to update metric", details: error?.message });
      }
    },
  );

  app.post(
    "/api/metrics/:id/accept",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertMetricAccess(req, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const updated = await storage.updateGrantMetric(req.params.id, { status: "active" });
        res.json(updated);
      } catch (error) {
        res.status(500).json({ error: "Failed to accept metric" });
      }
    },
  );

  app.post(
    "/api/metrics/:id/dismiss",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertMetricAccess(req, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const updated = await storage.updateGrantMetric(req.params.id, { status: "dismissed" });
        res.json(updated);
      } catch (error) {
        res.status(500).json({ error: "Failed to dismiss metric" });
      }
    },
  );

  app.delete(
    "/api/metrics/:id",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertMetricAccess(req, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const ok = await storage.deleteGrantMetric(req.params.id);
        res.json({ ok });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete metric" });
      }
    },
  );

  app.get(
    "/api/metrics/:id/history",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertMetricAccess(req, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const events = await storage.getGrantMetricEvents(req.params.id);
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch metric history" });
      }
    },
  );

  app.post(
    "/api/metrics/:id/events",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertMetricAccess(req, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const body = req.body ?? {};
        const rawValue = body.value;
        const value =
          rawValue === null || rawValue === undefined ? "" : String(rawValue).trim();

        if (!value) {
          return res.status(400).json({ error: "Metric value is required" });
        }

        const updated = await storage.updateGrantMetric(req.params.id, { value } as any);
        if (!updated) {
          return res.status(404).json({ error: "Metric not found" });
        }

        const note =
          body.note === null || body.note === undefined ? "" : String(body.note).trim();
        const periodStart = parseOptionalDate(body.periodStart, "periodStart");
        const periodEnd = parseOptionalDate(body.periodEnd, "periodEnd");
        if (periodStart && periodEnd && periodStart.getTime() > periodEnd.getTime()) {
          return res.status(400).json({ error: "periodStart must be before periodEnd" });
        }
        const evidenceUrl =
          body.evidenceUrl === null || body.evidenceUrl === undefined
            ? ""
            : String(body.evidenceUrl).trim();
        const sourceDocumentId =
          body.sourceDocumentId === null || body.sourceDocumentId === undefined
            ? ""
            : String(body.sourceDocumentId).trim();
        const status =
          body.status === "submitted" || body.status === "accepted" ? body.status : "recorded";

        const event = await storage.createGrantMetricEvent({
          metricId: updated.id,
          value,
          note: note || null,
          periodStart,
          periodEnd,
          evidenceUrl: evidenceUrl || null,
          sourceDocumentId: sourceDocumentId || null,
          status,
          recordedBy: access.userId,
        } as any);

        res.json({ metric: updated, event });
      } catch (error: any) {
        console.error("Failed to record metric update:", error);
        res.status(500).json({ error: "Failed to record metric update", details: error?.message });
      }
    },
  );

  app.get(
    "/api/metrics/portfolio",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = getUserId(req);
        const projects = await storage.getProjects(userId);
        const projectIds = projects.map(p => p.id);
        const metrics = await storage.getMetricsForProjects(projectIds);
        const stats = await storage.getUserStats(userId);
        const periodStart = parseOptionalDate(req.query.periodStart, "periodStart");
        const periodEnd = parseOptionalDate(req.query.periodEnd, "periodEnd");
        if (periodStart && periodEnd && periodStart.getTime() > periodEnd.getTime()) {
          return res.status(400).json({ error: "periodStart must be before periodEnd" });
        }

        // Aggregate totals by key across active metrics (numeric types only).
        const activeMetrics = metrics.filter(m => m.status === "active");
        const byKey: Record<string, { label: string; unit: string | null; type: string; total: number; count: number }> = {};
        const metricEvents = new Map<string, Awaited<ReturnType<typeof storage.getGrantMetricEvents>>>();

        await Promise.all(
          activeMetrics.map(async metric => {
            metricEvents.set(metric.id, await storage.getGrantMetricEvents(metric.id));
          })
        );

        const eventInPeriod = (event: any) => {
          const recordedAt = event.recordedAt ? new Date(event.recordedAt) : null;
          if (!recordedAt || Number.isNaN(recordedAt.getTime())) return false;
          if (periodStart && recordedAt < periodStart) return false;
          if (periodEnd && recordedAt > periodEnd) return false;
          return true;
        };

        for (const m of activeMetrics) {
          if (m.type !== "number" && m.type !== "currency" && m.type !== "percent") continue;
          const periodEvent = (periodStart || periodEnd)
            ? metricEvents.get(m.id)?.find(eventInPeriod)
            : undefined;
          const n = Number(periodEvent?.value ?? m.value);
          if (!Number.isFinite(n)) continue;
          const bucket = byKey[m.key] ?? {
            label: m.label,
            unit: m.unit,
            type: m.type,
            total: 0,
            count: 0,
          };
          bucket.total += n;
          bucket.count += 1;
          byKey[m.key] = bucket;
        }

        const metricsByProject = new Map<string, typeof activeMetrics>();
        for (const metric of activeMetrics) {
          const existing = metricsByProject.get(metric.projectId) ?? [];
          existing.push(metric);
          metricsByProject.set(metric.projectId, existing);
        }

        res.json({
          stats,
          projects: projects.map(p => {
            const projectMetrics = metricsByProject.get(p.id) ?? [];
            const updateCount = projectMetrics.reduce((sum, metric) => {
              const events = metricEvents.get(metric.id) ?? [];
              return sum + events.filter(eventInPeriod).length;
            }, 0);
            return {
              id: p.id,
              title: p.title,
              funder: p.funder,
              status: p.status,
              deadline: p.deadline,
              amountRequested: (p as any).amountRequested ?? null,
              amountAwarded: (p as any).amountAwarded ?? null,
              metricsTracked: projectMetrics.length,
              metricsMissingValues: projectMetrics.filter(metric => !metric.value).length,
              metricUpdatesInPeriod: updateCount,
            };
          }),
          totalsByKey: byKey,
          metrics: activeMetrics,
        });
      } catch (error) {
        console.error("Failed to fetch portfolio metrics:", error);
        res.status(500).json({ error: "Failed to fetch portfolio metrics" });
      }
    },
  );

  // Ad-hoc extraction: upload a file and preview suggestions without persisting.
  app.post(
    "/api/projects/:projectId/metrics/extract",
    uploadRateLimiter,
    requireSupabaseUser,
    upload.single("file"),
    async (req: AuthenticatedRequest, res) => {
      const access = await assertProjectAccess(req, req.params.projectId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      try {
        const suggestions = await fileProcessor.extractMetricsFromFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        );
        res.json({ suggestions });
      } catch (error: any) {
        console.error("Metric extraction failed:", error);
        res.status(500).json({ error: "Failed to extract metrics", details: error?.message });
      }
    },
  );

  // Bulk accept a batch of suggestions (typically coming from the extract preview).
  app.post(
    "/api/projects/:projectId/metrics/bulk",
    requireSupabaseUser,
    async (req: AuthenticatedRequest, res) => {
      const access = await assertProjectAccess(req, req.params.projectId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      try {
        const suggestions = Array.isArray(req.body?.suggestions) ? req.body.suggestions : [];
        const status = req.body?.status === "suggested" ? "suggested" : "active";
        const source = req.body?.source ?? "ai_suggested";
        const rows = suggestions
          .filter((s: any) => s && s.key && s.label && s.type && s.category)
          .map((s: any) => ({
            projectId: req.params.projectId,
            key: String(s.key),
            label: String(s.label),
            type: String(s.type),
            target: s.target != null ? String(s.target) : null,
            unit: s.unit ?? null,
            category: String(s.category),
            source,
            status,
            confidence: typeof s.confidence === "number" ? s.confidence : null,
            rationale: s.rationale ?? null,
            sourceDocumentId: s.sourceDocumentId ?? null,
          }));
        const created = await storage.createGrantMetrics(rows as any);
        res.json({ created });
      } catch (error: any) {
        console.error("Bulk metric create failed:", error);
        res.status(500).json({ error: "Failed to create metrics", details: error?.message });
      }
    },
  );

  // File extraction route
  app.post("/api/extract-questions", uploadRateLimiter, requireSupabaseUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const questions = await fileProcessor.extractQuestionsFromFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      res.json({ questions });
    } catch (error) {
      console.error("Question extraction error:", error);
      res.status(500).json({ error: "Failed to extract questions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
