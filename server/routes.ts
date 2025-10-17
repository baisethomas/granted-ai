import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { aiService } from "./services/ai.js";
import { fileProcessor } from "./services/fileProcessor.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertProjectSchema, insertGrantQuestionSchema, insertUserSettingsSchema, type DocumentProcessingJob, type Document } from "@shared/schema";
import { requireSupabaseUser, supabaseAdminClient, type AuthenticatedRequest } from "./middleware/supabaseAuth.js";

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

  app.post("/api/documents/upload", requireSupabaseUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    let documentRecord: Document | undefined;
    let processingJob: DocumentProcessingJob | undefined;
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

      processingJob = await storage.createProcessingJob(
        documentRecord.id,
        "extraction",
        "running"
      );

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
      });

      if (!updatedDocument) {
        throw new Error("Failed to persist document metadata");
      }

      await storage.updateProcessingJob(processingJob.id, {
        status: "succeeded",
        finishedAt: new Date(),
        lastError: null,
      });

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
      if (processingJob) {
        await storage.updateProcessingJob(processingJob.id, {
          status: "failed",
          finishedAt: new Date(),
          lastError: error instanceof Error ? error.message : "Unknown error",
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

  // Grant questions routes
  app.get("/api/projects/:projectId/questions", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const questions = await storage.getGrantQuestions(req.params.projectId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  app.post("/api/projects/:projectId/questions", requireSupabaseUser, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertGrantQuestionSchema.parse(req.body);
      const question = await storage.createGrantQuestion(req.params.projectId, validatedData);
      res.json(question);
    } catch (error) {
      res.status(400).json({ error: "Invalid question data" });
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
      
      // Build comprehensive organizational context
      let context = '';
      if (documents && documents.length > 0) {
        const processedDocs = documents.filter(d => d.processed && d.summary);
        
        if (processedDocs.length > 0) {
          context = 'ORGANIZATIONAL CONTEXT:\n\n';
          
          // Group documents by category for better context organization
          const docsByCategory = processedDocs.reduce((acc, doc) => {
            const category = doc.category || 'general';
            if (!acc[category]) acc[category] = [];
            acc[category].push(doc);
            return acc;
          }, {} as Record<string, any[]>);
          
          // Format context by category
          Object.entries(docsByCategory).forEach(([category, docs]) => {
            context += `${category.toUpperCase().replace(/-/g, ' ')}:\n`;
            docs.forEach(doc => {
              context += `• ${doc.originalName}: ${doc.summary}\n`;
            });
            context += '\n';
          });
        }
      }
      
      console.log(`Generated context for user ${userId} (${context.length} chars):`, context.substring(0, 500) + '...');

      // Get user info
      const user = await storage.getUser(userId);

      try {
        const startTime = Date.now();
        
        // Generate response with enhanced error handling
        const response = await aiService.generateGrantResponse({
          question: question.question,
          context,
          tone,
          wordLimit: question.wordLimit || undefined,
          emphasisAreas,
          organizationInfo: user
        });
        
        const duration = Date.now() - startTime;
        console.log(`AI generation completed in ${duration}ms for question ${questionId}`);

        // Determine the status based on the response type
        let responseStatus: string;
        let errorMessage: string | null = null;
        
        if (response.includes("I'm having trouble generating a detailed response")) {
          responseStatus = "timeout";
          errorMessage = "Generation timed out - please try again";
        } else if (response.includes("Based on the available information, I need additional details")) {
          responseStatus = "needs_context";
          errorMessage = "Insufficient context - please add more organizational documents";
        } else if (response.includes("Unable to generate AI response at this time")) {
          responseStatus = "failed";
          errorMessage = "AI service error - please try again";
        } else {
          responseStatus = "complete";
        }

        console.log(`Setting response status to: ${responseStatus} for question ${questionId}`);

        // Create response version
        const versions = await storage.getResponseVersions(question.id);
        const nextVersion = versions.length + 1;
        
        await storage.createResponseVersion(question.id, response, tone, nextVersion);

        // Update question with response and status
        const updatedQuestion = await storage.updateGrantQuestion(questionId, {
          response,
          responseStatus,
          ...(errorMessage && { errorMessage })
        });

        // Return appropriate status code based on result
        if (responseStatus === "complete") {
          res.json(updatedQuestion);
        } else {
          res.status(206).json({ // 206 Partial Content - request completed but with limitations
            ...updatedQuestion,
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
  app.post("/api/extract-questions", requireSupabaseUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
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
