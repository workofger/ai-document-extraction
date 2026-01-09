import OpenAI from 'openai';
import { extractTextWithVision, normalizeOCRText, VisionOCRResult } from './googleVisionService.js';

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
  
  const letterPositions = [0, 1, 2, 3, 10, 11, 12, 13, 14, 15];
  const digitPositions = [4, 5, 6, 7, 8, 9];
  
  const corrected = normalized.split('');
  
  letterPositions.forEach(pos => {
    if (corrected[pos]) {
      const original = corrected[pos];
      corrected[pos] = normalizeOCRString(corrected[pos], 'alpha');
      if (original !== corrected[pos]) {
        corrections.push(`Position ${pos}: ${original} → ${corrected[pos]}`);
      }
    }
  });
  
  digitPositions.forEach(pos => {
    if (corrected[pos]) {
      const original = corrected[pos];
      corrected[pos] = normalizeOCRString(corrected[pos], 'numeric');
      if (original !== corrected[pos]) {
        corrections.push(`Position ${pos}: ${original} → ${corrected[pos]}`);
      }
    }
  });
  
  const result = corrected.join('');
  const curpPattern = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z]{3}[A-Z0-9]{2}$/;
  const isValid = curpPattern.test(result);
  const confidence = isValid ? Math.max(0.7, 1 - (corrections.length * 0.05)) : 0.4;
  
  return { valid: isValid, corrected: result, confidence, corrections };
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

Si encuentras estos datos en el documento, verifica si coinciden. Si no coinciden, inclúyelo en "crossValidationWarnings".
`;
  }

  return `Eres un experto en validación de documentos legales mexicanos.

DOCUMENTO ESPERADO: "${expectedDocType === 'auto' ? 'Detectar automáticamente' : expectedDocType}"

${crossValidationInstructions}

⚠️ REGLAS CRÍTICAS - NUNCA INVENTAR DATOS:

1. **NUNCA INVENTES DATOS**. Si no puedes leer un campo claramente, usa "***" en lugar de inventar.
2. Si un carácter es ilegible, usa "*" en su lugar. Ejemplo: "PEGJ85*1*1HDFRRL09"
3. Si un campo completo es ilegible, usa "***" como valor.
4. Si la imagen es muy borrosa, oscura o ilegible, marca isValid: false y explica en reason.
5. Solo extrae datos que PUEDAS VER CLARAMENTE en el documento.
6. Prefiere dejar campos vacíos o con "***" antes que adivinar.

CALIDAD DE IMAGEN:
- Si menos del 50% del documento es legible: isValid: false, reason: "Imagen ilegible"
- Si hay datos parcialmente legibles: usa "*" para caracteres que no puedas leer
- confidence debe reflejar qué tan legible es el documento (0.0 a 1.0)

FORMATOS MEXICANOS (solo para referencia, NO para inventar):
- CURP: 18 caracteres (4 letras + 6 números + 1 letra género + 2 letras estado + 3 consonantes + 2 dígitos)
- RFC: 12-13 caracteres
- CLABE: 18 dígitos

TIPOS DE DOCUMENTO: INE/IFE, Licencia de Conducir, Pasaporte, Tarjeta de Circulación, 
Constancia Fiscal (RFC/SAT), Póliza de Seguro, Carátula Bancaria, Comprobante de Domicilio

CAMPOS: nombre, curp, rfc, claveElector, numeroLicencia, tipoLicencia, vigencia, 
vigenciaFin, direccion, codigoPostal, placas, vin, modelo, marca, anio, aseguradora, 
poliza, banco, clabe, numeroCuenta, razonSocial, telefono, email, folio

Responde SOLO con JSON válido:
{
  "isValid": boolean,
  "detectedType": "tipo detectado o 'Ilegible'",
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

FORMATOS MEXICANOS:
- CURP: 18 caracteres (ej: PEGJ850101HDFRRL09)
- RFC: 12-13 caracteres (ej: PEGJ850101ABC)
- CLABE: 18 dígitos (ej: 012180001234567890)
- VIN: 17 caracteres alfanuméricos

TIPOS DE DOCUMENTO: INE/IFE, Licencia de Conducir, Pasaporte, Tarjeta de Circulación, 
Constancia Fiscal (RFC/SAT), Póliza de Seguro, Carátula Bancaria, Comprobante de Domicilio

CAMPOS A BUSCAR: nombre, curp, rfc, claveElector, numeroLicencia, tipoLicencia, vigencia, 
vigenciaFin, direccion, codigoPostal, placas, vin, modelo, marca, anio, aseguradora, 
poliza, banco, clabe, numeroCuenta, razonSocial, telefono, email, folio

Responde SOLO con JSON válido:
{
  "isValid": boolean,
  "detectedType": "tipo detectado",
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

    console.log(`[DocVal] Analysis complete: ${parsed.isValid && !shouldReject ? 'VALID' : 'INVALID'} - ${parsed.detectedType} (quality: ${imageQuality}, illegible: ${illegibleFields.length})`);

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
      visionConfidence: visionResult?.success ? visionResult.confidence : undefined
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
  field: 'curp' | 'rfc' | 'clabe' | 'vin' | 'placas',
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

    console.log(`[DocVal] PDF analysis complete: ${parsed.isValid ? 'VALID' : 'INVALID'} - ${parsed.detectedType}`);

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
      visionConfidence: 0.9 // PDFs usually have good text quality
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
];

export const EXTRACTABLE_FIELDS = [
  'nombre', 'curp', 'rfc', 'claveElector', 'numeroLicencia', 'tipoLicencia',
  'vigencia', 'vigenciaFin', 'direccion', 'codigoPostal', 'placas', 'vin',
  'modelo', 'marca', 'anio', 'aseguradora', 'poliza', 'banco', 'clabe',
  'numeroCuenta', 'razonSocial', 'telefono', 'email', 'folio'
];

export const VALIDATABLE_FIELDS = ['curp', 'rfc', 'clabe', 'vin', 'placas'];

