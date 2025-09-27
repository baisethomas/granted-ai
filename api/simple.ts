import express from "express";
import multer from "multer";

const app = express();

// Simple in-memory storage
let documents: any[] = [];
let nextId = 1;

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

// Simple endpoints for other pages
app.get("/api/projects", (req, res) => res.json([]));
app.get("/api/stats", (req, res) => res.json({ activeProjects: 0 }));
app.get("/api/settings", (req, res) => res.json({ defaultTone: "professional" }));
app.get("/api/projects/:id/questions", (req, res) => res.json([]));

// Health check
app.get("/api/status", (req, res) => {
  res.json({
    api: "simple-version",
    documents: documents.length,
    timestamp: new Date().toISOString()
  });
});

export default app;