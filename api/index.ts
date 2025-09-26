// Minimal Vercel serverless function for debugging
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log(`${req.method} ${req.url}`);

    // Simple routing
    if (req.url === '/health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        environment: process.env.NODE_ENV
      });
    }

    if (req.url === '/') {
      return res.status(200).json({
        message: 'Grant Writing Platform API',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    }

    // Default response
    res.status(404).json({
      error: 'Route not found',
      method: req.method,
      url: req.url,
      available: ['/health', '/']
    });

  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}