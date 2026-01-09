/**
 * Google Cloud Vision OCR Service
 * 
 * Uses Google Cloud Vision API to extract text from images
 * with high accuracy before sending to GPT-4o for interpretation.
 */

export interface VisionOCRResult {
  success: boolean;
  fullText: string;
  blocks: TextBlock[];
  confidence: number;
  error?: string;
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Extract text from image using Google Cloud Vision API
 */
export async function extractTextWithVision(base64Image: string): Promise<VisionOCRResult> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  
  if (!apiKey) {
    console.log('[Vision] No GOOGLE_CLOUD_API_KEY configured, skipping Vision OCR');
    return {
      success: false,
      fullText: '',
      blocks: [],
      confidence: 0,
      error: 'GOOGLE_CLOUD_API_KEY not configured'
    };
  }

  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    console.log('[Vision] Sending image to Google Cloud Vision API...');

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Data
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 50
                },
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1
                }
              ],
              imageContext: {
                languageHints: ['es', 'en']
              }
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vision] API error:', response.status, errorText);
      return {
        success: false,
        fullText: '',
        blocks: [],
        confidence: 0,
        error: `Vision API error: ${response.status}`
      };
    }

    const data = await response.json();
    const result = data.responses?.[0];

    if (result?.error) {
      console.error('[Vision] Response error:', result.error);
      return {
        success: false,
        fullText: '',
        blocks: [],
        confidence: 0,
        error: result.error.message
      };
    }

    // Get full text from document detection (more accurate for documents)
    const fullTextAnnotation = result?.fullTextAnnotation;
    const textAnnotations = result?.textAnnotations;

    if (!fullTextAnnotation && !textAnnotations?.length) {
      console.log('[Vision] No text detected in image');
      return {
        success: true,
        fullText: '',
        blocks: [],
        confidence: 0,
        error: 'No text detected'
      };
    }

    // Extract full text
    const fullText = fullTextAnnotation?.text || textAnnotations?.[0]?.description || '';

    // Extract text blocks with confidence
    const blocks: TextBlock[] = [];
    let totalConfidence = 0;
    let blockCount = 0;

    if (fullTextAnnotation?.pages) {
      for (const page of fullTextAnnotation.pages) {
        for (const block of page.blocks || []) {
          for (const paragraph of block.paragraphs || []) {
            let paragraphText = '';
            let paragraphConfidence = 0;
            let wordCount = 0;

            for (const word of paragraph.words || []) {
              const wordText = word.symbols?.map((s: { text: string }) => s.text).join('') || '';
              paragraphText += wordText + ' ';
              paragraphConfidence += word.confidence || 0;
              wordCount++;
            }

            if (paragraphText.trim()) {
              const avgConfidence = wordCount > 0 ? paragraphConfidence / wordCount : 0;
              blocks.push({
                text: paragraphText.trim(),
                confidence: avgConfidence
              });
              totalConfidence += avgConfidence;
              blockCount++;
            }
          }
        }
      }
    }

    const overallConfidence = blockCount > 0 ? totalConfidence / blockCount : 0.5;

    console.log(`[Vision] Extracted ${fullText.length} characters with ${(overallConfidence * 100).toFixed(1)}% confidence`);

    return {
      success: true,
      fullText: fullText.trim(),
      blocks,
      confidence: overallConfidence
    };

  } catch (error) {
    console.error('[Vision] Error:', error);
    return {
      success: false,
      fullText: '',
      blocks: [],
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clean and normalize OCR text for better GPT interpretation
 */
export function normalizeOCRText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Fix common OCR errors in Mexican documents
    .replace(/[|]/g, 'I')
    .replace(/[¡]/g, 'I')
    .replace(/[!](?=[A-Z])/g, 'I')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

