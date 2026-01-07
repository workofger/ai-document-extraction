import { Router, Request, Response } from 'express';

export const healthRouter = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'DocVal API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  });
});

/**
 * GET /api/health/ready
 * Readiness check - verifies external dependencies
 */
healthRouter.get('/ready', (_req: Request, res: Response) => {
  const checks = {
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    apiKeyConfigured: !!process.env.API_KEY,
  };

  const allReady = Object.values(checks).every(Boolean);

  res.status(allReady ? 200 : 503).json({
    success: allReady,
    status: allReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
});

