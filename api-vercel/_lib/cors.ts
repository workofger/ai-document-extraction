import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://products.partrunner.com',
  'https://admin.partrunner.com',
  'https://partrunner.com',
];

/**
 * CORS middleware for Vercel Serverless Functions
 * Returns true if the request was a preflight (OPTIONS) and was handled
 */
export function cors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin as string;
  
  // Check if origin is allowed or if it's a same-origin request
  const isAllowed = !origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Origin', 
    isAllowed ? (origin || '*') : ALLOWED_ORIGINS[0]
  );
  res.setHeader(
    'Access-Control-Allow-Methods', 
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-API-Key, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

/**
 * Wrapper for API handlers with CORS and error handling
 */
export function withCors(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void> | void
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Handle CORS preflight
    if (cors(req, res)) return;

    try {
      await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

