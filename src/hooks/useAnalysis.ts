import { useState, useCallback } from 'react';
import { analyzeDocument, consolidateExtractedData } from '@/services/openaiService';
import { useDocuments } from '@/contexts/DocumentContext';
import { useFileUpload } from './useFileUpload';
import { DocumentStatus, ValidationResult, DocumentRequirement } from '@/types';
import toast from 'react-hot-toast';

interface UseAnalysisReturn {
  isAnalyzing: boolean;
  processFile: (fileOrUrl: File | string) => Promise<ValidationResult | null>;
  cancelAnalysis: () => void;
}

// Map detected types to document names in the system
const DOCUMENT_TYPE_MAPPING: Record<string, string[]> = {
  // INE variations
  'INE': ['INE', 'IFE', 'Credencial de elector', 'Identificación oficial'],
  'IFE': ['INE', 'IFE', 'Credencial de elector', 'Identificación oficial'],
  'Credencial de elector': ['INE', 'IFE'],
  'Identificación oficial': ['INE', 'IFE'],
  
  // License variations
  'Licencia de Conducir': ['Licencia de Conducir', 'Licencia'],
  'Licencia': ['Licencia de Conducir', 'Licencia'],
  
  // Vehicle docs
  'Tarjeta de Circulación': ['Tarjeta de Circulación', 'Circulación'],
  'Póliza de Seguro': ['Póliza de Seguro', 'Póliza', 'Seguro'],
  'Póliza': ['Póliza de Seguro', 'Póliza'],
  'Verificación Vehicular': ['Verificación Vehicular', 'Verificación'],
  
  // Fiscal docs
  'Constancia de Situación Fiscal': ['Constancia de Situación Fiscal', 'Constancia', 'RFC', 'Situación Fiscal'],
  'RFC': ['Constancia de Situación Fiscal', 'Constancia', 'RFC'],
  
  // Bank docs
  'Carátula Bancaria': ['Datos Bancarios', 'Carátula Bancaria', 'Estado de Cuenta'],
  'Estado de Cuenta': ['Datos Bancarios', 'Carátula Bancaria', 'Estado de Cuenta'],
  'Datos Bancarios': ['Datos Bancarios', 'Carátula Bancaria'],
  
  // Legal docs
  'Acta Constitutiva': ['Acta Constitutiva', 'Acta'],
  'Poder Notarial': ['Poder Notarial', 'Poder'],
  
  // Address proof
  'Comprobante de Domicilio': ['Comprobante de Domicilio', 'Domicilio', 'CFE', 'Recibo'],
  'CFE': ['Comprobante de Domicilio', 'CFE'],
  'Recibo de luz': ['Comprobante de Domicilio', 'CFE'],
  'Recibo de agua': ['Comprobante de Domicilio'],
  
  // Phone/Email
  'Comprobante Teléfono': ['Comprobante Teléfono', 'Teléfono'],
  'Correo Electrónico': ['Correo Electrónico', 'Email'],
  
  // Vehicle photos
  'Fotografía de Vehículo': ['Fotos del Vehículo', 'Fotografías', 'Fotos'],
  'Fotos del Vehículo': ['Fotos del Vehículo', 'Fotografías'],
  
  // Background check
  'Carta de Antecedentes': ['Carta de Antecedentes', 'Antecedentes'],
  'Carta de no antecedentes penales': ['Carta de Antecedentes', 'Antecedentes'],
};

// Find the best matching document in the list
const findMatchingDocument = (
  detectedType: string,
  documents: DocumentRequirement[],
  currentDocId: string
): DocumentRequirement | null => {
  // Get possible matches for this detected type
  const possibleMatches = DOCUMENT_TYPE_MAPPING[detectedType] || [detectedType];
  
  // First, try to find an exact pending match (not the current doc)
  for (const doc of documents) {
    if (doc.id !== currentDocId && doc.status === DocumentStatus.Pending) {
      for (const match of possibleMatches) {
        if (doc.name.toLowerCase().includes(match.toLowerCase()) ||
            match.toLowerCase().includes(doc.name.toLowerCase())) {
          return doc;
        }
      }
    }
  }
  
  // If no pending match, check if any doc matches (even if already validated)
  for (const doc of documents) {
    if (doc.id !== currentDocId) {
      for (const match of possibleMatches) {
        if (doc.name.toLowerCase().includes(match.toLowerCase()) ||
            match.toLowerCase().includes(doc.name.toLowerCase())) {
          return doc;
        }
      }
    }
  }
  
  return null;
};

export const useAnalysis = (): UseAnalysisReturn => {
  const { activeDoc, updateDocumentStatus, addToHistory, state, currentDocs, setActiveDoc } = useDocuments();
  const { readFileAsDataUrl, fetchUrlAsDataUrl } = useFileUpload();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const cancelAnalysis = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsAnalyzing(false);
  }, [abortController]);

  const processFile = useCallback(async (fileOrUrl: File | string): Promise<ValidationResult | null> => {
    if (!activeDoc) {
      toast.error('No hay documento seleccionado');
      return null;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setIsAnalyzing(true);

    let base64String = '';
    let previewUrl = '';
    let mimeType = '';
    let fileName = '';
    let fileSize = 0;

    try {
      // Process file or URL
      if (typeof fileOrUrl === 'string') {
        toast.loading('Descargando imagen demo...', { id: 'download' });
        const result = await fetchUrlAsDataUrl(fileOrUrl);
        base64String = result.dataUrl;
        mimeType = result.mimeType;
        previewUrl = fileOrUrl;
        fileName = 'demo-image';
        toast.dismiss('download');
      } else {
        if (fileOrUrl.size === 0) {
          throw new Error('El archivo está vacío (0 bytes).');
        }
        base64String = await readFileAsDataUrl(fileOrUrl);
        previewUrl = URL.createObjectURL(fileOrUrl);
        mimeType = fileOrUrl.type;
        fileName = fileOrUrl.name;
        fileSize = fileOrUrl.size;
      }

      // Update status to analyzing
      updateDocumentStatus(
        activeDoc.id,
        DocumentStatus.Analyzing,
        undefined,
        previewUrl,
        mimeType,
        fileName,
        fileSize
      );

      const analysisToast = toast.loading(
        `Analizando documento...`,
        { id: 'analysis' }
      );

      if (controller.signal.aborted) {
        toast.dismiss(analysisToast);
        return null;
      }

      // Get previously extracted data for cross-validation
      const otherDocs = currentDocs.filter(d => d.id !== activeDoc.id && d.result?.extractedData);
      const previousData = consolidateExtractedData(
        otherDocs.map(d => ({ extractedData: d.result?.extractedData }))
      );

      // Call OpenAI API
      const result = await analyzeDocument(base64String, activeDoc.name, previousData);

      if (controller.signal.aborted) {
        toast.dismiss(analysisToast);
        return null;
      }

      toast.dismiss(analysisToast);

      // Check if document type matches or needs relocation
      const typeMatches = result.matchesExpected !== false;
      let targetDoc = activeDoc;
      let wasRelocated = false;

      if (result.isValid && !typeMatches && result.detectedType !== 'Error') {
        // Try to find the correct document slot for this type
        const matchingDoc = findMatchingDocument(result.detectedType, currentDocs, activeDoc.id);
        
        if (matchingDoc) {
          targetDoc = matchingDoc;
          wasRelocated = true;
          
          // Reset the original document slot to pending AND clear the preview
          updateDocumentStatus(
            activeDoc.id, 
            DocumentStatus.Pending, 
            undefined,  // Clear result
            '',         // Clear preview URL
            '',         // Clear MIME type
            '',         // Clear file name
            0           // Clear file size
          );
        }
      }

      // Determine final status
      const finalStatus = result.isValid ? DocumentStatus.Valid : DocumentStatus.Invalid;

      // Update the target document with result
      updateDocumentStatus(
        targetDoc.id,
        finalStatus,
        result,
        previewUrl,
        mimeType,
        fileName,
        fileSize
      );

      // Add to history
      addToHistory({
        documentName: targetDoc.name,
        role: state.selectedRole,
        result,
        timestamp: new Date().toISOString(),
        filePreview: previewUrl,
      });

      // Show appropriate toast
      if (result.isValid) {
        if (wasRelocated) {
          toast.success(
            `✓ Documento reubicado: "${result.detectedType}" se guardó en "${targetDoc.name}"`,
            { duration: 6000, icon: '📄' }
          );
          
          // Show what's still pending
          const pendingDocs = currentDocs.filter(d => 
            d.id !== targetDoc.id && d.status === DocumentStatus.Pending
          );
          
          if (pendingDocs.length > 0) {
            setTimeout(() => {
              toast(
                `📋 Documentos pendientes: ${pendingDocs.map(d => d.name).join(', ')}`,
                { duration: 5000, icon: 'ℹ️' }
              );
            }, 1500);
          }
          
          // Switch to the relocated document
          setActiveDoc(targetDoc.id);
        } else {
          toast.success(`✓ ${targetDoc.name} validado correctamente`, {
            duration: 4000,
            icon: '✅',
          });
        }
        
        // Show cross-validation warnings if any
        if (result.crossValidationWarnings && result.crossValidationWarnings.length > 0) {
          setTimeout(() => {
            toast(
              `⚠️ Validación cruzada:\n${result.crossValidationWarnings?.join('\n')}`,
              { duration: 8000, icon: '⚠️' }
            );
          }, wasRelocated ? 3000 : 1000);
        }
      } else {
        toast.error(`✗ ${result.detectedType}: ${result.reason.substring(0, 80)}...`, {
          duration: 5000,
          icon: '❌',
        });
      }

      return result;

    } catch (error) {
      console.error('Analysis error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      const errorResult: ValidationResult = {
        isValid: false,
        detectedType: 'Error',
        reason: errorMessage,
        confidence: 0,
        extractedData: {},
        timestamp: new Date().toISOString(),
      };

      updateDocumentStatus(
        activeDoc.id,
        DocumentStatus.Error,
        errorResult,
        previewUrl,
        mimeType,
        fileName,
        fileSize
      );

      toast.dismiss('analysis');
      toast.error(errorMessage, { duration: 5000 });

      return errorResult;

    } finally {
      setIsAnalyzing(false);
      setAbortController(null);
    }
  }, [activeDoc, updateDocumentStatus, addToHistory, state.selectedRole, currentDocs, setActiveDoc, readFileAsDataUrl, fetchUrlAsDataUrl]);

  return {
    isAnalyzing,
    processFile,
    cancelAnalysis,
  };
};
