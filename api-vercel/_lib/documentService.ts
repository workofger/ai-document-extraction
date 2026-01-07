import OpenAI from 'openai';

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

const postProcessExtractedData = (data: ExtractedData): { 
  correctedData: ExtractedData; 
  corrections: string[]; 
  overallConfidence: number 
} => {
  const correctedData: ExtractedData = { ...data };
  const corrections: string[] = [];
  let totalConfidence = 0;
  let fieldCount = 0;

  if (data.curp) {
    const result = validateAndFixCURP(data.curp);
    if (result.corrected !== data.curp) {
      corrections.push(`CURP: "${data.curp}" → "${result.corrected}"`);
    }
    correctedData.curp = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  if (data.rfc) {
    const result = validateAndFixRFC(data.rfc);
    if (result.corrected !== data.rfc) {
      corrections.push(`RFC: "${data.rfc}" → "${result.corrected}"`);
    }
    correctedData.rfc = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  if (data.clabe) {
    const result = validateAndFixCLABE(data.clabe);
    if (result.corrected !== data.clabe) {
      corrections.push(`CLABE: "${data.clabe}" → "${result.corrected}"`);
    }
    correctedData.clabe = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  if (data.placas) {
    const result = validateAndFixPlacas(data.placas);
    if (result.corrected !== data.placas) {
      corrections.push(`Placas: "${data.placas}" → "${result.corrected}"`);
    }
    correctedData.placas = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  if (data.vin) {
    const result = validateAndFixVIN(data.vin);
    if (result.corrected !== data.vin) {
      corrections.push(`VIN: "${data.vin}" → "${result.corrected}"`);
    }
    correctedData.vin = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  if (data.nombre) {
    correctedData.nombre = data.nombre
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  if (data.razonSocial) {
    correctedData.razonSocial = data.razonSocial.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0.5;

  return { correctedData, corrections, overallConfidence };
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

  return `Eres un experto en validación de documentos legales mexicanos para una plataforma logística.
Tienes ALTA TOLERANCIA a errores de OCR y calidad de imagen.

DOCUMENTO ESPERADO: "${expectedDocType === 'auto' ? 'Detectar automáticamente' : expectedDocType}"

${crossValidationInstructions}

⚠️ INSTRUCCIONES CRÍTICAS PARA OCR:
1. ACEPTA documentos aunque tengan ligera borrosidad, reflejos, o ángulos no perfectos.
2. Considera errores comunes: "0"↔"O", "1"↔"I"↔"l", "5"↔"S", "8"↔"B", "2"↔"Z", "6"↔"G"
3. CURP (18 chars): AAAA######HAAAAA## - Letras + Números + Género + Estado + Consonantes
4. RFC (12-13 chars): AAA######XXX o AAAA######XXX
5. CLABE (18 dígitos): Solo números
6. EXTRAE datos aunque no estés 100% seguro - el sistema post-procesará.
7. Un documento es VÁLIDO si es identificable y tiene al menos 50% de datos legibles.

TIPOS RECONOCIDOS: INE/IFE, Licencia de Conducir, Pasaporte, Tarjeta de Circulación, 
Constancia de Situación Fiscal (RFC/SAT), Póliza de Seguro, Carátula Bancaria, 
Comprobante de Domicilio, Acta Constitutiva, Poder Notarial, Fotografía de Vehículo, 
Verificación Vehicular, Carta de Antecedentes, Factura, Contrato, Otro documento oficial

CAMPOS A EXTRAER: nombre, curp, rfc, claveElector, numeroLicencia, tipoLicencia, 
vigencia, vigenciaFin, direccion, codigoPostal, placas, vin, modelo, marca, anio, 
aseguradora, poliza, banco, clabe, numeroCuenta, razonSocial, telefono, email, folio

Responde SOLO con JSON válido:
{
  "isValid": boolean,
  "detectedType": "tipo detectado",
  "matchesExpected": boolean,
  "reason": "explicación breve",
  "confidence": 0.0-1.0,
  "extractedData": { "campo": "valor" },
  "ocrWarnings": ["campos con dificultad de lectura"],
  "crossValidationWarnings": ["inconsistencias"],
  "suggestions": "sugerencia útil"
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
    const prompt = buildSmartPrompt(expectedDocType, previousData);

    // Supported image types for GPT-4o Vision
    const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    const finalMimeType = supportedTypes.includes(mimeType) ? mimeType : 'image/png';

    console.log(`[DocVal] Analyzing document with GPT-4o Vision...`);

    const response = await openai.chat.completions.create({
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
    
    const { correctedData, corrections, overallConfidence } = postProcessExtractedData(rawData);

    // Build enhanced reason with corrections info
    let enhancedReason = String(parsed.reason || 'Documento procesado');
    
    if (parsed.ocrWarnings?.length > 0) {
      enhancedReason += ` 📋 Campos con lectura difícil: ${parsed.ocrWarnings.join(', ')}.`;
    }
    
    if (corrections.length > 0) {
      enhancedReason += ` 🔧 ${corrections.length} correcciones aplicadas.`;
    }
    
    if (parsed.crossValidationWarnings?.length > 0) {
      enhancedReason += ` ⚠️ ${parsed.crossValidationWarnings.join(', ')}`;
    }

    const aiConfidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    const combinedConfidence = (aiConfidence * 0.6) + (overallConfidence * 0.4);

    console.log(`[DocVal] Analysis complete: ${parsed.isValid ? 'VALID' : 'INVALID'} - ${parsed.detectedType}`);

    return {
      isValid: Boolean(parsed.isValid),
      detectedType: String(parsed.detectedType || 'Desconocido'),
      reason: enhancedReason,
      confidence: Math.min(1, Math.max(0, combinedConfidence)),
      extractedData: correctedData,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      matchesExpected: Boolean(parsed.matchesExpected),
      crossValidationWarnings: [
        ...(parsed.crossValidationWarnings || []),
        ...(parsed.ocrWarnings?.map((w: string) => `OCR: ${w}`) || [])
      ],
      ocrCorrections: corrections
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

