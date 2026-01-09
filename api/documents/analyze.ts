import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/cors.js';
import { validateApiKey } from '../lib/auth.js';
import { analyzeDocument } from '../lib/documentService.js';

/**
 * Vercel Serverless Function Configuration
 * - Disable default body parser to handle multipart/form-data
 * - Extended timeout for GPT-4o Vision processing
 */
export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

/**
 * POST /api/documents/analyze
 * 
 * Analyze a document image (JPG, PNG, WebP, GIF) using GPT-4o Vision
 * Accepts both multipart/form-data (file upload) and JSON (base64)
 * 
 * Option 1 - File Upload (multipart/form-data):
 *   Headers:
 *     X-API-Key: Your API key (required)
 *     Content-Type: multipart/form-data
 *   
 *   Form Fields:
 *     file: Image file (JPG, PNG, WebP, GIF) - required
 *     documentType: "INE" | "auto" (optional, default: "auto")
 * 
 * Option 2 - JSON (application/json):
 *   Same as /api/documents/analyze-base64
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "isValid": true,
 *       "detectedType": "INE",
 *       "confidence": 0.92,
 *       "extractedData": { "nombre": "...", "curp": "..." },
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
    const contentType = req.headers['content-type'] || '';
    
    let dataUrl: string;
    let documentType: string = 'auto';
    let fileSizeKB: number = 0;

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const parsed = await parseMultipartForm(req);
      
      if (!parsed.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided',
          code: 'MISSING_FILE',
          hint: 'Send an image file in the "file" field'
        });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(parsed.file.mimeType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid file type: ${parsed.file.mimeType}`,
          code: 'INVALID_FILE_TYPE',
          allowedTypes
        });
      }

      // Convert to base64 data URL
      const base64 = parsed.file.buffer.toString('base64');
      dataUrl = `data:${parsed.file.mimeType};base64,${base64}`;
      documentType = parsed.fields.documentType || 'auto';
      fileSizeKB = Math.round(parsed.file.buffer.length / 1024);

    } else if (contentType.includes('application/json')) {
      // Handle JSON body (base64)
      const body = await parseJsonBody(req);
      
      if (!body.document) {
        return res.status(400).json({
          success: false,
          error: 'No document provided',
          code: 'MISSING_DOCUMENT',
          hint: 'Send base64 encoded document in the "document" field or use multipart/form-data'
        });
      }

      if (body.document.startsWith('data:')) {
        dataUrl = body.document;
      } else {
        const mimeType = body.mimeType || detectMimeType(body.document) || 'image/png';
        dataUrl = `data:${mimeType};base64,${body.document}`;
      }
      
      documentType = body.documentType || 'auto';
      fileSizeKB = Math.round(body.document.length / 1024);

    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid Content-Type',
        code: 'INVALID_CONTENT_TYPE',
        hint: 'Use multipart/form-data for file upload or application/json for base64'
      });
    }

    // Log request
    console.log(`[${auth.apiKeyId}] Analyzing document - type: ${documentType}, size: ${fileSizeKB}KB`);

    // Call GPT-4o Vision
    const result = await analyzeDocument(dataUrl, documentType);

    // Log result
    console.log(`[${auth.apiKeyId}] Result: ${result.isValid ? 'VALID' : 'INVALID'} - ${result.detectedType} (${result.processingTime}ms)`);

    // Return success response
    res.status(200).json({
      success: true,
      data: result,
      meta: {
        apiKeyId: auth.apiKeyId,
        analyzedAt: new Date().toISOString(),
        fileSizeKB,
      }
    });

  } catch (error) {
    console.error(`[DocVal] Analysis error:`, error);
    
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
 * Parse multipart/form-data request
 */
async function parseMultipartForm(req: VercelRequest): Promise<{
  file: { buffer: Buffer; mimeType: string; filename: string } | null;
  fields: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const boundary = getBoundary(req.headers['content-type'] || '');
      
      if (!boundary) {
        resolve({ file: null, fields: {} });
        return;
      }

      const parts = parseMultipart(buffer, boundary);
      
      let file: { buffer: Buffer; mimeType: string; filename: string } | null = null;
      const fields: Record<string, string> = {};

      for (const part of parts) {
        if (part.filename) {
          file = {
            buffer: part.data,
            mimeType: part.contentType || 'application/octet-stream',
            filename: part.filename
          };
        } else if (part.name) {
          fields[part.name] = part.data.toString('utf-8');
        }
      }

      resolve({ file, fields });
    });
  });
}

/**
 * Parse JSON body from request
 */
async function parseJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Get boundary from Content-Type header
 */
function getBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  return match ? (match[1] || match[2]) : null;
}

/**
 * Parse multipart buffer into parts
 */
function parseMultipart(buffer: Buffer, boundary: string): Array<{
  name?: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}> {
  const parts: Array<{ name?: string; filename?: string; contentType?: string; data: Buffer }> = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundary = Buffer.from(`--${boundary}--`);
  
  let start = buffer.indexOf(boundaryBuffer);
  
  while (start !== -1) {
    const nextBoundary = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    const isEnd = buffer.slice(start, start + endBoundary.length).equals(endBoundary);
    
    if (isEnd) break;
    
    const partEnd = nextBoundary === -1 ? buffer.length : nextBoundary;
    const partBuffer = buffer.slice(start + boundaryBuffer.length, partEnd);
    
    // Find header/body separator (double CRLF)
    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headerStr = partBuffer.slice(0, headerEnd).toString('utf-8');
      const bodyStart = headerEnd + 4;
      let bodyEnd = partBuffer.length;
      
      // Remove trailing CRLF
      if (partBuffer[bodyEnd - 2] === 0x0d && partBuffer[bodyEnd - 1] === 0x0a) {
        bodyEnd -= 2;
      }
      
      const data = partBuffer.slice(bodyStart, bodyEnd);
      
      // Parse headers
      const nameMatch = headerStr.match(/name="([^"]+)"/);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);
      const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
      
      parts.push({
        name: nameMatch?.[1],
        filename: filenameMatch?.[1],
        contentType: contentTypeMatch?.[1],
        data
      });
    }
    
    start = nextBoundary;
  }
  
  return parts;
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

