import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/cors.js';
import { validateApiKey } from '../lib/auth.js';
import { analyzeDocument } from '../lib/documentService.js';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

// Supported file types
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const PDF_TYPES = ['application/pdf'];
const ALL_ALLOWED_TYPES = [...IMAGE_TYPES, ...PDF_TYPES];

/**
 * POST /api/documents/analyze
 * 
 * Analyze a document image or PDF using GPT-4o Vision
 * Automatically detects document type (INE, Licencia, RFC, etc.)
 * 
 * Accepts:
 * - URL: { "url": "https://..." }
 * - Base64: { "document": "data:image/jpeg;base64,..." } or { "document": "data:application/pdf;base64,..." }
 * - File upload: multipart/form-data (images or PDF)
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
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      allowedMethods: ['POST']
    });
  }

  const auth = validateApiKey(req, res);
  if (!auth.success) return;

  try {
    const contentType = req.headers['content-type'] || '';
    
    let dataUrl: string;
    let documentType: string = 'auto';
    let fileSizeKB: number = 0;
    let originalFormat: string = 'image';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const parsed = await parseMultipartForm(req);
      
      if (!parsed.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided',
          code: 'MISSING_FILE',
          hint: 'Send an image or PDF file in the "file" field'
        });
      }

      if (!ALL_ALLOWED_TYPES.includes(parsed.file.mimeType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid file type: ${parsed.file.mimeType}`,
          code: 'INVALID_FILE_TYPE',
          allowedTypes: ALL_ALLOWED_TYPES
        });
      }

      fileSizeKB = Math.round(parsed.file.buffer.length / 1024);
      documentType = parsed.fields.documentType || 'auto';

      // If PDF, convert to image
      if (PDF_TYPES.includes(parsed.file.mimeType)) {
        console.log(`[${auth.apiKeyId}] Converting PDF to image...`);
        originalFormat = 'pdf';
        dataUrl = await convertPdfToImage(parsed.file.buffer);
      } else {
        const base64 = parsed.file.buffer.toString('base64');
        dataUrl = `data:${parsed.file.mimeType};base64,${base64}`;
      }

    } else if (contentType.includes('application/json')) {
      const body = await parseJsonBody(req);
      
      // Option 1: URL provided - download the image/PDF
      if (body.url && typeof body.url === 'string') {
        const urlStr = body.url as string;
        
        if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
          return res.status(400).json({
            success: false,
            error: 'Invalid URL format',
            code: 'INVALID_URL',
            hint: 'URL must start with http:// or https://'
          });
        }

        console.log(`[${auth.apiKeyId}] Downloading file from URL: ${urlStr.substring(0, 50)}...`);
        
        const imageResponse = await fetch(urlStr);
        
        if (!imageResponse.ok) {
          return res.status(400).json({
            success: false,
            error: `Failed to download file: ${imageResponse.status} ${imageResponse.statusText}`,
            code: 'DOWNLOAD_ERROR'
          });
        }

        const contentTypeHeader = imageResponse.headers.get('content-type') || 'image/jpeg';
        const mimeType = contentTypeHeader.split(';')[0].trim();
        
        // Also check file extension for PDFs
        const isPdfUrl = urlStr.toLowerCase().endsWith('.pdf');
        const effectiveMimeType = isPdfUrl ? 'application/pdf' : mimeType;
        
        if (!ALL_ALLOWED_TYPES.includes(effectiveMimeType)) {
          return res.status(400).json({
            success: false,
            error: `Invalid file type from URL: ${effectiveMimeType}`,
            code: 'INVALID_FILE_TYPE',
            allowedTypes: ALL_ALLOWED_TYPES
          });
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fileSizeKB = Math.round(buffer.length / 1024);
        documentType = (body.documentType as string) || 'auto';

        // If PDF, convert to image
        if (PDF_TYPES.includes(effectiveMimeType) || isPdfUrl) {
          console.log(`[${auth.apiKeyId}] Converting PDF from URL to image...`);
          originalFormat = 'pdf';
          dataUrl = await convertPdfToImage(buffer);
        } else {
          const base64 = buffer.toString('base64');
          dataUrl = `data:${mimeType};base64,${base64}`;
        }
      }
      // Option 2: Base64/Data URL provided
      else if (body.document && typeof body.document === 'string') {
        const doc = body.document as string;
        
        let mimeType: string;
        let rawBase64: string;
        
        if (doc.startsWith('data:')) {
          const match = doc.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            rawBase64 = match[2];
          } else {
            mimeType = 'image/png';
            rawBase64 = doc.split(',')[1] || doc;
          }
        } else {
          mimeType = (body.mimeType as string) || detectMimeType(doc) || 'image/png';
          rawBase64 = doc;
        }
        
        if (!ALL_ALLOWED_TYPES.includes(mimeType)) {
          return res.status(400).json({
            success: false,
            error: `Invalid document type: ${mimeType}`,
            code: 'INVALID_FILE_TYPE',
            allowedTypes: ALL_ALLOWED_TYPES
          });
        }

        fileSizeKB = Math.round(rawBase64.length / 1024);
        documentType = (body.documentType as string) || 'auto';

        // If PDF, convert to image
        if (PDF_TYPES.includes(mimeType)) {
          console.log(`[${auth.apiKeyId}] Converting PDF base64 to image...`);
          originalFormat = 'pdf';
          const pdfBuffer = Buffer.from(rawBase64, 'base64');
          dataUrl = await convertPdfToImage(pdfBuffer);
        } else {
          dataUrl = `data:${mimeType};base64,${rawBase64}`;
        }
      }
      else {
        return res.status(400).json({
          success: false,
          error: 'No document provided',
          code: 'MISSING_DOCUMENT',
          hint: 'Send "url" with file URL, or "document" with base64 data'
        });
      }

    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid Content-Type',
        code: 'INVALID_CONTENT_TYPE',
        hint: 'Use application/json with "url" or "document" field, or multipart/form-data for file upload'
      });
    }

    console.log(`[${auth.apiKeyId}] Analyzing document - type: ${documentType}, size: ${fileSizeKB}KB, format: ${originalFormat}`);

    const result = await analyzeDocument(dataUrl, documentType);

    console.log(`[${auth.apiKeyId}] Result: ${result.isValid ? 'VALID' : 'INVALID'} - ${result.detectedType} (${result.processingTime}ms)`);

    res.status(200).json({
      success: true,
      data: result,
      meta: {
        apiKeyId: auth.apiKeyId,
        analyzedAt: new Date().toISOString(),
        fileSizeKB,
        originalFormat,
      }
    });

  } catch (error) {
    console.error(`[DocVal] Analysis error:`, error);
    
    const message = error instanceof Error ? error.message : 'Analysis failed';
    const isConfigError = message.includes('OPENAI_API_KEY') || message.includes('configured');
    const isRateLimit = message.includes('rate') || message.includes('quota');
    const isPdfError = message.includes('PDF') || message.includes('pdf');
    
    const statusCode = isConfigError ? 503 : isRateLimit ? 429 : isPdfError ? 422 : 500;
    const code = isConfigError ? 'CONFIG_ERROR' : isRateLimit ? 'RATE_LIMIT' : isPdfError ? 'PDF_PROCESSING_ERROR' : 'ANALYSIS_ERROR';

    res.status(statusCode).json({
      success: false,
      error: message,
      code,
      hint: isRateLimit ? 'Please wait a moment before retrying' : isPdfError ? 'Try with a clearer PDF or use an image instead' : undefined
    });
  }
}

/**
 * Convert PDF buffer to image data URL (first page only)
 */
async function convertPdfToImage(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import for pdf-to-png-converter
    const { pdfToPng } = await import('pdf-to-png-converter');
    
    // Convert PDF to PNG images
    const pngPages = await pdfToPng(pdfBuffer, {
      disableFontFace: true,  // Better for serverless
      useSystemFonts: false,  // Don't rely on system fonts
      viewportScale: 2.0,     // Higher quality
      pagesToProcess: [1],    // Only first page
    });
    
    if (!pngPages || pngPages.length === 0) {
      throw new Error('Could not extract any page from PDF');
    }
    
    const firstPage = pngPages[0];
    
    if (!firstPage.content) {
      throw new Error('PDF page has no content');
    }
    
    // Convert to base64 data URL
    const base64 = firstPage.content.toString('base64');
    return `data:image/png;base64,${base64}`;
    
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headerStr = partBuffer.slice(0, headerEnd).toString('utf-8');
      const bodyStart = headerEnd + 4;
      let bodyEnd = partBuffer.length;
      
      if (partBuffer[bodyEnd - 2] === 0x0d && partBuffer[bodyEnd - 1] === 0x0a) {
        bodyEnd -= 2;
      }
      
      const data = partBuffer.slice(bodyStart, bodyEnd);
      
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
