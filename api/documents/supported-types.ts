import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/cors.js';
import { validateApiKey } from '../lib/auth.js';
import { SUPPORTED_DOCUMENT_TYPES, EXTRACTABLE_FIELDS, VALIDATABLE_FIELDS } from '../lib/documentService.js';

/**
 * GET /api/documents/supported-types
 * 
 * Get list of supported document types and extractable fields
 * 
 * Headers:
 *   X-API-Key: Your API key (required)
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "documentTypes": [...],
 *       "extractableFields": [...],
 *       "validatableFields": [...]
 *     }
 *   }
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (cors(req, res)) return;

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }

  // Validate API key
  const auth = validateApiKey(req, res);
  if (!auth.success) return;

  res.status(200).json({
    success: true,
    data: {
      documentTypes: SUPPORTED_DOCUMENT_TYPES,
      extractableFields: EXTRACTABLE_FIELDS,
      validatableFields: VALIDATABLE_FIELDS,
      usage: {
        analyze: {
          endpoint: 'POST /api/documents/analyze-base64',
          description: 'Analyze a document image and extract data',
          body: {
            document: 'Base64 encoded image or data URL (required)',
            mimeType: 'MIME type if not using data URL (optional)',
            documentType: 'Expected document type or "auto" (optional, default: "auto")',
            previousData: 'Previous extracted data for cross-validation (optional)'
          }
        },
        validateField: {
          endpoint: 'POST /api/documents/validate-field',
          description: 'Validate and auto-correct a single field',
          body: {
            field: 'Field type: curp, rfc, clabe, vin, placas (required)',
            value: 'Value to validate (required)'
          }
        }
      }
    }
  });
}

