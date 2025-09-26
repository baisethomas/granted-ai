// Gradually rebuilding Vercel serverless function
import express from "express";

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Test routes
app.get('/', (req, res) => {
  res.json({
    message: 'Grant Writing Platform API with Express',
    status: 'running',
    timestamp: new Date().toISOString(),
    express: 'working'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    express: 'working',
    environment: process.env.NODE_ENV
  });
});

// Basic API test
app.get('/api/test', (req, res) => {
  res.json({
    test: 'success',
    message: 'API routing working'
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