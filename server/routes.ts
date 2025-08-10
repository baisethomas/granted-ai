import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { aiService } from "./services/ai.js";
import { fileProcessor } from "./services/fileProcessor.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertProjectSchema, insertGrantQuestionSchema, insertUserSettingsSchema } from "@shared/schema";

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
  app.get("/api/projects", async (req, res) => {
    try {
      // In a real app, get userId from session/auth
      const userId = "demo-user"; // Placeholder
      const projects = await storage.getProjects(userId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const userId = "demo-user"; // Placeholder
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(userId, validatedData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
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

  app.put("/api/projects/:id", async (req, res) => {
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

  // Documents routes
  app.get("/api/documents", async (req, res) => {
    try {
      const userId = "demo-user"; // Placeholder
      const documents = await storage.getDocuments(userId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = "demo-user"; // Placeholder
      const { originalname, filename, mimetype, size } = req.file;
      const category = req.body.category || "organization-info";

      // Read file buffer
      const filePath = path.join('uploads', filename);
      const buffer = fs.readFileSync(filePath);

      // Process the file
      const processed = await fileProcessor.processFile(buffer, originalname, mimetype);

      // Create document record
      const document = await storage.createDocument(userId, {
        filename,
        originalName: originalname,
        fileType: mimetype,
        fileSize: size,
        category
      });

      // Update with processing results
      await storage.updateDocument(document.id, {
        summary: processed.summary,
        processed: true
      });

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({ ...document, summary: processed.summary, processed: true });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process upload" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
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
  app.get("/api/projects/:projectId/questions", async (req, res) => {
    try {
      const questions = await storage.getGrantQuestions(req.params.projectId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  app.post("/api/projects/:projectId/questions", async (req, res) => {
    try {
      const validatedData = insertGrantQuestionSchema.parse(req.body);
      const question = await storage.createGrantQuestion(req.params.projectId, validatedData);
      res.json(question);
    } catch (error) {
      res.status(400).json({ error: "Invalid question data" });
    }
  });

  app.post("/api/questions/:id/generate", async (req, res) => {
    try {
      const question = await storage.getGrantQuestion(req.params.id);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Update status to generating
      await storage.updateGrantQuestion(req.params.id, { responseStatus: "generating" });

      const userId = "demo-user"; // Placeholder
      const { tone = "professional", emphasisAreas = [] } = req.body;

      // Get user context from documents
      const documents = await storage.getDocuments(userId);
      const context = documents
        .filter(d => d.processed && d.summary)
        .map(d => `${d.originalName}: ${d.summary}`)
        .join('\n\n');

      // Get user info
      const user = await storage.getUser(userId);

      try {
        // Generate response
        const response = await aiService.generateGrantResponse({
          question: question.question,
          context,
          tone,
          wordLimit: question.wordLimit || undefined,
          emphasisAreas,
          organizationInfo: user
        });

        // Create response version
        const versions = await storage.getResponseVersions(question.id);
        const nextVersion = versions.length + 1;
        
        await storage.createResponseVersion(question.id, response, tone, nextVersion);

        // Update question with response and status
        const updatedQuestion = await storage.updateGrantQuestion(req.params.id, {
          response,
          responseStatus: "complete"
        });

        res.json(updatedQuestion);
      } catch (aiError) {
        // Update status to failed
        await storage.updateGrantQuestion(req.params.id, { responseStatus: "pending" });
        throw aiError;
      }
    } catch (error) {
      console.error("Generation error:", error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  // Response versions routes
  app.get("/api/questions/:questionId/versions", async (req, res) => {
    try {
      const versions = await storage.getResponseVersions(req.params.questionId);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  app.post("/api/questions/:questionId/versions/:versionId/current", async (req, res) => {
    try {
      const success = await storage.setCurrentVersion(req.params.questionId, req.params.versionId);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: "Failed to set current version" });
    }
  });

  // User settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const userId = "demo-user"; // Placeholder
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

  app.put("/api/settings", async (req, res) => {
    try {
      const userId = "demo-user"; // Placeholder
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
  app.get("/api/stats", async (req, res) => {
    try {
      const userId = "demo-user"; // Placeholder
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // File extraction route
  app.post("/api/extract-questions", upload.single('file'), async (req, res) => {
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
