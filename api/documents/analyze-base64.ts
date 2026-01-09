import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/cors.js';
import { validateApiKey } from '../lib/auth.js';
import { analyzeDocument } from '../lib/documentService.js';

/**
 * Vercel Serverless Function Configuration
 * - Increased body size limit for base64 images
 * - Extended timeout for GPT-4o Vision processing
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  maxDuration: 60, // 60 seconds max (Pro plan)
};

/**
 * POST /api/documents/analyze-base64
 * 
 * Analyze a document from base64 string using GPT-4o Vision
 * 
 * Headers:
 *   X-API-Key: Your API key (required)
 * 
 * Body (JSON):
 *   {
 *     "document": "base64 string or data URL",
 *     "mimeType": "image/jpeg" (optional if using data URL),
 *     "documentType": "INE" | "auto" (optional, default: "auto"),
 *     "previousData": { "nombre": "...", "curp": "..." } (optional for cross-validation)
 *   }
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "isValid": true,
 *       "detectedType": "INE",
 *       "confidence": 0.92,
 *       "extractedData": { "nombre": "...", "curp": "..." },
 *       "reason": "Documento válido...",
 *       "processingTime": 2340
 *     }
 *   }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (cors(req, res)) return;

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      allowedMethods: ['POST']
    });
  }

  // Validate API key
  const auth = validateApiKey(req, res);
  if (!auth.success) return;

  try {
    const { document, mimeType, documentType, previousData } = req.body;

    // Validate required field
    if (!document) {
      return res.status(400).json({
        success: false,
        error: 'No document provided',
        code: 'MISSING_DOCUMENT',
        hint: 'Send base64 encoded document in the "document" field. Can be raw base64 or data URL format.'
      });
    }

    // Validate document is a string
    if (typeof document !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Document must be a string (base64 or data URL)',
        code: 'INVALID_DOCUMENT_FORMAT'
      });
    }

    // Build data URL if not already formatted
    let dataUrl: string;
    if (document.startsWith('data:')) {
      dataUrl = document;
    } else {
      // Detect MIME type from base64 header or use provided/default
      const detectedMimeType = mimeType || detectMimeType(document) || 'image/png';
      dataUrl = `data:${detectedMimeType};base64,${document}`;
    }

    // Log request (masked for security)
    console.log(`[${auth.apiKeyId}] Analyzing document - type: ${documentType || 'auto'}, size: ${Math.round(document.length / 1024)}KB`);

    // Call GPT-4o Vision
    const result = await analyzeDocument(
      dataUrl,
      documentType || 'auto',
      previousData
    );

    // Log result
    console.log(`[${auth.apiKeyId}] Result: ${result.isValid ? 'VALID' : 'INVALID'} - ${result.detectedType} (${result.processingTime}ms)`);

    // Return success response
    res.status(200).json({
      success: true,
      data: result,
      meta: {
        apiKeyId: auth.apiKeyId,
        analyzedAt: new Date().toISOString(),
        documentSizeKB: Math.round(document.length / 1024),
      }
    });

  } catch (error) {
    console.error(`[DocVal] Analysis error:`, error);
    
    // Determine error type and status code
    const message = error instanceof Error ? error.message : 'Analysis failed';
    const isConfigError = message.includes('OPENAI_API_KEY') || message.includes('configured');
    const isRateLimit = message.includes('rate') || message.includes('quota');
    
    const statusCode = isConfigError ? 503 : isRateLimit ? 429 : 500;
    const code = isConfigError ? 'CONFIG_ERROR' : isRateLimit ? 'RATE_LIMIT' : 'ANALYSIS_ERROR';

    res.status(statusCode).json({
      success: false,
      error: message,
      code,
      hint: isRateLimit ? 'Please wait a moment before retrying' : undefined
    });
  }
}

/**
 * Detect MIME type from base64 magic bytes
 */
function detectMimeType(base64: string): string | null {
  const header = base64.substring(0, 20);
  
  if (header.startsWith('/9j/')) return 'image/jpeg';
  if (header.startsWith('iVBORw')) return 'image/png';
  if (header.startsWith('R0lGOD')) return 'image/gif';
  if (header.startsWith('UklGR')) return 'image/webp';
  if (header.startsWith('JVBERi')) return 'application/pdf';
  
  return null;
}

