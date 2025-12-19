import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { aiService } from "./services/ai.js";
import { fileProcessor } from "./services/fileProcessor.js";
import { retrieveRelevantChunks } from "./services/retrieval.js";
import { processDocumentJobs } from "./workers/documentProcessor.js";
import multer from "multer";
import path from "path";
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

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }

  // Projects routes
  app.get("/api/projects", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req);
      const projects = await storage.getProjects(userId);
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
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.put("/api/projects/:id", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
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
    try {
      const userId = getUserId(req);
      const projectId = req.params.id;
      
      console.log(`DELETE request for project ${projectId} by user ${userId}`);
      
      const project = await storage.getProject(projectId);
      
      if (!project) {
        console.log(`Project ${projectId} not found in database`);
        return res.status(404).json({ error: "Project not found", message: "This project does not exist or has already been deleted." });
      }

      // Verify the project belongs to the user
      if (project.userId !== userId) {
        console.log(`User ${userId} attempted to delete project ${projectId} owned by ${project.userId}`);
        return res.status(403).json({ error: "Unauthorized to delete this project", message: "You don't have permission to delete this project." });
      }

      const deleted = await storage.deleteProject(projectId);
      
      if (!deleted) {
        console.error(`Failed to delete project ${projectId} from storage`);
        return res.status(500).json({ error: "Failed to delete project", message: "An error occurred while deleting the project." });
      }

      console.log(`Project ${projectId} successfully deleted by user ${userId}`);
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Failed to delete project:", error);
      res.status(500).json({ error: "Failed to delete project", message: error instanceof Error ? error.message : "An unexpected error occurred" });
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
    const tempFiles: string[] = [];
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!supabaseAdminClient) {
        return res.status(500).json({ error: "Storage is not configured" });
      }

      const userId = getUserId(req);
      const { originalname, filename, mimetype, size } = req.file;
      const category = req.body.category || "organization-info";

      // Read file buffer
      const filePath = path.join('uploads', filename);
      const buffer = fs.readFileSync(filePath);
      tempFiles.push(filePath);

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

      // Clean up uploaded file
      res.json({
        ...updatedDocument,
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
    } finally {
      tempFiles.forEach((file) => {
        try {
          fs.existsSync(file) && fs.unlinkSync(file);
        } catch (cleanupError) {
          console.warn("Failed to clean temp upload:", cleanupError);
        }
      });
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

  // Grant questions routes
  app.get("/api/projects/:projectId/questions", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const questions = await storage.getGrantQuestions(req.params.projectId);
      const enriched = await Promise.all(
        questions.map(async (question: any) => {
          const projectId = question.projectId ?? question.project_id ?? req.params.projectId;
          const citations = await storage.getDraftCitations(question.id);
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
        status: updatedQuestion.responseStatus,
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

  // File extraction route
  app.post("/api/extract-questions", uploadRateLimiter, requireSupabaseUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { filename, mimetype } = req.file;
      const filePath = path.join('uploads', filename);
      const buffer = fs.readFileSync(filePath);

      const questions = await fileProcessor.extractQuestionsFromFile(buffer, req.file.originalname, mimetype);

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({ questions });
    } catch (error) {
      console.error("Question extraction error:", error);
      res.status(500).json({ error: "Failed to extract questions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
