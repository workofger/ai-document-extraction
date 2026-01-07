import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  FileText, 
  Clock, 
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ShieldCheck,
  ShieldAlert,
  Scan,
  Wrench,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react';
import { useDocuments } from '@/contexts/DocumentContext';
import { DocumentStatus, ExtractedData } from '@/types';
import { Card, Badge, SkeletonAnalysis, CircularProgress } from '@/components/ui';
import { validateAndFixCURP, validateAndFixRFC, validateAndFixCLABE } from '@/services/openaiService';
import toast from 'react-hot-toast';

export const AnalysisResult: React.FC = () => {
  const { activeDoc, state, updateDocumentStatus} = useDocuments();
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showOCRDetails, setShowOCRDetails] = useState(false);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      toast.success('Copiado al portapapeles');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleEdit = (key: string, currentValue: string) => {
    setEditingField(key);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (key: string) => {
    if (!activeDoc || !activeDoc.result) return;
    
    let finalValue = editValue.trim();
    let validationMessage = '';
    
    if (key === 'curp') {
      const result = validateAndFixCURP(finalValue);
      finalValue = result.corrected;
      if (!result.valid) {
        validationMessage = 'CURP corregido pero podría tener errores';
      }
    } else if (key === 'rfc') {
      const result = validateAndFixRFC(finalValue);
      finalValue = result.corrected;
      if (!result.valid) {
        validationMessage = 'RFC corregido pero podría tener errores';
      }
    } else if (key === 'clabe') {
      const result = validateAndFixCLABE(finalValue);
      finalValue = result.corrected;
      if (!result.valid) {
        validationMessage = 'CLABE corregido pero checksum inválido';
      }
    }
    
    const updatedData: ExtractedData = {
      ...activeDoc.result.extractedData,
      [key]: finalValue
    };
    
    const updatedResult = {
      ...activeDoc.result,
      extractedData: updatedData,
      reason: activeDoc.result.reason + (validationMessage ? ` [Editado: ${key}]` : '')
    };
    
    updateDocumentStatus(
      activeDoc.id,
      activeDoc.status,
      updatedResult,
      activeDoc.filePreview,
      activeDoc.mimeType,
      activeDoc.fileName,
      activeDoc.fileSize
    );
    
    setEditingField(null);
    setEditValue('');
    toast.success(validationMessage || `${formatFieldName(key)} actualizado`);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Loading state
  if (state.isAnalyzing || activeDoc?.status === DocumentStatus.Analyzing) {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <div className="relative p-4 md:p-5 border-b border-pr-amber/20 bg-gradient-to-br from-pr-amber/10 to-orange-500/5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pr-amber via-orange-500 to-pr-amber animate-shimmer" />
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-pr-amber/30 rounded-xl blur-lg animate-pulse" />
              <div className="relative w-14 h-14 bg-gradient-to-br from-pr-gray to-pr-dark rounded-xl flex items-center justify-center border border-pr-amber/30 shadow-lg">
                <Scan size={26} className="text-pr-amber animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="font-display font-bold text-pr-amber text-lg">Analizando...</h3>
              <p className="text-xs text-pr-muted flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                GPT-4o Vision procesando
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <SkeletonAnalysis />
        </div>
      </Card>
    );
  }

  // No document selected or no result
  if (!activeDoc || !activeDoc.result) {
    return (
      <Card className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-pr-gray/30 to-pr-dark/30 border-2 border-dashed border-white/10">
        <div className="text-center p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-white/5 to-white/0 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-white/5">
            <FileText size={32} className="text-pr-muted/40" />
          </div>
          <p className="font-display font-bold text-pr-white/70 text-lg mb-2">Sin análisis</p>
          <p className="text-sm text-pr-muted max-w-xs">
            Sube un documento para ver el análisis con IA
          </p>
        </div>
      </Card>
    );
  }

  const { result } = activeDoc;
  const hasExtractedData = Object.keys(result.extractedData || {}).length > 0;
  const hasOCRWarnings = result.crossValidationWarnings?.some(w => w.startsWith('OCR:'));
  const typeMatches = result.matchesExpected !== false;

  const ocrWarnings = result.crossValidationWarnings?.filter(w => w.startsWith('OCR:')) || [];
  const otherWarnings = result.crossValidationWarnings?.filter(w => !w.startsWith('OCR:')) || [];

  const formatFieldName = (key: string): string => {
    const fieldLabels: Record<string, string> = {
      nombre: 'Nombre',
      folio: 'Folio',
      rfc: 'RFC',
      curp: 'CURP',
      vigencia: 'Vigencia',
      vigenciaFin: 'Vencimiento',
      placas: 'Placas',
      direccion: 'Dirección',
      claveElector: 'Clave Elector',
      numeroLicencia: 'No. Licencia',
      tipoLicencia: 'Tipo Licencia',
      modelo: 'Modelo',
      marca: 'Marca',
      anio: 'Año',
      vin: 'VIN/NIV',
      aseguradora: 'Aseguradora',
      poliza: 'No. Póliza',
      razonSocial: 'Razón Social',
      codigoPostal: 'C.P.',
      clabe: 'CLABE',
      numeroCuenta: 'No. Cuenta',
      banco: 'Banco',
      telefono: 'Teléfono',
      email: 'Email',
    };
    return fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  };

  const isEditableField = (key: string): boolean => {
    return ['curp', 'rfc', 'clabe', 'vin', 'placas', 'numeroLicencia', 'claveElector', 'folio'].includes(key);
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* Header with Status - Enhanced */}
      <div className={`
        relative p-4 md:p-5 border-b flex items-center justify-between
        ${result.isValid 
          ? 'bg-gradient-to-br from-green-500/15 via-green-500/10 to-emerald-500/5 border-green-500/20' 
          : 'bg-gradient-to-br from-red-500/15 via-red-500/10 to-rose-500/5 border-red-500/20'
        }
      `}>
        {/* Top gradient line */}
        <div className={`
          absolute top-0 left-0 right-0 h-1
          ${result.isValid 
            ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-500' 
            : 'bg-gradient-to-r from-red-500 via-rose-500 to-red-500'
          }
        `} />
        
        <div className="flex items-center gap-3 md:gap-4">
          <div className={`
            relative w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center
            ${result.isValid 
              ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/20 shadow-lg shadow-green-500/20' 
              : 'bg-gradient-to-br from-red-500/30 to-rose-500/20 shadow-lg shadow-red-500/20'
            }
          `}>
            {result.isValid ? (
              <CheckCircle className="text-green-400" size={32} />
            ) : result.detectedType === 'Error' ? (
              <AlertTriangle className="text-orange-400" size={32} />
            ) : (
              <XCircle className="text-red-400" size={32} />
            )}
          </div>
          
          <div>
            <h3 className={`font-display font-bold text-base md:text-lg truncate ${result.isValid ? 'text-green-400' : 'text-red-400'}`}>
              {result.isValid ? '¡Válido!' : result.detectedType === 'Error' ? 'Error' : 'Rechazado'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant={result.isValid ? 'success' : 'error'} size="sm">
                <span className="truncate max-w-[80px]">{result.detectedType}</span>
              </Badge>
              {result.processingTime && (
                <span className="text-[10px] text-pr-muted flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                  <Zap size={10} className="text-pr-amber" />
                  {(result.processingTime / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Confidence Score */}
        <div className="text-center">
          <CircularProgress
            value={result.confidence * 100}
            size={60}
            strokeWidth={5}
            color={result.isValid ? '#22c55e' : '#ef4444'}
          />
          <p className="text-[10px] text-pr-muted mt-1 font-semibold">Confianza</p>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="p-3 md:p-4 overflow-y-auto flex-1 space-y-3 md:space-y-4">
        {/* OCR Correction Notice */}
        {hasOCRWarnings && (
          <div className="relative overflow-hidden rounded-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/5" />
            <div className="relative p-3 md:p-4 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="text-blue-400" size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-blue-400">
                      Correcciones OCR
                    </h4>
                    <button
                      onClick={() => setShowOCRDetails(!showOCRDetails)}
                      className="text-blue-400 hover:text-blue-300 p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                      {showOCRDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-blue-300/80 mt-1">
                    Se corrigieron automáticamente errores de lectura
                  </p>
                  {showOCRDetails && ocrWarnings.length > 0 && (
                    <ul className="text-xs text-blue-300/70 mt-2 space-y-1">
                      {ocrWarnings.map((warning, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-blue-500">•</span>
                          {warning.replace('OCR: ', '')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cross-Validation Warnings */}
        {otherWarnings.length > 0 && (
          <div className="relative overflow-hidden rounded-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/5" />
            <div className="relative p-3 md:p-4 border border-orange-500/20">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="text-orange-400" size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-orange-400">Advertencias</h4>
                  <ul className="text-xs text-orange-300/80 mt-2 space-y-1">
                    {otherWarnings.map((warning, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-orange-500">•</span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Type Mismatch Info */}
        {!typeMatches && result.isValid && (
          <div className="relative overflow-hidden rounded-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/5" />
            <div className="relative p-3 md:p-4 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Info className="text-blue-400" size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-400">Tipo diferente</h4>
                  <p className="text-xs text-blue-300/80 mt-1">
                    Se esperaba "{activeDoc.name}" pero se detectó "{result.detectedType}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis Reason */}
        <div>
          <h4 className="label flex items-center gap-2 mb-3">
            <Sparkles size={12} className="text-pr-amber" />
            Análisis IA
          </h4>
          <div className={`
            p-3 md:p-4 rounded-xl border text-sm leading-relaxed
            ${result.isValid 
              ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20 text-green-300' 
              : 'bg-gradient-to-br from-red-500/10 to-rose-500/5 border-red-500/20 text-red-300'
            }
          `}>
            {result.reason}
          </div>
        </div>

        {/* Extracted Data */}
        <div>
          <h4 className="label flex items-center gap-2 mb-3">
            <FileText size={12} className="text-pr-amber" />
            Datos Extraídos
            {hasExtractedData && (
              <Badge variant="amber" size="sm">
                {Object.keys(result.extractedData).length} campos
              </Badge>
            )}
          </h4>

          {hasExtractedData ? (
            <div className="rounded-xl overflow-hidden border border-white/5">
              <div className="bg-gradient-to-br from-pr-dark/80 to-pr-charcoal/50 divide-y divide-white/5">
                {Object.entries(result.extractedData).map(([key, value]) => {
                  if (!value) return null;
                  const isCopied = copiedField === key;
                  const isEditing = editingField === key;
                  const canEdit = isEditableField(key);
                  
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 md:p-4 hover:bg-white/[0.02] transition-colors group"
                    >
                      <span className="text-[11px] font-semibold text-pr-muted capitalize truncate max-w-[80px]">
                        {formatFieldName(key)}
                      </span>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                              className="font-mono text-xs text-pr-white bg-pr-charcoal px-3 py-2 rounded-lg border border-pr-amber/50 focus:outline-none focus:border-pr-amber w-[160px] md:w-[180px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(key);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <button
                              onClick={() => handleSaveEdit(key)}
                              className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 transition-all"
                              title="Guardar"
                            >
                              <Save size={14} className="text-green-400" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-all"
                              title="Cancelar"
                            >
                              <X size={14} className="text-red-400" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span 
                              className="font-mono text-[11px] text-pr-white bg-pr-gray/80 px-2 py-1 rounded-lg border border-white/5 max-w-[100px] md:max-w-[140px] truncate" 
                              title={String(value)}
                            >
                              {String(value)}
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => handleEdit(key, String(value))}
                                className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-500/20 transition-all"
                                title="Editar"
                              >
                                <Edit3 size={14} className="text-blue-400" />
                              </button>
                            )}
                            <button
                              onClick={() => handleCopy(key, String(value))}
                              className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                              title="Copiar"
                            >
                              {isCopied ? (
                                <Check size={14} className="text-green-400" />
                              ) : (
                                <Copy size={14} className="text-pr-muted" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gradient-to-br from-pr-dark/50 to-pr-charcoal/30 rounded-xl border border-dashed border-white/10">
              <FileText size={24} className="mx-auto mb-3 text-pr-muted/40" />
              <p className="text-xs text-pr-muted">No se pudo extraer información</p>
            </div>
          )}
        </div>

        {/* Success Summary */}
        {result.isValid && hasExtractedData && (
          <div className="relative overflow-hidden rounded-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/5" />
            <div className="relative p-3 md:p-4 border border-green-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="text-green-400" size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-400">
                    Documento verificado ✓
                  </p>
                  <p className="text-[11px] text-green-400/60 mt-0.5">
                    Datos extraídos y corregidos
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timestamp */}
        {result.timestamp && (
          <div className="pt-3 border-t border-white/5">
            <p className="text-[10px] text-pr-muted flex items-center gap-1.5">
              <Clock size={10} />
              {new Date(result.timestamp).toLocaleString('es-MX')}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
