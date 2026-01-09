import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './lib/cors.js';

/**
 * GET /api/health
 * 
 * Health check endpoint - no authentication required
 * Useful for monitoring and load balancer health checks
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }

  const checks = {
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    apiKeyConfigured: !!process.env.API_KEY,
  };

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    success: true,
    status: allHealthy ? 'healthy' : 'degraded',
    service: 'DocVal API',
    version: '1.0.0',
    platform: 'vercel-serverless',
    region: process.env.VERCEL_REGION || 'unknown',
    timestamp: new Date().toISOString(),
    checks,
    endpoints: {
      health: 'GET /api/health',
      analyze: 'POST /api/documents/analyze-base64',
      validateField: 'POST /api/documents/validate-field',
      supportedTypes: 'GET /api/documents/supported-types',
    }
  });
}

