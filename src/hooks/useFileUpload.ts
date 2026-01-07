import { useState, useCallback } from 'react';
import { FILE_CONFIG } from '@/constants';
import { FileValidation } from '@/types';

interface UseFileUploadOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  onError?: (error: string) => void;
}

interface UseFileUploadReturn {
  isProcessing: boolean;
  error: string | null;
  validateFile: (file: File) => FileValidation;
  readFileAsDataUrl: (file: File) => Promise<string>;
  fetchUrlAsDataUrl: (url: string) => Promise<{ dataUrl: string; mimeType: string }>;
  clearError: () => void;
}

export const useFileUpload = (options: UseFileUploadOptions = {}): UseFileUploadReturn => {
  const {
    maxSizeMB = FILE_CONFIG.MAX_SIZE_MB,
    allowedTypes = FILE_CONFIG.ALLOWED_TYPES,
    onError,
  } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
  }, [onError]);

  const validateFile = useCallback((file: File): FileValidation => {
    // Check if file exists
    if (!file) {
      return { isValid: false, error: 'No se seleccionó ningún archivo.' };
    }

    // Check file size
    if (file.size === 0) {
      return { isValid: false, error: 'El archivo está vacío (0 bytes).' };
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { 
        isValid: false, 
        error: `El archivo excede el tamaño máximo de ${maxSizeMB}MB. Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
      };
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      const allowedExtensions = FILE_CONFIG.ALLOWED_EXTENSIONS.join(', ');
      return { 
        isValid: false, 
        error: `Tipo de archivo no soportado (${file.type || 'desconocido'}). Tipos permitidos: ${allowedExtensions}` 
      };
    }

    return { isValid: true, file };
  }, [maxSizeMB, allowedTypes]);

  const readFileAsDataUrl = useCallback(async (file: File): Promise<string> => {
    setIsProcessing(true);
    clearError();

    try {
      // Validate file first
      const validation = validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Read file as data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Error al leer el archivo: resultado inesperado.'));
          }
        };

        reader.onerror = () => {
          const errorMsg = reader.error?.message || 'No se pudo leer el archivo. Verifica los permisos.';
          reject(new Error(errorMsg));
        };

        reader.onabort = () => {
          reject(new Error('La lectura del archivo fue cancelada.'));
        };

        reader.readAsDataURL(file);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al procesar archivo.';
      handleError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [validateFile, clearError, handleError]);

  const fetchUrlAsDataUrl = useCallback(async (url: string): Promise<{ dataUrl: string; mimeType: string }> => {
    setIsProcessing(true);
    clearError();

    try {
      // Fetch the URL
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error al descargar la imagen: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const mimeType = blob.type;

      // Validate blob size
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (blob.size > maxSizeBytes) {
        throw new Error(`La imagen excede el tamaño máximo de ${maxSizeMB}MB.`);
      }

      // Convert blob to data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve({ dataUrl: reader.result, mimeType });
          } else {
            reject(new Error('Error al procesar la imagen descargada.'));
          }
        };

        reader.onerror = () => {
          reject(new Error('Error al leer la imagen descargada.'));
        };

        reader.readAsDataURL(blob);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al descargar la imagen demo.';
      handleError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [maxSizeMB, clearError, handleError]);

  return {
    isProcessing,
    error,
    validateFile,
    readFileAsDataUrl,
    fetchUrlAsDataUrl,
    clearError,
  };
};

