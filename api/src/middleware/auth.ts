import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  apiKeyId?: string;
}

/**
 * API Key authentication middleware
 * Validates the X-API-Key header against configured keys
 */
export const apiKeyAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key is required',
      code: 'MISSING_API_KEY',
      hint: 'Include your API key in the X-API-Key header'
    });
    return;
  }
  
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    console.error('WARNING: API_KEY environment variable not set');
    res.status(500).json({
      success: false,
      error: 'Server configuration error',
      code: 'CONFIG_ERROR'
    });
    return;
  }
  
  if (apiKey !== validApiKey) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
    return;
  }
  
  // Attach API key identifier (for logging/tracking)
  req.apiKeyId = apiKey.slice(-8); // Last 8 chars for identification
  
  next();
};

/**
 * Optional API key authentication (for public endpoints with enhanced features)
 */
export const optionalApiKeyAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (apiKey && apiKey === process.env.API_KEY) {
    req.apiKeyId = apiKey.slice(-8);
  }
  
  next();
};

