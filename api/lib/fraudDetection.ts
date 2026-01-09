/**
 * Fraud Detection Service
 * 
 * Analyzes extracted document data for potential fraud indicators
 * Cross-validates data consistency and checks for common forgery patterns
 */

import { ExtractedData } from './documentService.js';

// ===========================================
// TYPES
// ===========================================

export interface FraudAnalysis {
  isAuthentic: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100, higher = more risky
  fraudIndicators: FraudIndicator[];
  recommendations: string[];
}

export interface FraudIndicator {
  type: FraudIndicatorType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  field?: string;
  message: string;
  details?: string;
}

export type FraudIndicatorType = 
  | 'data_inconsistency'
  | 'invalid_format'
  | 'expired_document'
  | 'future_date'
  | 'impossible_date'
  | 'checksum_mismatch'
  | 'state_code_mismatch'
  | 'gender_mismatch'
  | 'age_inconsistency'
  | 'name_format_suspicious'
  | 'too_many_illegible'
  | 'cross_validation_failed';

// ===========================================
// VALIDATION HELPERS
// ===========================================

/**
 * Extract birth date from CURP
 * CURP format: XXXX YYMMDD X XX XXX XX
 * Positions 4-9 contain YYMMDD
 */
function extractBirthDateFromCURP(curp: string): Date | null {
  if (!curp || curp.length < 10) return null;
  
  try {
    const yearStr = curp.slice(4, 6);
    const month = curp.slice(6, 8);
    const day = curp.slice(8, 10);
    
    // Determine century (00-30 = 2000s, 31-99 = 1900s)
    const yearNum = parseInt(yearStr, 10);
    const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
    
    const date = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));
    
    // Validate the date is real
    if (isNaN(date.getTime())) return null;
    if (date.getMonth() !== parseInt(month, 10) - 1) return null; // Month overflow check
    
    return date;
  } catch {
    return null;
  }
}

/**
 * Extract gender from CURP (position 10)
 */
function extractGenderFromCURP(curp: string): 'H' | 'M' | null {
  if (!curp || curp.length < 11) return null;
  const gender = curp[10];
  return gender === 'H' || gender === 'M' ? gender : null;
}

/**
 * Extract state code from CURP (positions 11-12)
 */
function extractStateFromCURP(curp: string): string | null {
  if (!curp || curp.length < 13) return null;
  return curp.slice(11, 13);
}

/**
 * Valid Mexican state codes
 */
const VALID_STATE_CODES = new Set([
  'AS', 'BC', 'BS', 'CC', 'CL', 'CM', 'CS', 'CH', 'DF', 'DG',
  'GT', 'GR', 'HG', 'JC', 'MC', 'MN', 'MS', 'NT', 'NL', 'OC',
  'PL', 'QT', 'QR', 'SP', 'SL', 'SR', 'TC', 'TS', 'TL', 'VZ',
  'YN', 'ZS', 'NE'
]);

/**
 * Check if a date string represents an expired document
 */
function isExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  
  try {
    // Try multiple date formats
    const formats = [
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{4})/, // Just year
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let date: Date;
        if (match.length === 2) {
          // Just year
          date = new Date(parseInt(match[1], 10), 11, 31); // End of year
        } else if (match[1].length === 4) {
          // YYYY-MM-DD
          date = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
        } else {
          // DD/MM/YYYY
          date = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
        }
        
        return date < new Date();
      }
    }
  } catch {
    return false;
  }
  
  return false;
}

/**
 * Check if a date is in the future (suspicious for documents)
 */
function isFutureDate(dateStr: string, allowedFutureYears = 0): boolean {
  if (!dateStr) return false;
  
  try {
    const year = parseInt(dateStr.match(/\d{4}/)?.[0] || '', 10);
    if (!year) return false;
    
    const maxYear = new Date().getFullYear() + allowedFutureYears;
    return year > maxYear;
  } catch {
    return false;
  }
  
  return false;
}

/**
 * Check if name format is suspicious
 */
function isNameSuspicious(name: string): { suspicious: boolean; reason?: string } {
  if (!name) return { suspicious: false };
  
  const normalized = name.toUpperCase().trim();
  
  // Check for test/placeholder names
  const testPatterns = [
    /^(TEST|PRUEBA|EJEMPLO|DEMO|SAMPLE|XXX|AAAA)/,
    /^(JUAN PEREZ|FULANO|MENGANO|ZUTANO)/,
    /^(NOMBRE|NAME|FIRST|LAST)/,
  ];
  
  for (const pattern of testPatterns) {
    if (pattern.test(normalized)) {
      return { suspicious: true, reason: 'Appears to be a test/placeholder name' };
    }
  }
  
  // Check for unlikely patterns
  if (/^(.)\1{3,}/.test(normalized)) {
    return { suspicious: true, reason: 'Repeated characters detected' };
  }
  
  // Check for too short names
  if (normalized.length < 5) {
    return { suspicious: true, reason: 'Name is unusually short' };
  }
  
  return { suspicious: false };
}

// ===========================================
// MAIN FRAUD DETECTION
// ===========================================

/**
 * Analyze extracted data for potential fraud
 */
export function detectFraud(
  extractedData: ExtractedData,
  documentType: string,
  illegibleFields: string[] = [],
  imageQuality?: string
): FraudAnalysis {
  const indicators: FraudIndicator[] = [];
  let riskScore = 0;
  
  // ===========================================
  // 1. Image Quality Check
  // ===========================================
  
  if (imageQuality === 'mala' || imageQuality === 'ilegible') {
    indicators.push({
      type: 'too_many_illegible',
      severity: 'warning',
      message: 'Poor image quality may indicate intentional obscuring',
      details: `Image quality: ${imageQuality}`
    });
    riskScore += 15;
  }
  
  if (illegibleFields.length >= 3) {
    indicators.push({
      type: 'too_many_illegible',
      severity: 'warning',
      message: 'Multiple illegible fields detected',
      details: `Illegible fields: ${illegibleFields.join(', ')}`
    });
    riskScore += 10 * illegibleFields.length;
  }
  
  // ===========================================
  // 2. CURP Validation
  // ===========================================
  
  if (extractedData.curp && !extractedData.curp.includes('*')) {
    const curp = extractedData.curp;
    
    // State code validation
    const stateCode = extractStateFromCURP(curp);
    if (stateCode && !VALID_STATE_CODES.has(stateCode)) {
      indicators.push({
        type: 'state_code_mismatch',
        severity: 'error',
        field: 'curp',
        message: 'Invalid state code in CURP',
        details: `State code "${stateCode}" is not valid`
      });
      riskScore += 30;
    }
    
    // Gender validation
    const gender = extractGenderFromCURP(curp);
    if (gender && extractedData.sexo) {
      const expectedGender = extractedData.sexo.toUpperCase().startsWith('H') || 
                            extractedData.sexo.toUpperCase().startsWith('M') ? 
                            extractedData.sexo.toUpperCase()[0] : null;
      if (expectedGender && gender !== expectedGender) {
        indicators.push({
          type: 'gender_mismatch',
          severity: 'error',
          field: 'curp',
          message: 'Gender in CURP does not match document',
          details: `CURP indicates ${gender === 'H' ? 'Male' : 'Female'}, document shows ${extractedData.sexo}`
        });
        riskScore += 25;
      }
    }
    
    // Birth date validation
    const birthDate = extractBirthDateFromCURP(curp);
    if (birthDate) {
      const now = new Date();
      const age = (now.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      
      // Check for impossible age
      if (age < 0) {
        indicators.push({
          type: 'future_date',
          severity: 'critical',
          field: 'curp',
          message: 'Birth date in CURP is in the future',
          details: `Birth date: ${birthDate.toISOString().split('T')[0]}`
        });
        riskScore += 50;
      } else if (age > 130) {
        indicators.push({
          type: 'impossible_date',
          severity: 'critical',
          field: 'curp',
          message: 'Birth date in CURP indicates impossible age',
          details: `Calculated age: ${Math.floor(age)} years`
        });
        riskScore += 50;
      } else if (age < 16 && documentType === 'licencia') {
        indicators.push({
          type: 'age_inconsistency',
          severity: 'error',
          field: 'curp',
          message: 'Person is too young for a driver\'s license',
          details: `Calculated age: ${Math.floor(age)} years`
        });
        riskScore += 30;
      }
      
      // Cross-validate with fechaNacimiento if present
      if (extractedData.fechaNacimiento) {
        const docBirthDate = new Date(extractedData.fechaNacimiento);
        if (!isNaN(docBirthDate.getTime())) {
          const daysDiff = Math.abs((birthDate.getTime() - docBirthDate.getTime()) / (24 * 60 * 60 * 1000));
          if (daysDiff > 1) {
            indicators.push({
              type: 'data_inconsistency',
              severity: 'error',
              field: 'fechaNacimiento',
              message: 'Birth date does not match CURP',
              details: `CURP: ${birthDate.toISOString().split('T')[0]}, Document: ${extractedData.fechaNacimiento}`
            });
            riskScore += 35;
          }
        }
      }
    }
  }
  
  // ===========================================
  // 3. RFC vs CURP Cross-Validation
  // ===========================================
  
  if (extractedData.rfc && extractedData.curp && 
      !extractedData.rfc.includes('*') && !extractedData.curp.includes('*')) {
    // First 10 characters of RFC should match first 10 of CURP for personas físicas
    if (extractedData.rfc.length === 13 && extractedData.curp.length === 18) {
      const rfcBase = extractedData.rfc.slice(0, 10);
      const curpBase = extractedData.curp.slice(0, 10);
      
      if (rfcBase !== curpBase) {
        indicators.push({
          type: 'cross_validation_failed',
          severity: 'error',
          field: 'rfc',
          message: 'RFC does not match CURP',
          details: `RFC base: ${rfcBase}, CURP base: ${curpBase}`
        });
        riskScore += 40;
      }
    }
  }
  
  // ===========================================
  // 4. Document Expiration
  // ===========================================
  
  const expirationField = extractedData.vigenciaFin || extractedData.vigencia;
  if (expirationField && !expirationField.includes('*')) {
    if (isExpired(expirationField)) {
      indicators.push({
        type: 'expired_document',
        severity: 'warning',
        field: 'vigencia',
        message: 'Document appears to be expired',
        details: `Expiration: ${expirationField}`
      });
      riskScore += 20;
    }
    
    // Check for suspiciously far future dates (>20 years)
    if (isFutureDate(expirationField, 20)) {
      indicators.push({
        type: 'future_date',
        severity: 'error',
        field: 'vigencia',
        message: 'Expiration date is suspiciously far in the future',
        details: `Expiration: ${expirationField}`
      });
      riskScore += 25;
    }
  }
  
  // ===========================================
  // 5. Name Validation
  // ===========================================
  
  if (extractedData.nombre && !extractedData.nombre.includes('*')) {
    const nameCheck = isNameSuspicious(extractedData.nombre);
    if (nameCheck.suspicious) {
      indicators.push({
        type: 'name_format_suspicious',
        severity: 'warning',
        field: 'nombre',
        message: 'Name format appears suspicious',
        details: nameCheck.reason
      });
      riskScore += 20;
    }
  }
  
  // ===========================================
  // 6. Vehicle-specific Checks
  // ===========================================
  
  if (documentType.toLowerCase().includes('circulacion') || 
      documentType.toLowerCase().includes('poliza') ||
      documentType.toLowerCase().includes('vehiculo')) {
    
    // VIN length check
    if (extractedData.vin && !extractedData.vin.includes('*')) {
      if (extractedData.vin.length !== 17) {
        indicators.push({
          type: 'invalid_format',
          severity: 'error',
          field: 'vin',
          message: 'VIN has incorrect length',
          details: `VIN length: ${extractedData.vin.length}, expected: 17`
        });
        riskScore += 25;
      }
      
      // VIN shouldn't contain I, O, Q
      if (/[IOQ]/i.test(extractedData.vin)) {
        indicators.push({
          type: 'invalid_format',
          severity: 'warning',
          field: 'vin',
          message: 'VIN contains invalid characters (I, O, or Q)',
          details: `VIN: ${extractedData.vin}`
        });
        riskScore += 15;
      }
    }
    
    // Year validation
    if (extractedData.anio && !extractedData.anio.includes('*')) {
      const year = parseInt(extractedData.anio, 10);
      const currentYear = new Date().getFullYear();
      
      if (year < 1900 || year > currentYear + 1) {
        indicators.push({
          type: 'impossible_date',
          severity: 'error',
          field: 'anio',
          message: 'Vehicle year is impossible',
          details: `Year: ${year}`
        });
        riskScore += 30;
      }
    }
    
    // Plates-VIN cross validation could be added with external DB
  }
  
  // ===========================================
  // Calculate Final Risk Level
  // ===========================================
  
  riskScore = Math.min(100, riskScore);
  
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (riskScore >= 70) {
    riskLevel = 'critical';
  } else if (riskScore >= 45) {
    riskLevel = 'high';
  } else if (riskScore >= 20) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (riskLevel === 'critical') {
    recommendations.push('Document should be manually reviewed before acceptance');
    recommendations.push('Request additional supporting documentation');
  } else if (riskLevel === 'high') {
    recommendations.push('Consider requesting a clearer image or scan');
    recommendations.push('Cross-reference with additional ID');
  } else if (riskLevel === 'medium') {
    recommendations.push('Review flagged fields for accuracy');
  }
  
  if (indicators.some(i => i.type === 'expired_document')) {
    recommendations.push('Request updated, non-expired document');
  }
  
  return {
    isAuthentic: riskLevel !== 'critical' && riskLevel !== 'high',
    riskLevel,
    riskScore,
    fraudIndicators: indicators,
    recommendations
  };
}

/**
 * Quick check for obvious fraud indicators
 * Use this for fast pre-screening before full analysis
 */
export function quickFraudCheck(extractedData: ExtractedData): boolean {
  // Check for obvious test data
  if (extractedData.nombre) {
    const name = extractedData.nombre.toUpperCase();
    if (/^(TEST|PRUEBA|EJEMPLO|XXX)/.test(name)) {
      return false;
    }
  }
  
  // Check for obviously invalid CURP
  if (extractedData.curp) {
    const curp = extractedData.curp;
    if (curp.length === 18 && !curp.includes('*')) {
      const gender = curp[10];
      if (gender !== 'H' && gender !== 'M') {
        return false;
      }
      
      const stateCode = curp.slice(11, 13);
      if (!VALID_STATE_CODES.has(stateCode)) {
        return false;
      }
    }
  }
  
  return true;
}
