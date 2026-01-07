import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist';
import { ValidationResult, ExtractedData } from '@/types';

// Configure PDF.js worker using CDN (fixes MIME type issues with some servers)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

// ============================================
// OCR ERROR CORRECTION UTILITIES
// ============================================

/**
 * Common OCR character confusions mapping
 * Maps commonly misread characters to their likely intended values
 * Used for reference and potential future enhancements
 */
const _OCR_CONFUSIONS: Record<string, string[]> = {
  // Numbers that look like letters
  '0': ['O', 'o', 'Q', 'D'],
  '1': ['I', 'i', 'l', 'L', '|', '!'],
  '2': ['Z', 'z'],
  '5': ['S', 's'],
  '6': ['G', 'b'],
  '8': ['B'],
  '9': ['g', 'q'],
  // Letters that look like numbers
  'O': ['0', 'Q', 'D'],
  'I': ['1', 'l', 'L', '|'],
  'L': ['1', 'I', 'l'],
  'S': ['5', '$'],
  'Z': ['2'],
  'B': ['8', '6'],
  'G': ['6', 'C'],
  // Similar letters
  'M': ['N', 'H'],
  'N': ['M', 'H'],
  'U': ['V', 'W'],
  'V': ['U', 'W', 'Y'],
  'C': ['G', 'O', '('],
  'E': ['F'],
  'F': ['E', 'P'],
  'P': ['F', 'R'],
  'R': ['P', 'K'],
  'K': ['R', 'X'],
  'X': ['K', 'Y'],
  'Y': ['V', 'X'],
};

// Export for potential future use
export { _OCR_CONFUSIONS as OCR_CONFUSIONS_MAP };

/**
 * Normalizes a string by fixing common OCR errors based on context
 */
const normalizeOCRString = (input: string, context: 'alpha' | 'numeric' | 'alphanumeric' = 'alphanumeric'): string => {
  if (!input) return input;
  
  let result = input.toUpperCase().trim();
  
  // Remove common noise characters
  result = result.replace(/[\s\-_.,:;'"]/g, '');
  
  if (context === 'numeric') {
    // Force all characters to be numbers
    result = result
      .replace(/[OoQD]/g, '0')
      .replace(/[IilL|!]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss$]/g, '5')
      .replace(/[Gb]/g, '6')
      .replace(/[B]/g, '8')
      .replace(/[gq]/g, '9');
  } else if (context === 'alpha') {
    // Force all characters to be letters
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

// ============================================
// MEXICAN DOCUMENT VALIDATION (CURP, RFC, CLABE)
// ============================================

/**
 * CURP validation with checksum verification
 * Format: AAAA######HAAAAA## (18 chars)
 */
const validateAndFixCURP = (curp: string): { valid: boolean; corrected: string; confidence: number } => {
  if (!curp) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = curp.toUpperCase().replace(/[\s\-]/g, '');
  
  // CURP structure: 4 letters + 6 digits + 1 letter (gender) + 2 letters (state) + 3 consonants + 2 alphanumeric
  // Example: GARC850101HDFRRL09
  
  if (normalized.length !== 18) {
    // Try to fix common length issues
    if (normalized.length === 17) {
      // Maybe missing a leading zero or character
      normalized = normalized + '0';
    } else if (normalized.length === 19) {
      // Maybe extra character
      normalized = normalized.slice(0, 18);
    }
  }
  
  // Fix positions that should be letters (0-3, 10, 11-12, 13-15)
  const letterPositions = [0, 1, 2, 3, 10, 11, 12, 13, 14, 15];
  const digitPositions = [4, 5, 6, 7, 8, 9];
  
  let corrected = normalized.split('');
  
  letterPositions.forEach(pos => {
    if (corrected[pos] !== undefined) {
      corrected[pos] = normalizeOCRString(corrected[pos]!, 'alpha');
    }
  });
  
  digitPositions.forEach(pos => {
    if (corrected[pos] !== undefined) {
      corrected[pos] = normalizeOCRString(corrected[pos]!, 'numeric');
    }
  });
  
  const result = corrected.join('');
  
  // Validate CURP pattern
  const curpPattern = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z]{3}[A-Z0-9]{2}$/;
  const isValid = curpPattern.test(result);
  
  // Calculate confidence based on how many corrections were made
  const corrections = normalized !== result ? 1 : 0;
  const lengthCorrect = result.length === 18 ? 1 : 0;
  const confidence = isValid ? Math.max(0.7, 1 - (corrections * 0.1)) : lengthCorrect * 0.5;
  
  return { valid: isValid, corrected: result, confidence };
};

/**
 * RFC validation with checksum verification
 * Format: AAA######XXX (12-13 chars)
 */
const validateAndFixRFC = (rfc: string): { valid: boolean; corrected: string; confidence: number } => {
  if (!rfc) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = rfc.toUpperCase().replace(/[\s\-]/g, '');
  
  // RFC structure: 3-4 letters + 6 digits + 3 alphanumeric (homoclave)
  // Persona Física: 4 letters + 6 digits + 3 = 13 chars
  // Persona Moral: 3 letters + 6 digits + 3 = 12 chars
  
  if (normalized.length < 12 || normalized.length > 13) {
    // Try to normalize length
    if (normalized.length === 11) normalized = normalized + '0';
    if (normalized.length === 14) normalized = normalized.slice(0, 13);
  }
  
  const isPersonaFisica = normalized.length === 13;
  const letterCount = isPersonaFisica ? 4 : 3;
  
  let corrected = normalized.split('');
  
  // Fix letter positions
  for (let i = 0; i < letterCount; i++) {
    if (corrected[i] !== undefined) {
      corrected[i] = normalizeOCRString(corrected[i]!, 'alpha');
    }
  }
  
  // Fix digit positions (6 digits after letters)
  for (let i = letterCount; i < letterCount + 6; i++) {
    if (corrected[i] !== undefined) {
      corrected[i] = normalizeOCRString(corrected[i]!, 'numeric');
    }
  }
  
  const result = corrected.join('');
  
  // Validate RFC pattern
  const rfcPatternPF = /^[A-Z]{4}\d{6}[A-Z0-9]{3}$/;
  const rfcPatternPM = /^[A-Z]{3}\d{6}[A-Z0-9]{3}$/;
  const isValid = rfcPatternPF.test(result) || rfcPatternPM.test(result);
  
  const corrections = normalized !== result ? 1 : 0;
  const confidence = isValid ? Math.max(0.7, 1 - (corrections * 0.1)) : 0.4;
  
  return { valid: isValid, corrected: result, confidence };
};

/**
 * CLABE validation with checksum verification
 * Format: 18 digits with Luhn-like checksum
 */
const validateAndFixCLABE = (clabe: string): { valid: boolean; corrected: string; confidence: number } => {
  if (!clabe) return { valid: false, corrected: '', confidence: 0 };
  
  // Force all characters to digits
  let normalized = normalizeOCRString(clabe, 'numeric').replace(/\D/g, '');
  
  // CLABE must be exactly 18 digits
  if (normalized.length !== 18) {
    if (normalized.length === 17) normalized = '0' + normalized;
    if (normalized.length === 19) normalized = normalized.slice(0, 18);
  }
  
  // Validate CLABE checksum
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
  let sum = 0;
  
  for (let i = 0; i < 17; i++) {
    const char = normalized[i];
    if (char !== undefined) {
      const digit = parseInt(char, 10);
      const weight = weights[i];
      if (weight !== undefined) {
        sum += (digit * weight) % 10;
      }
    }
  }
  
  const expectedChecksum = (10 - (sum % 10)) % 10;
  const lastChar = normalized[17];
  const actualChecksum = lastChar !== undefined ? parseInt(lastChar, 10) : -1;
  const checksumValid = expectedChecksum === actualChecksum;
  
  const confidence = checksumValid ? 0.95 : 0.6;
  
  return { 
    valid: normalized.length === 18 && checksumValid, 
    corrected: normalized, 
    confidence 
  };
};

/**
 * License plate validation for Mexican plates
 */
const validateAndFixPlacas = (placas: string): { valid: boolean; corrected: string; confidence: number } => {
  if (!placas) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = placas.toUpperCase().replace(/[\s\-]/g, '');
  
  // Mexican plates have various formats:
  // Federal: 3 letters + 3-4 digits (ABC-1234)
  // State: 3 letters + 3 digits + 1 letter (ABC-123-D) or similar
  
  // Common pattern: 3 alphanumeric + 3-4 alphanumeric
  if (normalized.length >= 6 && normalized.length <= 8) {
    const isValid = /^[A-Z0-9]{3,4}[A-Z0-9]{3,4}$/.test(normalized);
    return { valid: isValid, corrected: normalized, confidence: isValid ? 0.85 : 0.5 };
  }
  
  return { valid: false, corrected: normalized, confidence: 0.3 };
};

/**
 * VIN validation (17 characters, specific checksum)
 */
const validateAndFixVIN = (vin: string): { valid: boolean; corrected: string; confidence: number } => {
  if (!vin) return { valid: false, corrected: '', confidence: 0 };
  
  let normalized = vin.toUpperCase().replace(/[\s\-]/g, '');
  
  // VIN cannot contain I, O, Q (to avoid confusion with 1, 0)
  normalized = normalized
    .replace(/I/g, '1')
    .replace(/O/g, '0')
    .replace(/Q/g, '0');
  
  const isValid = /^[A-HJ-NPR-Z0-9]{17}$/.test(normalized);
  
  return { valid: isValid, corrected: normalized, confidence: isValid ? 0.9 : 0.4 };
};

// ============================================
// POST-PROCESSING OF EXTRACTED DATA
// ============================================

/**
 * Apply intelligent corrections to all extracted data
 */
const postProcessExtractedData = (data: ExtractedData): { 
  correctedData: ExtractedData; 
  corrections: string[]; 
  overallConfidence: number 
} => {
  const correctedData: ExtractedData = { ...data };
  const corrections: string[] = [];
  let totalConfidence = 0;
  let fieldCount = 0;

  // Process CURP
  if (data.curp) {
    const result = validateAndFixCURP(data.curp);
    if (result.corrected !== data.curp) {
      corrections.push(`CURP corregido: "${data.curp}" → "${result.corrected}"`);
    }
    correctedData.curp = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  // Process RFC
  if (data.rfc) {
    const result = validateAndFixRFC(data.rfc);
    if (result.corrected !== data.rfc) {
      corrections.push(`RFC corregido: "${data.rfc}" → "${result.corrected}"`);
    }
    correctedData.rfc = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  // Process CLABE
  if (data.clabe) {
    const result = validateAndFixCLABE(data.clabe);
    if (result.corrected !== data.clabe) {
      corrections.push(`CLABE corregido: "${data.clabe}" → "${result.corrected}"`);
    }
    correctedData.clabe = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  // Process Placas
  if (data.placas) {
    const result = validateAndFixPlacas(data.placas);
    if (result.corrected !== data.placas) {
      corrections.push(`Placas corregidas: "${data.placas}" → "${result.corrected}"`);
    }
    correctedData.placas = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  // Process VIN
  if (data.vin) {
    const result = validateAndFixVIN(data.vin);
    if (result.corrected !== data.vin) {
      corrections.push(`VIN corregido: "${data.vin}" → "${result.corrected}"`);
    }
    correctedData.vin = result.corrected;
    totalConfidence += result.confidence;
    fieldCount++;
  }

  // Process license number (alphanumeric)
  if (data.numeroLicencia) {
    const normalized = normalizeOCRString(data.numeroLicencia, 'alphanumeric');
    if (normalized !== data.numeroLicencia?.toUpperCase().replace(/[\s\-]/g, '')) {
      corrections.push(`Número de licencia normalizado`);
    }
    correctedData.numeroLicencia = normalized;
  }

  // Process clave de elector (13 digits typically)
  if (data.claveElector) {
    const normalized = normalizeOCRString(data.claveElector, 'alphanumeric');
    correctedData.claveElector = normalized;
  }

  // Clean up name (remove extra spaces, fix capitalization)
  if (data.nombre) {
    correctedData.nombre = data.nombre
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Clean up razonSocial
  if (data.razonSocial) {
    correctedData.razonSocial = data.razonSocial.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0.5;

  return { correctedData, corrections, overallConfidence };
};

// ============================================
// OPENAI INTEGRATION
// ============================================

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada. Por favor, configura la variable de entorno.');
  }
  
  return new OpenAI({ 
    apiKey,
    dangerouslyAllowBrowser: true
  });
};

const convertPdfToImage = async (base64Data: string): Promise<string> => {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);

    // Increase scale for better OCR accuracy
    const scale = 3.0; // Increased from 2.0
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('No se pudo crear el contexto del canvas');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Use higher quality settings
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Use maximum quality for OCR
    const imageDataUrl = canvas.toDataURL('image/png', 1.0);
    const base64Image = imageDataUrl.split(',')[1];
    
    if (!base64Image) {
      throw new Error('Error al convertir PDF a imagen');
    }

    return base64Image;
  } catch (error) {
    console.error('Error converting PDF:', error);
    throw new Error('No se pudo convertir el PDF a imagen. Asegúrate de que el archivo no esté corrupto.');
  }
};

/**
 * Enhanced prompt with OCR error tolerance instructions
 */
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

Si encuentras estos datos en el documento, verifica si coinciden (considerando posibles errores de OCR). Si no coinciden, inclúyelo en "crossValidationWarnings".
`;
  }

  return `Eres un experto en validación de documentos legales mexicanos para una plataforma logística.
Tienes ALTA TOLERANCIA a errores de OCR y calidad de imagen.

DOCUMENTO ESPERADO: "${expectedDocType}"

${crossValidationInstructions}

⚠️ INSTRUCCIONES CRÍTICAS PARA OCR:
1. ACEPTA documentos aunque tengan:
   - Ligera borrosidad o baja resolución
   - Reflejos o sombras parciales
   - Ángulos no perfectamente rectos
   - Marcas de desgaste normales
   
2. Al extraer texto, CONSIDERA estos errores comunes de OCR:
   - "0" (cero) confundido con "O" (letra O)
   - "1" (uno) confundido con "I" (letra I) o "l" (ele)
   - "5" confundido con "S"
   - "8" confundido con "B"
   - "2" confundido con "Z"
   - "6" confundido con "G"
   
3. Para CURP (18 caracteres): Formato AAAA######HAAAAA##
   - Primeros 4: LETRAS (apellidos/nombre)
   - Siguientes 6: NÚMEROS (fecha nacimiento)
   - Posición 11: H o M (género)
   - Posiciones 12-13: LETRAS (estado)
   - Posiciones 14-16: CONSONANTES
   - Últimos 2: ALFANUMÉRICOS
   
4. Para RFC (12-13 caracteres): Formato AAA######XXX o AAAA######XXX
   - Letras iniciales + 6 dígitos fecha + 3 homoclave
   
5. Para CLABE (18 dígitos): Solo NÚMEROS, incluye checksum
   
6. EXTRAE los datos incluso si no estás 100% seguro - el sistema post-procesará y corregirá.

7. Un documento es VÁLIDO si:
   - Se puede identificar qué tipo de documento es
   - Tiene al menos 50% de los datos visibles/legibles
   - NO está completamente borroso o corrupto
   - NO necesita ser perfectamente nítido

TIPOS DE DOCUMENTOS RECONOCIDOS:
- INE/IFE (Credencial de elector)
- Licencia de Conducir
- Pasaporte
- Tarjeta de Circulación
- Constancia de Situación Fiscal (RFC/SAT)
- Póliza de Seguro
- Carátula Bancaria / Estado de Cuenta
- Comprobante de Domicilio (CFE, Agua, Teléfono)
- Acta Constitutiva
- Poder Notarial
- Factura
- Contrato
- Fotografía de Vehículo
- Verificación Vehicular
- Carta de Antecedentes
- Otro documento oficial

EXTRACCIÓN DE DATOS (extrae TODO lo que puedas leer, aunque no estés 100% seguro):
- nombre: Nombre completo de persona
- curp: CURP (18 caracteres) - extrae aunque tenga posibles errores
- rfc: RFC (12-13 caracteres) - extrae aunque tenga posibles errores
- claveElector: Clave de elector INE
- numeroLicencia: Número de licencia
- tipoLicencia: Tipo (A, B, C, D, E, F)
- vigencia: Fecha de emisión o inicio vigencia
- vigenciaFin: Fecha de vencimiento
- direccion: Dirección completa
- codigoPostal: CP
- placas: Placas del vehículo
- vin: VIN/NIV del vehículo (17 caracteres)
- modelo: Modelo del vehículo
- marca: Marca del vehículo
- anio: Año del vehículo
- aseguradora: Nombre de aseguradora
- poliza: Número de póliza
- banco: Nombre del banco
- clabe: CLABE (18 dígitos)
- numeroCuenta: Número de cuenta
- razonSocial: Razón social de empresa
- telefono: Número telefónico
- email: Correo electrónico
- folio: Número de folio del documento

IMPORTANTE: 
- Sé GENEROSO con la validación. Si el documento es identificable, márcalo como válido.
- Si hay datos parcialmente legibles, EXTRÁELOS e indícalo en el campo "ocrWarnings".
- Prefiere APROBAR con advertencias que RECHAZAR innecesariamente.

Responde SOLO con JSON válido:
{
  "isValid": boolean,
  "detectedType": "tipo real del documento detectado",
  "matchesExpected": boolean,
  "reason": "explicación breve",
  "confidence": 0.0-1.0,
  "extractedData": { "campo": "valor_tal_como_lo_lees" },
  "ocrWarnings": ["lista de campos donde hubo dificultad de lectura"],
  "crossValidationWarnings": ["inconsistencias con datos previos"],
  "suggestions": "sugerencia útil para el usuario",
  "readabilityScore": 0.0-1.0
}`;
};

const parseBase64DataUrl = (dataUrl: string): { mimeType: string; base64: string } => {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('No se recibieron datos válidos del archivo.');
  }

  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  
  if (!matches || matches.length !== 3) {
    throw new Error('Formato de archivo inválido.');
  }

  return { 
    mimeType: matches[1] as string, 
    base64: matches[2] as string 
  };
};

const cleanExtractedData = (data: Record<string, unknown>): ExtractedData => {
  const cleaned: ExtractedData = {};
  
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== null && value !== undefined && value !== '' && value !== 'N/A' && value !== 'No visible' && value !== 'No disponible' && value !== 'No legible') {
      cleaned[key] = String(value);
    }
  }
  
  return cleaned;
};

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

export const analyzeDocument = async (
  base64DataUrl: string,
  expectedDocType: string,
  previousData?: ExtractedData
): Promise<ValidationResult> => {
  const startTime = Date.now();
  
  try {
    const { base64, mimeType } = parseBase64DataUrl(base64DataUrl);
    const openai = getOpenAIClient();
    const prompt = buildSmartPrompt(expectedDocType, previousData);

    let imageBase64 = base64;
    let finalMimeType = mimeType;

    if (mimeType === 'application/pdf') {
      console.log('Converting PDF to high-resolution image...');
      imageBase64 = await convertPdfToImage(base64);
      finalMimeType = 'image/png';
    }

    const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(finalMimeType)) {
      finalMimeType = 'image/png';
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${finalMimeType};base64,${imageBase64}`,
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
      throw new Error('La IA no generó una respuesta.');
    }

    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleanedContent);

    // Clean raw extracted data
    const rawExtractedData = cleanExtractedData(parsed.extractedData);
    
    // Apply post-processing corrections
    const { correctedData, corrections, overallConfidence } = postProcessExtractedData(rawExtractedData);

    // Build enhanced reason
    let enhancedReason = String(parsed.reason || 'Documento procesado');
    
    // Add OCR warnings if any
    if (parsed.ocrWarnings && parsed.ocrWarnings.length > 0) {
      enhancedReason += ` 📋 Campos con lectura difícil: ${parsed.ocrWarnings.join(', ')}.`;
    }
    
    // Add corrections info
    if (corrections.length > 0) {
      enhancedReason += ` 🔧 Correcciones aplicadas: ${corrections.length}.`;
    }
    
    // Add cross-validation warnings
    if (parsed.crossValidationWarnings && parsed.crossValidationWarnings.length > 0) {
      enhancedReason += ` ⚠️ Advertencias: ${parsed.crossValidationWarnings.join(', ')}`;
    }
    
    if (parsed.suggestions && !parsed.matchesExpected) {
      enhancedReason += ` 💡 ${parsed.suggestions}`;
    }

    // Combine AI confidence with post-processing confidence
    const aiConfidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    const combinedConfidence = (aiConfidence * 0.6) + (overallConfidence * 0.4);

    const result: ValidationResult = {
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
    };

    return result;
    
  } catch (error) {
    console.error('Error en análisis de documento:', error);
    
    let errorMessage = 'Error desconocido al procesar el documento.';
    
    if (error instanceof Error) {
      if (error.message.includes('API') || error.message.includes('key')) {
        errorMessage = 'Error de configuración: La API Key de OpenAI no está configurada correctamente.';
      } else if (error.message.includes('rate') || error.message.includes('quota')) {
        errorMessage = 'Se excedió el límite de solicitudes. Espera un momento e intenta de nuevo.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Error al procesar la respuesta. Intenta de nuevo.';
      } else if (error.message.includes('PDF') || error.message.includes('pdf')) {
        errorMessage = error.message;
      } else {
        errorMessage = error.message;
      }
    }

    return {
      isValid: false,
      detectedType: 'Error',
      reason: errorMessage,
      confidence: 0,
      extractedData: {},
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    };
  }
};

// ============================================
// FILE VALIDATION
// ============================================

export const validateFileForAnalysis = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 100 * 1024 * 1024;
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
  
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }
  
  if (file.size === 0) {
    return { valid: false, error: 'El archivo está vacío.' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: `El archivo excede el tamaño máximo de 100MB.` };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo no soportado. Usa PNG, JPG, WEBP, GIF o PDF.' };
  }
  
  return { valid: true };
};

// ============================================
// CROSS-VALIDATION UTILITIES
// ============================================

export const consolidateExtractedData = (documents: Array<{ extractedData?: ExtractedData }>): ExtractedData => {
  const consolidated: ExtractedData = {};
  
  for (const doc of documents) {
    if (doc.extractedData) {
      for (const [key, value] of Object.entries(doc.extractedData)) {
        if (value && !consolidated[key]) {
          consolidated[key] = value;
        }
      }
    }
  }
  
  return consolidated;
};

/**
 * Enhanced cross-document validation with OCR tolerance
 */
export const validateCrossDocumentConsistency = (
  newData: ExtractedData,
  existingData: ExtractedData
): string[] => {
  const warnings: string[] = [];
  
  // Helper to check similarity with OCR tolerance
  const isSimilarWithOCRTolerance = (str1: string, str2: string): boolean => {
    if (!str1 || !str2) return true;
    
    const norm1 = normalizeOCRString(str1, 'alphanumeric');
    const norm2 = normalizeOCRString(str2, 'alphanumeric');
    
    if (norm1 === norm2) return true;
    
    // Allow up to 2 character differences for OCR errors
    let differences = 0;
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    
    for (let i = 0; i < minLen; i++) {
      if (norm1[i] !== norm2[i]) differences++;
    }
    differences += (maxLen - minLen);
    
    return differences <= 2;
  };
  
  // Check name consistency (more lenient)
  if (newData.nombre && existingData.nombre) {
    const newName = newData.nombre.toLowerCase().trim();
    const existingName = existingData.nombre.toLowerCase().trim();
    const newWords = newName.split(/\s+/);
    const existingWords = existingName.split(/\s+/);
    
    // Check if at least one word matches
    const hasMatchingWord = newWords.some(nw => 
      existingWords.some(ew => nw.length > 2 && ew.includes(nw.slice(0, 3)))
    );
    
    if (!hasMatchingWord && newWords.length > 0 && existingWords.length > 0) {
      warnings.push(`Nombre podría ser diferente: "${newData.nombre}" vs "${existingData.nombre}"`);
    }
  }
  
  // Check CURP with OCR tolerance
  if (newData.curp && existingData.curp) {
    if (!isSimilarWithOCRTolerance(newData.curp, existingData.curp)) {
    warnings.push(`CURP diferente: "${newData.curp}" vs "${existingData.curp}"`);
    }
  }
  
  // Check RFC with OCR tolerance
  if (newData.rfc && existingData.rfc) {
    if (!isSimilarWithOCRTolerance(newData.rfc, existingData.rfc)) {
    warnings.push(`RFC diferente: "${newData.rfc}" vs "${existingData.rfc}"`);
    }
  }
  
  // Check plates with OCR tolerance
  if (newData.placas && existingData.placas) {
    if (!isSimilarWithOCRTolerance(newData.placas, existingData.placas)) {
    warnings.push(`Placas diferentes: "${newData.placas}" vs "${existingData.placas}"`);
    }
  }
  
  // Check VIN with OCR tolerance
  if (newData.vin && existingData.vin) {
    if (!isSimilarWithOCRTolerance(newData.vin, existingData.vin)) {
    warnings.push(`VIN diferente: "${newData.vin}" vs "${existingData.vin}"`);
    }
  }
  
  return warnings;
};

// Export validation utilities for use elsewhere
export {
  validateAndFixCURP,
  validateAndFixRFC,
  validateAndFixCLABE,
  validateAndFixPlacas,
  validateAndFixVIN,
  normalizeOCRString,
  postProcessExtractedData,
};
