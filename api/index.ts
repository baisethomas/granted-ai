// Minimal test to isolate crash cause
import { config } from "dotenv";
config();

import express from "express";

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Test adding imports one by one
app.get('/test-imports', async (req, res) => {
  const results: any = {};

  try {
    console.log('Testing hybrid-auth import...');
    const hybridAuth = await import("../server/hybrid-auth");
    results.hybridAuth = 'success';
  } catch (error) {
    console.error('hybrid-auth failed:', error);
    results.hybridAuth = error instanceof Error ? error.message : 'failed';
  }

  try {
    console.log('Testing fileProcessor import...');
    const fileProc = await import("../server/services/fileProcessor");
    results.fileProcessor = 'success';
  } catch (error) {
    console.error('fileProcessor failed:', error);
    results.fileProcessor = error instanceof Error ? error.message : 'failed';
  }

  try {
    console.log('Testing multer import...');
    const multer = await import("multer");
    results.multer = 'success';
  } catch (error) {
    console.error('multer failed:', error);
    results.multer = error instanceof Error ? error.message : 'failed';
  }

  res.json({
    status: 'Import test results',
    results,
    timestamp: new Date().toISOString()
  });
});

// Basic routes
app.get('/', (req, res) => {
  res.json({
    message: 'Grant Writing Platform API - Testing imports',
    status: 'working',
    timestamp: new Date().toISOString(),
    test: 'Visit /test-imports to see what is causing crashes'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message,
    stack: err.stack
  });
});

export default app;