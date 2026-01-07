import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface AuthResult {
  success: boolean;
  apiKeyId?: string;
}

/**
 * Validates the API key from the X-API-Key header
 * Returns success: false and sends error response if validation fails
 */
export function validateApiKey(req: VercelRequest, res: VercelResponse): AuthResult {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key is required',
      code: 'MISSING_API_KEY',
      hint: 'Include your API key in the X-API-Key header'
    });
    return { success: false };
  }

  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    console.error('WARNING: API_KEY environment variable not set');
    res.status(500).json({
      success: false,
      error: 'Server configuration error',
      code: 'CONFIG_ERROR'
    });
    return { success: false };
  }

  if (apiKey !== validApiKey) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
    return { success: false };
  }

  // Return last 8 chars of API key for logging
  return { 
    success: true, 
    apiKeyId: apiKey.slice(-8) 
  };
}

/**
 * Optional API key validation - doesn't fail if key is missing
 * Useful for endpoints with public + authenticated features
 */
export function optionalApiKey(req: VercelRequest): { authenticated: boolean; apiKeyId?: string } {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKey = process.env.API_KEY;

  if (apiKey && validApiKey && apiKey === validApiKey) {
    return { authenticated: true, apiKeyId: apiKey.slice(-8) };
  }

  return { authenticated: false };
}

