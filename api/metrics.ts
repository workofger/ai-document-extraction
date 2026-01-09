import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './lib/cors.js';
import { validateApiKey } from './lib/auth.js';
import { 
  SUPPORTED_DOCUMENT_TYPES, 
  EXTRACTABLE_FIELDS, 
  VALIDATABLE_FIELDS,
  DOCUMENT_CATEGORIES,
  VEHICLE_TYPES
} from './lib/documentService.js';

/**
 * In-memory metrics storage
 * Note: In a production environment, you'd use Redis, Vercel KV, or a database
 * This resets on each cold start, but provides basic functionality
 */
interface MetricsData {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  documentTypeBreakdown: Record<string, number>;
  avgProcessingTime: number;
  totalProcessingTime: number;
  errorBreakdown: Record<string, number>;
  fieldValidations: Record<string, { total: number; valid: number }>;
  fraudDetections: {
    total: number;
    flagged: number;
    byRiskLevel: Record<string, number>;
  };
  lastReset: string;
  requestsPerHour: number[];
}

// Global metrics (resets on cold start)
const metrics: MetricsData = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  documentTypeBreakdown: {},
  avgProcessingTime: 0,
  totalProcessingTime: 0,
  errorBreakdown: {},
  fieldValidations: {},
  fraudDetections: {
    total: 0,
    flagged: 0,
    byRiskLevel: { low: 0, medium: 0, high: 0, critical: 0 }
  },
  lastReset: new Date().toISOString(),
  requestsPerHour: new Array(24).fill(0)
};

/**
 * Record a document analysis request
 */
export function recordAnalysis(
  success: boolean,
  documentType: string,
  processingTime: number,
  errorCode?: string
): void {
  metrics.totalRequests++;
  
  if (success) {
    metrics.successfulRequests++;
    
    // Record document type
    const normalizedType = documentType.toLowerCase().replace(/\s+/g, '_');
    metrics.documentTypeBreakdown[normalizedType] = 
      (metrics.documentTypeBreakdown[normalizedType] || 0) + 1;
    
    // Update processing time
    metrics.totalProcessingTime += processingTime;
    metrics.avgProcessingTime = metrics.totalProcessingTime / metrics.successfulRequests;
  } else {
    metrics.failedRequests++;
    
    if (errorCode) {
      metrics.errorBreakdown[errorCode] = (metrics.errorBreakdown[errorCode] || 0) + 1;
    }
  }
  
  // Record hourly distribution
  const hour = new Date().getHours();
  metrics.requestsPerHour[hour]++;
}

/**
 * Record a field validation
 */
export function recordValidation(field: string, valid: boolean): void {
  if (!metrics.fieldValidations[field]) {
    metrics.fieldValidations[field] = { total: 0, valid: 0 };
  }
  metrics.fieldValidations[field].total++;
  if (valid) {
    metrics.fieldValidations[field].valid++;
  }
}

/**
 * Record a fraud detection
 */
export function recordFraudDetection(riskLevel: string, flagged: boolean): void {
  metrics.fraudDetections.total++;
  if (flagged) {
    metrics.fraudDetections.flagged++;
  }
  metrics.fraudDetections.byRiskLevel[riskLevel] = 
    (metrics.fraudDetections.byRiskLevel[riskLevel] || 0) + 1;
}

/**
 * GET /api/metrics
 * 
 * Returns API usage metrics and statistics
 * 
 * Headers:
 *   X-API-Key: Your API key (required)
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "overview": { ... },
 *       "documentTypes": { ... },
 *       "processing": { ... },
 *       "errors": { ... },
 *       "fraud": { ... },
 *       "capabilities": { ... }
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

  // Calculate derived metrics
  const successRate = metrics.totalRequests > 0 
    ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2) 
    : '100.00';
  
  const peakHour = metrics.requestsPerHour.indexOf(Math.max(...metrics.requestsPerHour));
  
  // Sort document types by usage
  const sortedDocTypes = Object.entries(metrics.documentTypeBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  
  // Calculate field validation success rates
  const fieldValidationRates: Record<string, string> = {};
  for (const [field, data] of Object.entries(metrics.fieldValidations)) {
    fieldValidationRates[field] = data.total > 0 
      ? (data.valid / data.total * 100).toFixed(2) + '%' 
      : 'N/A';
  }

  // Group supported documents by category
  const documentsByCategory: Record<string, typeof SUPPORTED_DOCUMENT_TYPES> = {};
  for (const doc of SUPPORTED_DOCUMENT_TYPES) {
    const category = doc.category || 'otros';
    if (!documentsByCategory[category]) {
      documentsByCategory[category] = [];
    }
    documentsByCategory[category].push(doc);
  }

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        successRate: `${successRate}%`,
        uptime: getUptime(),
        lastReset: metrics.lastReset
      },
      
      processing: {
        avgProcessingTimeMs: Math.round(metrics.avgProcessingTime),
        totalProcessingTimeMs: metrics.totalProcessingTime,
        peakHourUTC: peakHour,
        requestsDistribution: metrics.requestsPerHour
      },
      
      documentTypes: {
        topUsed: Object.fromEntries(sortedDocTypes),
        total: Object.keys(metrics.documentTypeBreakdown).length
      },
      
      errors: {
        breakdown: metrics.errorBreakdown,
        total: metrics.failedRequests
      },
      
      validation: {
        fieldSuccessRates: fieldValidationRates,
        totalValidations: Object.values(metrics.fieldValidations)
          .reduce((sum, f) => sum + f.total, 0)
      },
      
      fraud: {
        totalChecks: metrics.fraudDetections.total,
        flaggedDocuments: metrics.fraudDetections.flagged,
        flagRate: metrics.fraudDetections.total > 0 
          ? (metrics.fraudDetections.flagged / metrics.fraudDetections.total * 100).toFixed(2) + '%'
          : '0%',
        byRiskLevel: metrics.fraudDetections.byRiskLevel
      },
      
      capabilities: {
        supportedDocumentTypes: SUPPORTED_DOCUMENT_TYPES.length,
        documentsByCategory: Object.fromEntries(
          Object.entries(documentsByCategory).map(([cat, docs]) => [
            DOCUMENT_CATEGORIES[cat as keyof typeof DOCUMENT_CATEGORIES] || cat,
            docs.map(d => d.name)
          ])
        ),
        extractableFields: EXTRACTABLE_FIELDS.length,
        validatableFields: VALIDATABLE_FIELDS,
        vehicleTypesSupported: VEHICLE_TYPES.length
      },
      
      version: {
        api: '1.1.0',
        features: [
          'Hybrid OCR (Google Vision + GPT-4o)',
          'CURP verification with checksum',
          'RFC validation',
          'CLABE validation',
          'VIN validation',
          'NSS validation',
          'Fraud detection',
          'Vehicle photo analysis',
          'PDF support'
        ]
      }
    },
    meta: {
      generatedAt: new Date().toISOString(),
      note: 'Metrics reset on cold start. For persistent metrics, configure external storage.'
    }
  });
}

/**
 * Calculate uptime since last cold start
 */
function getUptime(): string {
  const start = new Date(metrics.lastReset);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
