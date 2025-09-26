// Testing auth setup integration
import { config } from "dotenv";
config();

import express from "express";
import { setupAuth } from "../server/auth";

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Test routes before auth
app.get('/test-before-auth', (req, res) => {
  res.json({
    message: 'This route works before auth setup',
    timestamp: new Date().toISOString()
  });
});

try {
  // Setup auth - this might be what's crashing
  console.log('Setting up auth...');
  setupAuth(app);
  console.log('Auth setup completed');
} catch (error) {
  console.error('Auth setup failed:', error);
  app.get('/auth-error', (req, res) => {
    res.status(500).json({
      error: 'Auth setup failed',
      message: error instanceof Error ? error.message : 'Unknown auth error',
      stack: error instanceof Error ? error.stack : undefined
    });
  });
}

// Test routes after auth
app.get('/', (req, res) => {
  res.json({
    message: 'Grant Writing Platform API with Express + Auth',
    status: 'running',
    timestamp: new Date().toISOString(),
    express: 'working',
    auth: 'attempted'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    express: 'working',
    auth: 'attempted',
    environment: process.env.NODE_ENV
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Express error',
    message: err.message,
    stack: err.stack
  });
});

// Export for Vercel
export default app;