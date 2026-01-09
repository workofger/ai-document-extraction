import OpenAI from 'openai';
import { extractTextWithVision, normalizeOCRText, VisionOCRResult } from './googleVisionService.js';
import { detectFraud, FraudAnalysis } from './fraudDetection.js';

// ===========================================
// TYPES
// ===========================================

export interface ExtractedData {
  nombre?: string;
  folio?: string;
  rfc?: string;
  curp?: string;
  vigencia?: string;
  vigenciaFin?: string;
  placas?: string;
  direccion?: string;
  claveElector?: string;
  numeroLicencia?: string;
  tipoLicencia?: string;
  modelo?: string;
  vin?: string;
  aseguradora?: string;
  poliza?: string;
  razonSocial?: string;
  codigoPostal?: string;
  clabe?: string;
  banco?: string;
  marca?: string;
  anio?: string;
  telefono?: string;
  email?: string;
  numeroCuenta?: string;
  // Cédula Profesional
  numeroCedula?: string;
  profesion?: string;
  institucionEducativa?: string;
  fechaTitulacion?: string;
  // IMSS / ISSSTE
  nss?: string;
  clinicaAsignada?: string;
  delegacion?: string;
  // Cartilla Militar
  numeroCartilla?: string;
  claseCartilla?: string;
  // Pasaporte
  numeroPasaporte?: string;
  nacionalidad?: string;
  lugarNacimiento?: string;
  fechaNacimiento?: string;
  sexo?: string;
  // Comprobante de domicilio
  tipoServicio?: string;
  numeroContrato?: string;
  periodoFacturado?: string;
  // Vehículo
  tipoVehiculo?: string;
  color?: string;
  numeroMotor?: string;
  numeroPlacas?: string;
  estadoVehiculo?: string;
  // Genérico
  [key: string]: string | undefined;
}

export interface DocumentAnalysisResult {
  isValid: boolean;
  detectedType: string;
  reason: string;
  confidence: number;
  extractedData: ExtractedData;
  timestamp: string;
  processingTime: number;
  matchesExpected?: boolean;
  crossValidationWarnings?: string[];
  ocrCorrections?: string[];
  imageQuality?: string;
  illegibleFields?: string[];
  ocrEngine?: 'google-vision' | 'gpt-4o-vision' | 'hybrid';
  visionConfidence?: number;
  fraudAnalysis?: FraudAnalysis;
}

export interface FieldValidationResult {
  valid: boolean;
  corrected: string;
  confidence: number;
  corrections?: string[];
}

// ===========================================
// OCR CORRECTION UTILITIES
// ===========================================

const normalizeOCRString = (
  input: string, 
  context: 'alpha' | 'numeric' | 'alphanumeric' = 'alphanumeric'
): string => {
  if (!input) return input;
  
  let result = input.toUpperCase().trim();
  result = result.replace(/[\s\-_.,:;'"]/g, '');
  
  if (context === 'numeric') {
    result = result
      .replace(/[OoQD]/g, '0')
      .replace(/[IilL|!]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss$]/g, '5')
      .replace(/[Gb]/g, '6')
      .replace(/[B]/g, '8')
      .replace(/[gq]/g, '9');
  } else if (context === 'alpha') {
    result = result
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/2/g, 'Z')
      .replace(/5/g, 'S')
      .replace(/6/g, 'G')
      .replace(/8/g, 'B')
      .replace(/9/g, 'G');
  }
  
  return result;
};

// ===========================================
// FIELD VALIDATORS
// ===========================================

/**
 * Calculate CURP verification digit using official algorithm
 * Uses dictionary: 0-9, A-Z (excluding Ñ), mapping to 0-35
 */
const calculateCURPVerificationDigit = (curp17: string): string => {
  const dictionary = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let sum = 0;
  
  for (let i = 0; i < 17; i++) {
    const char = curp17[i];
    const index = dictionary.indexOf(char);
    if (index === -1) return '0'; // Invalid character
    sum += index * (18 - i);
  }
  
  const digit = 10 - (sum % 10);
  return digit === 10 ? '0' : String(digit);
};

/**
 * Validate Mexican state codes in CURP (positions 11-12)
 */
const VALID_STATE_CODES = [
  'AS', 'BC', 'BS', 'CC', 'CL', 'CM', 'CS', 'CH', 'DF', 'DG',
  'GT', 'GR', 'HG', 'JC', 'MC', 'MN', 'MS', 'NT', 'NL', 'OC',
  'PL', 'QT', 'QR', 'SP', 'SL', 'SR', 'TC', 'TS', 'TL', 'VZ',
  'YN', 'ZS', 'NE' // NE = Nacido en el Extranjero
];

export const validateAndFixCURP = (curp: string): FieldValidationResult => {
  if (!curp) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = curp.toUpperCase().replace(/[\s\-]/g, '');
  const corrections: string[] = [];
  
  if (normalized.length !== 18) {
    if (normalized.length === 17) {
      normalized = normalized + '0';
      corrections.push('Added missing character');
    } else if (normalized.length === 19) {
      normalized = normalized.slice(0, 18);
      corrections.push('Removed extra character');
    }
  }
  
  // Position rules for CURP:
  // 0-3: First 4 letters (surname initial, first vowel, maternal initial, name initial)
  // 4-9: Birth date YYMMDD (digits)
  // 10: Gender H/M
  // 11-12: State code (letters)
  // 13-15: Consonants from names (letters)
  // 16: Disambiguation digit (alphanumeric, 0-9 or A-Z depending on birth year)
  // 17: Verification digit (0-9)
  
  const letterPositions = [0, 1, 2, 3, 11, 12, 13, 14, 15];
  const digitPositions = [4, 5, 6, 7, 8, 9];
  const genderPosition = 10;
  const disambiguationPosition = 16;
  const verificationPosition = 17;
  
  const corrected = normalized.split('');
  
  // Fix letter positions
  letterPositions.forEach(pos => {
    if (corrected[pos]) {
      const original = corrected[pos];
      corrected[pos] = normalizeOCRString(corrected[pos], 'alpha');
      if (original !== corrected[pos]) {
        corrections.push(`Position ${pos}: ${original} → ${corrected[pos]}`);
      }
    }
  });
  
  // Fix digit positions (birthdate)
  digitPositions.forEach(pos => {
    if (corrected[pos]) {
      const original = corrected[pos];
      corrected[pos] = normalizeOCRString(corrected[pos], 'numeric');
      if (original !== corrected[pos]) {
        corrections.push(`Position ${pos}: ${original} → ${corrected[pos]}`);
      }
    }
  });
  
  // Fix gender position (H or M only)
  if (corrected[genderPosition]) {
    const original = corrected[genderPosition];
    if (original === '4' || original === 'A') {
      corrected[genderPosition] = 'H';
      corrections.push(`Position ${genderPosition}: ${original} → H (gender)`);
    } else if (original !== 'H' && original !== 'M') {
      // Try to determine from OCR errors
      if (original === '|' || original === 'I' || original === '1') {
        corrected[genderPosition] = 'H';
        corrections.push(`Position ${genderPosition}: ${original} → H (gender)`);
      }
    }
  }
  
  // Fix disambiguation position (can be letter or digit depending on birth year)
  // Born before 2000: 0-9, Born 2000+: A-Z
  const birthYear = parseInt(corrected.slice(4, 6).join(''), 10);
  if (corrected[disambiguationPosition]) {
    const original = corrected[disambiguationPosition];
    if (birthYear >= 0 && birthYear <= 99) {
      // Could be either - normalize based on what looks right
      if (/[A-Z]/.test(original)) {
        // Keep as letter (likely born 2000+)
      } else {
        corrected[disambiguationPosition] = normalizeOCRString(corrected[disambiguationPosition], 'numeric');
        if (original !== corrected[disambiguationPosition]) {
          corrections.push(`Position ${disambiguationPosition}: ${original} → ${corrected[disambiguationPosition]}`);
        }
      }
    }
  }
  
  // Fix verification digit
  if (corrected[verificationPosition]) {
    const original = corrected[verificationPosition];
    corrected[verificationPosition] = normalizeOCRString(corrected[verificationPosition], 'numeric');
    if (original !== corrected[verificationPosition]) {
      corrections.push(`Position ${verificationPosition}: ${original} → ${corrected[verificationPosition]}`);
    }
  }
  
  let result = corrected.join('');
  
  // Validate and fix verification digit
  const expectedDigit = calculateCURPVerificationDigit(result.slice(0, 17));
  const actualDigit = result[17];
  
  if (actualDigit !== expectedDigit) {
    corrections.push(`Verification digit: ${actualDigit} → ${expectedDigit} (checksum)`);
    result = result.slice(0, 17) + expectedDigit;
  }
  
  // Validate state code
  const stateCode = result.slice(11, 13);
  const validStateCode = VALID_STATE_CODES.includes(stateCode);
  
  // Final pattern validation
  const curpPattern = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z]{3}[A-Z0-9]\d$/;
  const patternValid = curpPattern.test(result);
  const isValid = patternValid && validStateCode;
  
  // Calculate confidence based on corrections and validations
  let confidence = 1.0;
  confidence -= corrections.length * 0.03; // Each correction reduces confidence
  if (!validStateCode) confidence -= 0.2;
  if (!patternValid) confidence -= 0.3;
  confidence = Math.max(0.3, confidence);
  
  return { 
    valid: isValid, 
    corrected: result, 
    confidence, 
    corrections: corrections.length > 0 ? corrections : undefined 
  };
};

export const validateAndFixRFC = (rfc: string): FieldValidationResult => {
  if (!rfc) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = rfc.toUpperCase().replace(/[\s\-]/g, '');
  const corrections: string[] = [];
  
  if (normalized.length < 12 || normalized.length > 13) {
    if (normalized.length === 11) {
      normalized = normalized + '0';
      corrections.push('Added missing character');
    }
    if (normalized.length === 14) {
      normalized = normalized.slice(0, 13);
      corrections.push('Removed extra character');
    }
  }
  
  const isPersonaFisica = normalized.length === 13;
  const letterCount = isPersonaFisica ? 4 : 3;
  
  const corrected = normalized.split('');
  
  for (let i = 0; i < letterCount; i++) {
    if (corrected[i]) {
      const original = corrected[i];
      corrected[i] = normalizeOCRString(corrected[i], 'alpha');
      if (original !== corrected[i]) {
        corrections.push(`Position ${i}: ${original} → ${corrected[i]}`);
      }
    }
  }
  
  for (let i = letterCount; i < letterCount + 6; i++) {
    if (corrected[i]) {
      const original = corrected[i];
      corrected[i] = normalizeOCRString(corrected[i], 'numeric');
      if (original !== corrected[i]) {
        corrections.push(`Position ${i}: ${original} → ${corrected[i]}`);
      }
    }
  }
  
  const result = corrected.join('');
  const rfcPatternPF = /^[A-Z]{4}\d{6}[A-Z0-9]{3}$/;
  const rfcPatternPM = /^[A-Z]{3}\d{6}[A-Z0-9]{3}$/;
  const isValid = rfcPatternPF.test(result) || rfcPatternPM.test(result);
  const confidence = isValid ? Math.max(0.7, 1 - (corrections.length * 0.05)) : 0.4;
  
  return { valid: isValid, corrected: result, confidence, corrections };
};

export const validateAndFixCLABE = (clabe: string): FieldValidationResult => {
  if (!clabe) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = normalizeOCRString(clabe, 'numeric').replace(/\D/g, '');
  const corrections: string[] = [];
  
  if (normalized.length !== 18) {
    if (normalized.length === 17) {
      normalized = '0' + normalized;
      corrections.push('Added leading zero');
    }
    if (normalized.length === 19) {
      normalized = normalized.slice(0, 18);
      corrections.push('Removed extra digit');
    }
  }
  
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
  let sum = 0;
  
  for (let i = 0; i < 17; i++) {
    const digit = parseInt(normalized[i], 10);
    sum += (digit * weights[i]) % 10;
  }
  
  const expectedChecksum = (10 - (sum % 10)) % 10;
  const actualChecksum = parseInt(normalized[17], 10);
  const checksumValid = expectedChecksum === actualChecksum;
  
  if (!checksumValid) {
    corrections.push(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
  }
  
  const confidence = checksumValid ? 0.95 : 0.6;
  
  return { 
    valid: normalized.length === 18 && checksumValid, 
    corrected: normalized, 
    confidence,
    corrections
  };
};

export const validateAndFixVIN = (vin: string): FieldValidationResult => {
  if (!vin) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = vin.toUpperCase().replace(/[\s\-]/g, '');
  const corrections: string[] = [];
  
  // VIN cannot contain I, O, Q
  if (/[IOQ]/.test(normalized)) {
    normalized = normalized
      .replace(/I/g, '1')
      .replace(/O/g, '0')
      .replace(/Q/g, '0');
    corrections.push('Replaced I/O/Q with 1/0/0');
  }
  
  const isValid = /^[A-HJ-NPR-Z0-9]{17}$/.test(normalized);
  
  return { 
    valid: isValid, 
    corrected: normalized, 
    confidence: isValid ? 0.9 : 0.4,
    corrections 
  };
};

export const validateAndFixPlacas = (placas: string): FieldValidationResult => {
  if (!placas) return { valid: false, corrected: '', confidence: 0 };
  
  const normalized = placas.toUpperCase().replace(/[\s\-]/g, '');
  
  if (normalized.length >= 6 && normalized.length <= 8) {
    const isValid = /^[A-Z0-9]{3,4}[A-Z0-9]{3,4}$/.test(normalized);
    return { valid: isValid, corrected: normalized, confidence: isValid ? 0.85 : 0.5 };
  }
  
  return { valid: false, corrected: normalized, confidence: 0.3 };
};

/**
 * Validate and fix NSS (Número de Seguro Social) - IMSS/ISSSTE
 * Format: 11 digits with verification digit at position 11
 * Structure: Subdelegación (2) + Año alta (2) + Año nacimiento (2) + Número (4) + Verificador (1)
 */
export const validateAndFixNSS = (nss: string): FieldValidationResult => {
  if (!nss) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = normalizeOCRString(nss, 'numeric').replace(/\D/g, '');
  const corrections: string[] = [];
  
  // NSS should be 11 digits
  if (normalized.length !== 11) {
    if (normalized.length === 10) {
      normalized = '0' + normalized;
      corrections.push('Added leading zero');
    } else if (normalized.length === 12) {
      normalized = normalized.slice(0, 11);
      corrections.push('Removed extra digit');
    } else {
      return { 
        valid: false, 
        corrected: normalized, 
        confidence: 0.3,
        corrections: [`Invalid length: ${normalized.length} (expected 11)`]
      };
    }
  }
  
  // Calculate verification digit (Luhn algorithm variant used by IMSS)
  const calculateNSSVerificationDigit = (nss10: string): string => {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      let digit = parseInt(nss10[i], 10);
      // Double every other digit starting from position 0
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    const verifier = (10 - (sum % 10)) % 10;
    return String(verifier);
  };
  
  const expectedDigit = calculateNSSVerificationDigit(normalized.slice(0, 10));
  const actualDigit = normalized[10];
  
  if (actualDigit !== expectedDigit) {
    corrections.push(`Verification digit: ${actualDigit} → ${expectedDigit}`);
    normalized = normalized.slice(0, 10) + expectedDigit;
  }
  
  // Basic structure validation
  const isValid = /^\d{11}$/.test(normalized);
  const confidence = isValid ? Math.max(0.7, 1 - corrections.length * 0.1) : 0.4;
  
  return {
    valid: isValid,
    corrected: normalized,
    confidence,
    corrections: corrections.length > 0 ? corrections : undefined
  };
};

// ===========================================
// POST-PROCESSING
// ===========================================

// Helper to check if value contains illegible markers
const isIllegible = (value: string): boolean => {
  return value.includes('***') || value === '***' || value.includes('*');
};

const postProcessExtractedData = (data: ExtractedData): { 
  correctedData: ExtractedData; 
  corrections: string[]; 
  overallConfidence: number;
  illegibleFields: string[];
} => {
  const correctedData: ExtractedData = { ...data };
  const corrections: string[] = [];
  const illegibleFields: string[] = [];
  let totalConfidence = 0;
  let fieldCount = 0;

  // Don't try to correct fields marked as illegible
  if (data.curp) {
    if (isIllegible(data.curp)) {
      illegibleFields.push('curp');
      correctedData.curp = data.curp; // Keep as-is with asterisks
    } else {
      const result = validateAndFixCURP(data.curp);
      if (result.corrected !== data.curp) {
        corrections.push(`CURP: "${data.curp}" → "${result.corrected}"`);
      }
      correctedData.curp = result.corrected;
      totalConfidence += result.confidence;
      fieldCount++;
    }
  }

  if (data.rfc) {
    if (isIllegible(data.rfc)) {
      illegibleFields.push('rfc');
      correctedData.rfc = data.rfc;
    } else {
      const result = validateAndFixRFC(data.rfc);
      if (result.corrected !== data.rfc) {
        corrections.push(`RFC: "${data.rfc}" → "${result.corrected}"`);
      }
      correctedData.rfc = result.corrected;
      totalConfidence += result.confidence;
      fieldCount++;
    }
  }

  if (data.clabe) {
    if (isIllegible(data.clabe)) {
      illegibleFields.push('clabe');
      correctedData.clabe = data.clabe;
    } else {
      const result = validateAndFixCLABE(data.clabe);
      if (result.corrected !== data.clabe) {
        corrections.push(`CLABE: "${data.clabe}" → "${result.corrected}"`);
      }
      correctedData.clabe = result.corrected;
      totalConfidence += result.confidence;
      fieldCount++;
    }
  }

  if (data.placas) {
    if (isIllegible(data.placas)) {
      illegibleFields.push('placas');
      correctedData.placas = data.placas;
    } else {
      const result = validateAndFixPlacas(data.placas);
      if (result.corrected !== data.placas) {
        corrections.push(`Placas: "${data.placas}" → "${result.corrected}"`);
      }
      correctedData.placas = result.corrected;
      totalConfidence += result.confidence;
      fieldCount++;
    }
  }

  if (data.vin) {
    if (isIllegible(data.vin)) {
      illegibleFields.push('vin');
      correctedData.vin = data.vin;
    } else {
      const result = validateAndFixVIN(data.vin);
      if (result.corrected !== data.vin) {
        corrections.push(`VIN: "${data.vin}" → "${result.corrected}"`);
      }
      correctedData.vin = result.corrected;
      totalConfidence += result.confidence;
      fieldCount++;
    }
  }

  if (data.nss) {
    if (isIllegible(data.nss)) {
      illegibleFields.push('nss');
      correctedData.nss = data.nss;
    } else {
      const result = validateAndFixNSS(data.nss);
      if (result.corrected !== data.nss) {
        corrections.push(`NSS: "${data.nss}" → "${result.corrected}"`);
      }
      correctedData.nss = result.corrected;
      totalConfidence += result.confidence;
      fieldCount++;
    }
  }

  if (data.nombre) {
    if (isIllegible(data.nombre)) {
      illegibleFields.push('nombre');
      correctedData.nombre = data.nombre;
    } else {
      correctedData.nombre = data.nombre
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }

  if (data.razonSocial) {
    if (isIllegible(data.razonSocial)) {
      illegibleFields.push('razonSocial');
      correctedData.razonSocial = data.razonSocial;
    } else {
      correctedData.razonSocial = data.razonSocial.trim().replace(/\s+/g, ' ').toUpperCase();
    }
  }

  const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0.3;

  return { correctedData, corrections, overallConfidence, illegibleFields };
};

// ===========================================
// OPENAI SERVICE
// ===========================================

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured. Set it in Vercel Environment Variables.');
  }
  
  return new OpenAI({ apiKey });
};

const buildSmartPrompt = (expectedDocType: string, previousData?: ExtractedData): string => {
  let crossValidationInstructions = '';
  
  if (previousData && Object.keys(previousData).length > 0) {
    crossValidationInstructions = `
VALIDACIÓN CRUZADA - Datos previos del expediente:
${previousData.nombre ? `- Nombre registrado: "${previousData.nombre}"` : ''}
${previousData.curp ? `- CURP registrado: "${previousData.curp}"` : ''}
${previousData.rfc ? `- RFC registrado: "${previousData.rfc}"` : ''}
${previousData.placas ? `- Placas registradas: "${previousData.placas}"` : ''}
${previousData.vin ? `- VIN registrado: "${previousData.vin}"` : ''}
${previousData.nss ? `- NSS registrado: "${previousData.nss}"` : ''}

Si encuentras estos datos en el documento, verifica si coinciden. Si no coinciden, inclúyelo en "crossValidationWarnings".
`;
  }

  return `Eres un experto en validación de documentos legales mexicanos y análisis de fotografías de vehículos.

DOCUMENTO/IMAGEN ESPERADO: "${expectedDocType === 'auto' ? 'Detectar automáticamente' : expectedDocType}"

${crossValidationInstructions}

⚠️ REGLAS CRÍTICAS - NUNCA INVENTAR DATOS:

1. **NUNCA INVENTES DATOS**. Si no puedes leer un campo claramente, usa "***" en lugar de inventar.
2. Si un carácter es ilegible, usa "*" en su lugar. Ejemplo: "PEGJ85*1*1HDFRRL09"
3. Si un campo completo es ilegible, usa "***" como valor.
4. Si la imagen es muy borrosa, oscura o ilegible, marca isValid: false y explica en reason.
5. Solo extrae datos que PUEDAS VER CLARAMENTE en el documento o imagen.
6. Prefiere dejar campos vacíos o con "***" antes que adivinar.

CALIDAD DE IMAGEN:
- Si menos del 50% del documento es legible: isValid: false, reason: "Imagen ilegible"
- Si hay datos parcialmente legibles: usa "*" para caracteres que no puedas leer
- confidence debe reflejar qué tan legible es el documento (0.0 a 1.0)

FORMATOS MEXICANOS (solo para referencia, NO para inventar):
- CURP: 18 caracteres (4 letras + 6 números + H/M + 2 letras estado + 3 consonantes + 1 alfanumérico + 1 dígito verificador)
- RFC: 12-13 caracteres (persona moral 12, persona física 13)
- CLABE: 18 dígitos (3 banco + 3 plaza + 11 cuenta + 1 verificador)
- NSS: 11 dígitos (IMSS/ISSSTE)
- VIN: 17 caracteres alfanuméricos (sin I, O, Q)

═══════════════════════════════════════════════════════════════════════════════
TIPOS DE DOCUMENTO SOPORTADOS Y SUS CAMPOS ESPECÍFICOS:
═══════════════════════════════════════════════════════════════════════════════

📇 **IDENTIFICACIÓN PERSONAL:**

• INE/IFE (Credencial de Elector)
  → nombre, curp, claveElector, direccion, codigoPostal, vigencia, folio, sexo, fechaNacimiento

• Licencia de Conducir
  → nombre, curp, numeroLicencia, tipoLicencia, vigencia, vigenciaFin, direccion, codigoPostal

• Pasaporte Mexicano
  → nombre, numeroPasaporte, curp, nacionalidad, lugarNacimiento, fechaNacimiento, sexo, vigencia, vigenciaFin

• Cédula Profesional
  → nombre, numeroCedula, curp, profesion, institucionEducativa, fechaTitulacion, folio

• Cartilla Militar (SMN)
  → nombre, numeroCartilla, curp, claseCartilla, folio

📋 **SEGURIDAD SOCIAL:**

• Credencial IMSS / Tarjeta de Afiliación
  → nombre, nss (Número de Seguro Social - 11 dígitos), curp, clinicaAsignada, delegacion

• Credencial ISSSTE
  → nombre, nss, curp, clinicaAsignada, delegacion

💼 **DOCUMENTOS FISCALES:**

• Constancia de Situación Fiscal (RFC/SAT)
  → nombre, rfc, curp, razonSocial, direccion, codigoPostal, email, telefono, folio

• Carátula Bancaria / Estado de Cuenta
  → nombre, banco, clabe, numeroCuenta, rfc, direccion

🚗 **DOCUMENTOS VEHICULARES:**

• Tarjeta de Circulación
  → nombre, placas, vin, marca, modelo, anio, vigencia, folio, numeroMotor

• Póliza de Seguro Vehicular
  → nombre, aseguradora, poliza, placas, vin, marca, modelo, vigencia, vigenciaFin

• Verificación Vehicular
  → placas, vin, marca, modelo, anio, vigencia, folio

📸 **FOTOGRAFÍAS DE VEHÍCULOS:**
Cuando la imagen sea una FOTOGRAFÍA DE UN VEHÍCULO (no un documento):

• Fotografía Frontal de Vehículo
  → marca (identificar por emblema/logo), modelo (si visible), color, placas (si visibles), tipoVehiculo (sedan/suv/pickup/motocicleta/camión/tractocamión/autobús), estadoVehiculo (bueno/regular/dañado)

• Fotografía Lateral de Vehículo
  → marca, modelo, color, tipoVehiculo, estadoVehiculo, placas (si visibles)

• Fotografía Trasera de Vehículo
  → marca, modelo, color, placas, tipoVehiculo, estadoVehiculo

• Fotografía del VIN / Número de Serie
  → vin (17 caracteres, buscar en placa metálica, sticker o grabado)

• Fotografía del Motor
  → numeroMotor (si visible), marca

• Fotografía de Odómetro/Tablero
  → kilometraje, marca, modelo

• Fotografía de Placas
  → placas, tipoVehiculo

• Fotografía de Daños (para seguro)
  → estadoVehiculo (descripción del daño), tipoVehiculo, color

TIPOS DE VEHÍCULOS A IDENTIFICAR:
- Automóvil (sedan, hatchback, coupé)
- SUV / Crossover
- Pickup / Camioneta
- Van / Minivan
- Motocicleta / Motoneta
- Camión de carga (ligero, mediano, pesado)
- Tractocamión / Trailer
- Autobús / Camión de pasajeros
- Vehículo agrícola / maquinaria
- Remolque

🏠 **OTROS DOCUMENTOS:**

• Comprobante de Domicilio (CFE, Telmex, Agua, Gas)
  → nombre, direccion, codigoPostal, tipoServicio, numeroContrato, periodoFacturado

• Acta Constitutiva
  → razonSocial, rfc, direccion, folio

• Poder Notarial
  → nombre, razonSocial, folio

• Carta de No Antecedentes Penales
  → nombre, curp, folio, vigencia

═══════════════════════════════════════════════════════════════════════════════

Responde SOLO con JSON válido:
{
  "isValid": boolean,
  "detectedType": "tipo detectado (ej: 'INE', 'Fotografía Frontal de Vehículo', 'Cédula Profesional')",
  "matchesExpected": boolean,
  "reason": "explicación - incluye si hay problemas de legibilidad",
  "confidence": 0.0-1.0,
  "extractedData": { "campo": "valor o *** si ilegible" },
  "ocrWarnings": ["campos con problemas de lectura"],
  "imageQuality": "buena" | "regular" | "mala" | "ilegible"
}`;
};

/**
 * Build prompt for text-based analysis (when using OCR-extracted text)
 */
const buildTextPrompt = (ocrText: string, expectedDocType: string, previousData?: ExtractedData): string => {
  let crossValidationInstructions = '';
  
  if (previousData && Object.keys(previousData).length > 0) {
    crossValidationInstructions = `
VALIDACIÓN CRUZADA - Datos previos del expediente:
${previousData.nombre ? `- Nombre registrado: "${previousData.nombre}"` : ''}
${previousData.curp ? `- CURP registrado: "${previousData.curp}"` : ''}
${previousData.rfc ? `- RFC registrado: "${previousData.rfc}"` : ''}
${previousData.placas ? `- Placas registradas: "${previousData.placas}"` : ''}
${previousData.vin ? `- VIN registrado: "${previousData.vin}"` : ''}
${previousData.nss ? `- NSS registrado: "${previousData.nss}"` : ''}

Si encuentras estos datos, verifica si coinciden con los del texto. Si no coinciden, inclúyelo en "crossValidationWarnings".
`;
  }

  return `Eres un experto en análisis de documentos legales mexicanos.

DOCUMENTO ESPERADO: "${expectedDocType === 'auto' ? 'Detectar automáticamente' : expectedDocType}"

${crossValidationInstructions}

TEXTO EXTRAÍDO DEL DOCUMENTO (mediante OCR):
"""
${ocrText}
"""

INSTRUCCIONES:
1. Analiza el texto extraído y determina qué tipo de documento es.
2. Extrae SOLO los datos que están CLARAMENTE presentes en el texto.
3. Si un dato está parcialmente visible o confuso en el OCR, usa "*" para los caracteres dudosos.
4. Si un dato no está presente, NO lo incluyas en extractedData.
5. NUNCA inventes datos que no estén en el texto.

FORMATOS MEXICANOS (para referencia):
- CURP: 18 caracteres (4 letras + 6 dígitos + H/M + 2 letras estado + 3 consonantes + 1 alfanumérico + 1 dígito)
- RFC: 12-13 caracteres (persona moral 12, persona física 13)
- CLABE: 18 dígitos
- NSS: 11 dígitos (IMSS/ISSSTE)
- VIN: 17 caracteres alfanuméricos (sin I, O, Q)

═══════════════════════════════════════════════════════════════════════════════
TIPOS DE DOCUMENTO SOPORTADOS:
═══════════════════════════════════════════════════════════════════════════════

📇 IDENTIFICACIÓN:
• INE/IFE → nombre, curp, claveElector, direccion, codigoPostal, vigencia, folio, sexo
• Licencia de Conducir → nombre, curp, numeroLicencia, tipoLicencia, vigencia, vigenciaFin, direccion
• Pasaporte → nombre, numeroPasaporte, curp, nacionalidad, lugarNacimiento, fechaNacimiento, vigencia
• Cédula Profesional → nombre, numeroCedula, curp, profesion, institucionEducativa, fechaTitulacion
• Cartilla Militar → nombre, numeroCartilla, curp, claseCartilla

📋 SEGURIDAD SOCIAL:
• IMSS / ISSSTE → nombre, nss, curp, clinicaAsignada, delegacion

💼 FISCAL:
• Constancia RFC/SAT → nombre, rfc, curp, razonSocial, direccion, codigoPostal, email
• Carátula Bancaria → nombre, banco, clabe, numeroCuenta, rfc

🚗 VEHICULAR:
• Tarjeta de Circulación → nombre, placas, vin, marca, modelo, anio, vigencia, numeroMotor
• Póliza de Seguro → nombre, aseguradora, poliza, placas, vin, marca, modelo, vigencia
• Verificación Vehicular → placas, vin, marca, modelo, anio

🏠 OTROS:
• Comprobante de Domicilio → nombre, direccion, codigoPostal, tipoServicio, numeroContrato
• Acta Constitutiva → razonSocial, rfc, direccion
• Poder Notarial → nombre, razonSocial, folio
• Carta de Antecedentes → nombre, curp, folio, vigencia

═══════════════════════════════════════════════════════════════════════════════

Responde SOLO con JSON válido:
{
  "isValid": boolean,
  "detectedType": "tipo detectado (ej: 'INE', 'Cédula Profesional', 'IMSS')",
  "matchesExpected": boolean,
  "reason": "explicación",
  "confidence": 0.0-1.0,
  "extractedData": { "campo": "valor" },
  "ocrWarnings": ["campos con posibles errores de OCR"],
  "textQuality": "buena" | "regular" | "mala"
}`;
};

// ===========================================
// MAIN FUNCTIONS
// ===========================================

export async function analyzeDocument(
  base64DataUrl: string,
  expectedDocType: string = 'auto',
  previousData?: ExtractedData
): Promise<DocumentAnalysisResult> {
  const startTime = Date.now();
  
  try {
    // Parse data URL
    const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid data URL format. Expected: data:<mimetype>;base64,<data>');
    }
    
    const mimeType = matches[1];
    const base64 = matches[2];
    
    const openai = getOpenAIClient();

    // ===========================================
    // HYBRID PIPELINE: Google Vision OCR + GPT-4o
    // ===========================================
    
    // Step 1: Try Google Cloud Vision OCR first (more accurate for text extraction)
    let visionResult: VisionOCRResult | null = null;
    let useVisionPipeline = false;
    
    if (process.env.GOOGLE_CLOUD_API_KEY) {
      console.log('[DocVal] Using hybrid pipeline: Google Vision OCR + GPT-4o');
      visionResult = await extractTextWithVision(base64);
      
      // Use Vision pipeline if we got meaningful text (at least 20 characters)
      if (visionResult.success && visionResult.fullText.length >= 20) {
        useVisionPipeline = true;
        console.log(`[DocVal] Vision OCR extracted ${visionResult.fullText.length} chars`);
      } else {
        console.log('[DocVal] Vision OCR failed or insufficient text, falling back to GPT-4o Vision');
      }
    } else {
      console.log('[DocVal] No Google Cloud API key, using GPT-4o Vision directly');
    }

    let response;
    
    if (useVisionPipeline && visionResult) {
      // Step 2a: Use GPT-4o to interpret OCR text (no image needed)
      const normalizedText = normalizeOCRText(visionResult.fullText);
      const textPrompt = buildTextPrompt(normalizedText, expectedDocType, previousData);
      
      console.log('[DocVal] Sending OCR text to GPT-4o for interpretation...');
      
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: textPrompt
          }
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });
    } else {
      // Step 2b: Fallback - Use GPT-4o Vision directly (original method)
      const prompt = buildSmartPrompt(expectedDocType, previousData);
      const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      const finalMimeType = supportedTypes.includes(mimeType) ? mimeType : 'image/png';

      console.log(`[DocVal] Analyzing document with GPT-4o Vision...`);

      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${finalMimeType};base64,${base64}`,
                  detail: 'high'
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });
    }

    // Process response (common for both pipelines)
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse response - handle markdown code blocks
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleanedContent);

    // Clean and post-process extracted data
    const rawData: ExtractedData = {};
    for (const [key, value] of Object.entries(parsed.extractedData || {})) {
      if (value && value !== 'N/A' && value !== 'No visible' && value !== 'No disponible') {
        rawData[key] = String(value);
      }
    }
    
    const { correctedData, corrections, overallConfidence, illegibleFields } = postProcessExtractedData(rawData);

    // Check image/text quality from AI response
    const imageQuality = parsed.imageQuality || parsed.textQuality || 'regular';
    const isImageIllegible = imageQuality === 'ilegible' || imageQuality === 'mala';
    
    // Add Vision OCR confidence boost if available
    const visionConfidenceBoost = visionResult?.success ? Math.min(visionResult.confidence * 0.1, 0.05) : 0;

    // Build enhanced reason with corrections info
    let enhancedReason = String(parsed.reason || 'Documento procesado');
    
    if (illegibleFields.length > 0) {
      enhancedReason += ` ⚠️ Campos ilegibles: ${illegibleFields.join(', ')}.`;
    }
    
    if (parsed.ocrWarnings?.length > 0) {
      enhancedReason += ` 📋 Campos con lectura difícil: ${parsed.ocrWarnings.join(', ')}.`;
    }
    
    if (corrections.length > 0) {
      enhancedReason += ` 🔧 ${corrections.length} correcciones OCR aplicadas.`;
    }
    
    if (parsed.crossValidationWarnings?.length > 0) {
      enhancedReason += ` ⚠️ ${parsed.crossValidationWarnings.join(', ')}`;
    }

    // Lower confidence if there are illegible fields, boost if Vision OCR was used
    const aiConfidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    const illegiblePenalty = illegibleFields.length * 0.1;
    const qualityPenalty = isImageIllegible ? 0.3 : (imageQuality === 'mala' ? 0.2 : 0);
    const combinedConfidence = Math.max(0, (aiConfidence * 0.6) + (overallConfidence * 0.4) - illegiblePenalty - qualityPenalty + visionConfidenceBoost);

    // If too many fields are illegible, mark as invalid
    const shouldReject = illegibleFields.length >= 3 || isImageIllegible;

    // Run fraud detection
    const fraudAnalysis = detectFraud(
      correctedData,
      String(parsed.detectedType || 'unknown'),
      illegibleFields,
      imageQuality
    );

    console.log(`[DocVal] Analysis complete: ${parsed.isValid && !shouldReject ? 'VALID' : 'INVALID'} - ${parsed.detectedType} (quality: ${imageQuality}, illegible: ${illegibleFields.length}, fraud: ${fraudAnalysis.riskLevel})`);

    return {
      isValid: Boolean(parsed.isValid) && !shouldReject,
      detectedType: String(parsed.detectedType || 'Desconocido'),
      reason: shouldReject 
        ? `Documento rechazado: imagen de baja calidad o demasiados campos ilegibles. ${enhancedReason}`
        : enhancedReason,
      confidence: Math.min(1, Math.max(0, combinedConfidence)),
      extractedData: correctedData,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      matchesExpected: Boolean(parsed.matchesExpected),
      crossValidationWarnings: [
        ...(parsed.crossValidationWarnings || []),
        ...(parsed.ocrWarnings?.map((w: string) => `OCR: ${w}`) || []),
        ...(illegibleFields.map(f => `Campo ilegible: ${f}`))
      ],
      ocrCorrections: corrections,
      imageQuality,
      illegibleFields,
      ocrEngine: useVisionPipeline ? 'hybrid' : 'gpt-4o-vision',
      visionConfidence: visionResult?.success ? visionResult.confidence : undefined,
      fraudAnalysis
    };
    
  } catch (error) {
    console.error('[DocVal] Document analysis error:', error);
    
    return {
      isValid: false,
      detectedType: 'Error',
      reason: error instanceof Error ? error.message : 'Analysis failed',
      confidence: 0,
      extractedData: {},
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    };
  }
}

export function validateField(
  field: 'curp' | 'rfc' | 'clabe' | 'vin' | 'placas' | 'nss',
  value: string
): FieldValidationResult {
  switch (field) {
    case 'curp':
      return validateAndFixCURP(value);
    case 'rfc':
      return validateAndFixRFC(value);
    case 'clabe':
      return validateAndFixCLABE(value);
    case 'vin':
      return validateAndFixVIN(value);
    case 'placas':
      return validateAndFixPlacas(value);
    case 'nss':
      return validateAndFixNSS(value);
    default:
      return { valid: false, corrected: value, confidence: 0 };
  }
}

// ===========================================
// ANALYZE DOCUMENT FROM TEXT (for PDFs)
// ===========================================

export async function analyzeDocumentFromText(
  text: string,
  expectedDocType: string = 'auto',
  previousData?: ExtractedData
): Promise<DocumentAnalysisResult> {
  const startTime = Date.now();
  
  try {
    const openai = getOpenAIClient();
    
    console.log(`[DocVal] Analyzing PDF text (${text.length} chars)...`);
    
    // Normalize and clean the extracted text
    const normalizedText = normalizeOCRText(text);
    const textPrompt = buildTextPrompt(normalizedText, expectedDocType, previousData);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: textPrompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse response - handle markdown code blocks
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleanedContent);

    // Clean and post-process extracted data
    const rawData: ExtractedData = {};
    for (const [key, value] of Object.entries(parsed.extractedData || {})) {
      if (value && value !== 'N/A' && value !== 'No visible' && value !== 'No disponible') {
        rawData[key] = String(value);
      }
    }
    
    const { correctedData, corrections, overallConfidence, illegibleFields } = postProcessExtractedData(rawData);

    // Build enhanced reason
    let enhancedReason = String(parsed.reason || 'Documento procesado desde PDF');
    
    if (corrections.length > 0) {
      enhancedReason += ` 🔧 ${corrections.length} correcciones OCR aplicadas.`;
    }

    const aiConfidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    const combinedConfidence = Math.max(0, (aiConfidence * 0.6) + (overallConfidence * 0.4));

    // Run fraud detection
    const fraudAnalysis = detectFraud(
      correctedData,
      String(parsed.detectedType || 'unknown'),
      illegibleFields,
      'pdf'
    );

    console.log(`[DocVal] PDF analysis complete: ${parsed.isValid ? 'VALID' : 'INVALID'} - ${parsed.detectedType} (fraud: ${fraudAnalysis.riskLevel})`);

    return {
      isValid: Boolean(parsed.isValid),
      detectedType: String(parsed.detectedType || 'Desconocido'),
      reason: enhancedReason,
      confidence: Math.min(1, Math.max(0, combinedConfidence)),
      extractedData: correctedData,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      matchesExpected: Boolean(parsed.matchesExpected),
      crossValidationWarnings: parsed.crossValidationWarnings || [],
      ocrCorrections: corrections,
      imageQuality: 'pdf',
      illegibleFields,
      ocrEngine: 'hybrid',
      visionConfidence: 0.9, // PDFs usually have good text quality
      fraudAnalysis
    };
    
  } catch (error) {
    console.error('[DocVal] PDF text analysis error:', error);
    throw error;
  }
}

// ===========================================
// SUPPORTED TYPES
// ===========================================

export const SUPPORTED_DOCUMENT_TYPES = [
  // Identificación Personal
  { id: 'ine', name: 'INE/IFE', category: 'identificacion', description: 'Credencial de elector mexicana', fields: ['nombre', 'curp', 'claveElector', 'direccion', 'codigoPostal', 'vigencia', 'folio', 'sexo', 'fechaNacimiento'] },
  { id: 'licencia', name: 'Licencia de Conducir', category: 'identificacion', description: 'Licencia de conducir mexicana', fields: ['nombre', 'curp', 'numeroLicencia', 'tipoLicencia', 'vigencia', 'vigenciaFin', 'direccion', 'codigoPostal'] },
  { id: 'pasaporte', name: 'Pasaporte', category: 'identificacion', description: 'Pasaporte mexicano', fields: ['nombre', 'numeroPasaporte', 'curp', 'nacionalidad', 'lugarNacimiento', 'fechaNacimiento', 'sexo', 'vigencia', 'vigenciaFin'] },
  { id: 'cedula', name: 'Cédula Profesional', category: 'identificacion', description: 'Cédula profesional de la SEP', fields: ['nombre', 'numeroCedula', 'curp', 'profesion', 'institucionEducativa', 'fechaTitulacion', 'folio'] },
  { id: 'cartilla', name: 'Cartilla Militar', category: 'identificacion', description: 'Cartilla del Servicio Militar Nacional', fields: ['nombre', 'numeroCartilla', 'curp', 'claseCartilla', 'folio'] },
  
  // Seguridad Social
  { id: 'imss', name: 'Credencial IMSS', category: 'seguridad_social', description: 'Credencial o número de seguro social IMSS', fields: ['nombre', 'nss', 'curp', 'clinicaAsignada', 'delegacion'] },
  { id: 'issste', name: 'Credencial ISSSTE', category: 'seguridad_social', description: 'Credencial del ISSSTE', fields: ['nombre', 'nss', 'curp', 'clinicaAsignada', 'delegacion'] },
  
  // Documentos Fiscales
  { id: 'rfc', name: 'Constancia de Situación Fiscal', category: 'fiscal', description: 'Constancia del SAT con RFC', fields: ['nombre', 'rfc', 'curp', 'razonSocial', 'direccion', 'codigoPostal', 'email', 'telefono', 'folio'] },
  { id: 'banco', name: 'Carátula Bancaria', category: 'fiscal', description: 'Estado de cuenta o carátula bancaria', fields: ['nombre', 'banco', 'clabe', 'numeroCuenta', 'rfc', 'direccion'] },
  
  // Documentos Vehiculares
  { id: 'circulacion', name: 'Tarjeta de Circulación', category: 'vehicular', description: 'Tarjeta de circulación vehicular', fields: ['nombre', 'placas', 'vin', 'marca', 'modelo', 'anio', 'vigencia', 'folio', 'numeroMotor'] },
  { id: 'poliza', name: 'Póliza de Seguro', category: 'vehicular', description: 'Póliza de seguro vehicular', fields: ['nombre', 'aseguradora', 'poliza', 'placas', 'vin', 'marca', 'modelo', 'vigencia', 'vigenciaFin'] },
  { id: 'verificacion', name: 'Verificación Vehicular', category: 'vehicular', description: 'Constancia de verificación vehicular', fields: ['placas', 'vin', 'marca', 'modelo', 'anio', 'vigencia', 'folio'] },
  
  // Fotografías de Vehículos
  { id: 'foto_vehiculo_frontal', name: 'Foto Vehículo Frontal', category: 'foto_vehiculo', description: 'Fotografía frontal del vehículo', fields: ['marca', 'modelo', 'color', 'placas', 'tipoVehiculo', 'estadoVehiculo'] },
  { id: 'foto_vehiculo_lateral', name: 'Foto Vehículo Lateral', category: 'foto_vehiculo', description: 'Fotografía lateral del vehículo', fields: ['marca', 'modelo', 'color', 'tipoVehiculo', 'estadoVehiculo', 'placas'] },
  { id: 'foto_vehiculo_trasera', name: 'Foto Vehículo Trasera', category: 'foto_vehiculo', description: 'Fotografía trasera del vehículo', fields: ['marca', 'modelo', 'color', 'placas', 'tipoVehiculo', 'estadoVehiculo'] },
  { id: 'foto_vin', name: 'Foto VIN/Serie', category: 'foto_vehiculo', description: 'Fotografía del número de serie VIN', fields: ['vin'] },
  { id: 'foto_motor', name: 'Foto Motor', category: 'foto_vehiculo', description: 'Fotografía del motor', fields: ['numeroMotor', 'marca'] },
  { id: 'foto_odometro', name: 'Foto Odómetro', category: 'foto_vehiculo', description: 'Fotografía del tablero/odómetro', fields: ['kilometraje', 'marca', 'modelo'] },
  { id: 'foto_placas', name: 'Foto Placas', category: 'foto_vehiculo', description: 'Fotografía de las placas', fields: ['placas', 'tipoVehiculo'] },
  { id: 'foto_danos', name: 'Foto Daños', category: 'foto_vehiculo', description: 'Fotografía de daños del vehículo', fields: ['estadoVehiculo', 'tipoVehiculo', 'color'] },
  
  // Otros Documentos
  { id: 'domicilio', name: 'Comprobante de Domicilio', category: 'otros', description: 'CFE, Telmex, agua, gas, etc.', fields: ['nombre', 'direccion', 'codigoPostal', 'tipoServicio', 'numeroContrato', 'periodoFacturado'] },
  { id: 'acta', name: 'Acta Constitutiva', category: 'otros', description: 'Acta constitutiva de empresa', fields: ['razonSocial', 'rfc', 'direccion', 'folio'] },
  { id: 'poder', name: 'Poder Notarial', category: 'otros', description: 'Poder notarial', fields: ['nombre', 'razonSocial', 'folio'] },
  { id: 'antecedentes', name: 'Carta de Antecedentes', category: 'otros', description: 'Carta de no antecedentes penales', fields: ['nombre', 'curp', 'folio', 'vigencia'] },
  
  // Detección Automática
  { id: 'auto', name: 'Detección Automática', category: 'auto', description: 'El sistema detecta automáticamente el tipo de documento o imagen', fields: [] },
];

export const EXTRACTABLE_FIELDS = [
  // Identificación básica
  'nombre', 'curp', 'rfc', 'sexo', 'fechaNacimiento', 'nacionalidad', 'lugarNacimiento',
  // INE
  'claveElector', 'folio',
  // Licencia
  'numeroLicencia', 'tipoLicencia',
  // Pasaporte
  'numeroPasaporte',
  // Cédula Profesional
  'numeroCedula', 'profesion', 'institucionEducativa', 'fechaTitulacion',
  // Cartilla Militar
  'numeroCartilla', 'claseCartilla',
  // Seguridad Social
  'nss', 'clinicaAsignada', 'delegacion',
  // Vigencias
  'vigencia', 'vigenciaFin',
  // Dirección
  'direccion', 'codigoPostal',
  // Vehículo documento
  'placas', 'vin', 'modelo', 'marca', 'anio', 'numeroMotor',
  // Vehículo foto
  'tipoVehiculo', 'color', 'estadoVehiculo', 'kilometraje',
  // Seguro
  'aseguradora', 'poliza',
  // Bancario
  'banco', 'clabe', 'numeroCuenta',
  // Fiscal
  'razonSocial',
  // Domicilio
  'tipoServicio', 'numeroContrato', 'periodoFacturado',
  // Contacto
  'telefono', 'email'
];

export const VALIDATABLE_FIELDS = ['curp', 'rfc', 'clabe', 'vin', 'placas', 'nss'];

// Vehicle types for reference
export const VEHICLE_TYPES = [
  'sedan', 'hatchback', 'coupe', 'convertible',
  'suv', 'crossover',
  'pickup', 'camioneta',
  'van', 'minivan',
  'motocicleta', 'motoneta',
  'camion_ligero', 'camion_mediano', 'camion_pesado',
  'tractocamion', 'trailer',
  'autobus', 'camion_pasajeros',
  'vehiculo_agricola', 'maquinaria',
  'remolque'
];

// Document categories
export const DOCUMENT_CATEGORIES = {
  identificacion: 'Identificación Personal',
  seguridad_social: 'Seguridad Social',
  fiscal: 'Documentos Fiscales',
  vehicular: 'Documentos Vehiculares',
  foto_vehiculo: 'Fotografías de Vehículos',
  otros: 'Otros Documentos',
  auto: 'Detección Automática'
};

