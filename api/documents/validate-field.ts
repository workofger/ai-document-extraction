import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/cors.js';
import { validateApiKey } from '../lib/auth.js';
import { validateField, VALIDATABLE_FIELDS } from '../lib/documentService.js';

/**
 * POST /api/documents/validate-field
 * 
 * Validate and auto-correct a single field (CURP, RFC, CLABE, VIN, Placas)
 * 
 * Headers:
 *   X-API-Key: Your API key (required)
 * 
 * Body (JSON):
 *   {
 *     "field": "curp" | "rfc" | "clabe" | "vin" | "placas",
 *     "value": "PEGJ85O1O1HDFRRL09"
 *   }
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "field": "curp",
 *       "originalValue": "PEGJ85O1O1HDFRRL09",
 *       "valid": true,
 *       "corrected": "PEGJ850101HDFRRL09",
 *       "confidence": 0.85,
 *       "corrections": ["Position 4: O → 0", "Position 6: O → 0"]
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
    const { field, value } = req.body;

    // Validate required fields
    if (!field) {
      return res.status(400).json({
        success: false,
        error: 'Missing "field" parameter',
        code: 'MISSING_FIELD',
        validFields: VALIDATABLE_FIELDS
      });
    }

    if (!value) {
      return res.status(400).json({
        success: false,
        error: 'Missing "value" parameter',
        code: 'MISSING_VALUE'
      });
    }

    // Validate field type
    if (!VALIDATABLE_FIELDS.includes(field)) {
      return res.status(400).json({
        success: false,
        error: `Invalid field type: "${field}"`,
        code: 'INVALID_FIELD',
        validFields: VALIDATABLE_FIELDS,
        hint: `Field must be one of: ${VALIDATABLE_FIELDS.join(', ')}`
      });
    }

    // Validate value is a string
    if (typeof value !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Value must be a string',
        code: 'INVALID_VALUE_TYPE'
      });
    }

    // Perform validation
    const result = validateField(field as 'curp' | 'rfc' | 'clabe' | 'vin' | 'placas' | 'nss', value);

    // Log
    console.log(`[${auth.apiKeyId}] Validated ${field}: ${result.valid ? 'VALID' : 'INVALID'} (${result.corrections?.length || 0} corrections)`);

    // Return result
    res.status(200).json({
      success: true,
      data: {
        field,
        originalValue: value,
        ...result
      }
    });

  } catch (error) {
    console.error(`[DocVal] Validation error:`, error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
}

