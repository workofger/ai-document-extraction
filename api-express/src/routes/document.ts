import { Router, Response } from 'express';
import { z } from 'zod';
import { upload } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { analyzeDocument, validateField, DocumentAnalysisResult } from '../services/documentService.js';

export const documentRouter = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const analyzeRequestSchema = z.object({
  documentType: z.string().optional().default('auto'),
  previousData: z.record(z.string()).optional(),
  language: z.enum(['es', 'en']).optional().default('es'),
});

const validateFieldSchema = z.object({
  field: z.enum(['curp', 'rfc', 'clabe', 'vin', 'placas']),
  value: z.string().min(1),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/documents/analyze
 * 
 * Analyze a document image or PDF and extract data
 * 
 * @body {file} document - The document file (image or PDF)
 * @body {string} documentType - Expected document type (optional, default: auto)
 * @body {object} previousData - Previous extracted data for cross-validation (optional)
 * 
 * @returns {DocumentAnalysisResult} Analysis result with extracted data
 */
documentRouter.post(
  '/analyze',
  upload.single('document'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate file was uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No document file provided',
          code: 'MISSING_FILE',
          hint: 'Send the document as multipart/form-data with field name "document"'
        });
        return;
      }

      // Parse and validate request body
      const bodyData = {
        documentType: req.body.documentType,
        previousData: req.body.previousData ? JSON.parse(req.body.previousData) : undefined,
        language: req.body.language,
      };
      
      const validatedBody = analyzeRequestSchema.parse(bodyData);

      // Convert file buffer to base64 data URL
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

      console.log(`[${req.apiKeyId}] Analyzing document: ${req.file.originalname} (${req.file.mimetype}, ${Math.round(req.file.size / 1024)}KB)`);

      // Analyze document
      const result = await analyzeDocument(
        dataUrl,
        validatedBody.documentType,
        validatedBody.previousData
      );

      console.log(`[${req.apiKeyId}] Analysis complete: ${result.isValid ? 'VALID' : 'INVALID'} - ${result.detectedType}`);

      res.json({
        success: true,
        data: result,
        meta: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          analyzedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Document analysis error:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        code: 'ANALYSIS_ERROR'
      });
    }
  }
);

/**
 * POST /api/documents/analyze-base64
 * 
 * Analyze a document from base64 string (for JSON API calls)
 * 
 * @body {string} document - Base64 encoded document (with or without data URL prefix)
 * @body {string} mimeType - MIME type if not included in data URL
 * @body {string} documentType - Expected document type (optional)
 * @body {object} previousData - Previous extracted data for cross-validation (optional)
 */
documentRouter.post(
  '/analyze-base64',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { document, mimeType, documentType, previousData } = req.body;

      if (!document) {
        res.status(400).json({
          success: false,
          error: 'No document provided',
          code: 'MISSING_DOCUMENT',
          hint: 'Send base64 encoded document in the "document" field'
        });
        return;
      }

      // Build data URL if not already formatted
      let dataUrl: string;
      if (document.startsWith('data:')) {
        dataUrl = document;
      } else {
        const detectedMimeType = mimeType || 'image/png';
        dataUrl = `data:${detectedMimeType};base64,${document}`;
      }

      console.log(`[${req.apiKeyId}] Analyzing base64 document`);

      const result = await analyzeDocument(
        dataUrl,
        documentType || 'auto',
        previousData
      );

      console.log(`[${req.apiKeyId}] Analysis complete: ${result.isValid ? 'VALID' : 'INVALID'} - ${result.detectedType}`);

      res.json({
        success: true,
        data: result,
        meta: {
          analyzedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Document analysis error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        code: 'ANALYSIS_ERROR'
      });
    }
  }
);

/**
 * POST /api/documents/validate-field
 * 
 * Validate and correct a single field (CURP, RFC, CLABE, etc.)
 * 
 * @body {string} field - Field type to validate
 * @body {string} value - Value to validate
 * 
 * @returns {object} Validation result with corrected value
 */
documentRouter.post(
  '/validate-field',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const validated = validateFieldSchema.parse(req.body);
      
      const result = validateField(validated.field, validated.value);

      res.json({
        success: true,
        data: {
          field: validated.field,
          originalValue: validated.value,
          ...result
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        code: 'VALIDATION_ERROR'
      });
    }
  }
);

/**
 * GET /api/documents/supported-types
 * 
 * Get list of supported document types
 */
documentRouter.get('/supported-types', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      documentTypes: [
        { id: 'ine', name: 'INE/IFE', description: 'Credencial de elector mexicana' },
        { id: 'licencia', name: 'Licencia de Conducir', description: 'Licencia de conducir mexicana' },
        { id: 'pasaporte', name: 'Pasaporte', description: 'Pasaporte mexicano' },
        { id: 'circulacion', name: 'Tarjeta de Circulación', description: 'Tarjeta de circulación vehicular' },
        { id: 'rfc', name: 'Constancia de Situación Fiscal', description: 'Constancia del SAT' },
        { id: 'poliza', name: 'Póliza de Seguro', description: 'Póliza de seguro vehicular' },
        { id: 'banco', name: 'Carátula Bancaria', description: 'Estado de cuenta o carátula bancaria' },
        { id: 'domicilio', name: 'Comprobante de Domicilio', description: 'CFE, agua, teléfono, etc.' },
        { id: 'acta', name: 'Acta Constitutiva', description: 'Acta constitutiva de empresa' },
        { id: 'poder', name: 'Poder Notarial', description: 'Poder notarial' },
        { id: 'vehiculo', name: 'Fotografía de Vehículo', description: 'Fotos del vehículo' },
        { id: 'verificacion', name: 'Verificación Vehicular', description: 'Constancia de verificación' },
        { id: 'antecedentes', name: 'Carta de Antecedentes', description: 'Carta de no antecedentes penales' },
        { id: 'auto', name: 'Detección Automática', description: 'El sistema detecta el tipo' },
      ],
      extractableFields: [
        'nombre', 'curp', 'rfc', 'claveElector', 'numeroLicencia', 'tipoLicencia',
        'vigencia', 'vigenciaFin', 'direccion', 'codigoPostal', 'placas', 'vin',
        'modelo', 'marca', 'anio', 'aseguradora', 'poliza', 'banco', 'clabe',
        'numeroCuenta', 'razonSocial', 'telefono', 'email', 'folio'
      ],
      validatableFields: ['curp', 'rfc', 'clabe', 'vin', 'placas']
    }
  });
});

