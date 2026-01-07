import React, { useRef, useState, useCallback } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  X, 
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Download,
  Sparkles,
  Scan,
  Camera,
  FileImage,
  FolderOpen
} from 'lucide-react';
import { useDocuments } from '@/contexts/DocumentContext';
import { useAnalysis } from '@/hooks/useAnalysis';
import { Card, CardHeader, Button } from '@/components/ui';
import { FILE_CONFIG, DEMO_IMAGES_EXTERNAL } from '@/constants';

export const UploadArea: React.FC = () => {
  const { activeDoc } = useDocuments();
  const { isAnalyzing, processFile, cancelAnalysis } = useAnalysis();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
      e.target.value = '';
    }
  }, [processFile]);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCameraClick = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const handleDemoSelect = useCallback((imageUrl: string) => {
    processFile(imageUrl);
  }, [processFile]);

  const isPdf = activeDoc?.mimeType === 'application/pdf';
  const hasPreview = Boolean(activeDoc?.filePreview);

  if (!activeDoc) {
    return (
      <Card className="h-full flex flex-col bg-gradient-to-br from-pr-gray/50 to-pr-dark/50">
        <div className="flex-1 flex items-center justify-center text-pr-muted p-8">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center border border-white/5">
              <FileText size={36} className="text-pr-muted/50" />
            </div>
            <p className="font-display font-bold text-pr-white/70 text-lg">Selecciona un documento</p>
            <p className="text-sm mt-2 text-pr-muted">de la lista de requisitos</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* Header with gradient */}
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pr-amber via-orange-500 to-pr-amber" />
        <CardHeader className="border-b border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm md:text-base font-display font-bold text-pr-white truncate flex items-center gap-2">
                <span className="w-2 h-2 bg-pr-amber rounded-full shadow-sm shadow-pr-amber/50 animate-pulse flex-shrink-0" />
                <span className="truncate">{activeDoc.name}</span>
              </h2>
              <p className="text-[11px] md:text-xs text-pr-muted truncate mt-0.5">{activeDoc.description}</p>
            </div>
            {isAnalyzing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelAnalysis}
                className="!bg-red-500/10 text-red-400 hover:text-red-300 hover:!bg-red-500/20 flex-shrink-0 !rounded-xl"
              >
                <X size={16} />
                <span className="hidden sm:inline">Cancelar</span>
              </Button>
            )}
          </div>
        </CardHeader>
      </div>

      {/* Upload/Preview Area */}
      <div className="flex-1 p-3 md:p-4 flex flex-col gap-3 md:gap-4 overflow-hidden">
        <div
          className={`
            relative flex-1 rounded-2xl overflow-hidden border-2 border-dashed 
            transition-all duration-300 group min-h-[280px] md:min-h-[320px]
            ${dragActive 
              ? 'border-pr-amber bg-gradient-to-br from-pr-amber/10 to-orange-500/5 scale-[1.01]' 
              : 'border-white/10 bg-gradient-to-br from-pr-dark/80 to-pr-charcoal/50 hover:border-white/20'
            }
            ${hasPreview ? '!border-none' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {/* Decorative corners */}
          {!hasPreview && !isAnalyzing && (
            <>
              <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-pr-amber/30 rounded-tl-lg" />
              <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-pr-amber/30 rounded-tr-lg" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-pr-amber/30 rounded-bl-lg" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-pr-amber/30 rounded-br-lg" />
            </>
          )}

          {/* Loading Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-pr-charcoal/95 backdrop-blur-md flex flex-col items-center justify-center z-30">
              <div className="relative">
                {/* Animated rings */}
                <div className="absolute inset-[-20px] border-2 border-pr-amber/20 rounded-full animate-ping" />
                <div className="absolute inset-[-10px] border-2 border-pr-amber/30 rounded-full animate-pulse" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-pr-gray to-pr-dark border-2 border-pr-amber/50 flex items-center justify-center shadow-2xl shadow-pr-amber/20">
                  <Scan size={40} className="text-pr-amber animate-pulse" />
                </div>
              </div>
              <p className="mt-8 font-display font-bold text-pr-white text-lg">Analizando documento...</p>
              <p className="text-sm text-pr-muted mt-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                GPT-4o Vision procesando
              </p>
              <div className="mt-6 w-56">
                <div className="h-2 bg-pr-gray rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pr-amber via-orange-500 to-pr-amber rounded-full animate-shimmer" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          )}

          {hasPreview ? (
            <>
              {/* Preview */}
              {isPdf ? (
                <iframe
                  src={activeDoc.filePreview}
                  className="w-full h-full bg-pr-dark"
                  title="Vista previa del documento"
                />
              ) : (
                <img
                  src={activeDoc.filePreview}
                  alt="Vista previa del documento"
                  className={`
                    w-full h-full object-contain transition-transform duration-300
                    ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}
                  `}
                  onClick={() => setIsZoomed(!isZoomed)}
                />
              )}

              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-gradient-to-t from-pr-charcoal via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-6 z-10">
                <div className="flex gap-2">
                  <Button
                    onClick={handleFileClick}
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw size={14} />}
                    className="!bg-pr-gray/95 hover:!bg-pr-gray border-white/10 shadow-xl"
                  >
                    Cambiar
                  </Button>
                  {!isPdf && (
                    <Button
                      onClick={() => setIsZoomed(!isZoomed)}
                      variant="secondary"
                      size="sm"
                      leftIcon={isZoomed ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
                      className="!bg-pr-gray/95 hover:!bg-pr-gray border-white/10 shadow-xl"
                    >
                      {isZoomed ? 'Alejar' : 'Zoom'}
                    </Button>
                  )}
                  {activeDoc.filePreview && (
                    <a
                      href={activeDoc.filePreview}
                      download={activeDoc.fileName || 'documento'}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-pr-gray/95 hover:bg-pr-gray text-pr-white transition-colors border border-white/10 shadow-xl"
                    >
                      <Download size={14} />
                      <span className="hidden sm:inline">Descargar</span>
                    </a>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Upload Prompt */
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <div className={`
                relative w-20 h-20 md:w-28 md:h-28 rounded-3xl flex items-center justify-center mb-4 md:mb-5
                transition-all duration-300
                ${dragActive 
                  ? 'bg-gradient-to-br from-pr-amber to-orange-500 text-pr-charcoal scale-110 shadow-2xl shadow-pr-amber/40' 
                  : 'bg-gradient-to-br from-pr-gray to-pr-dark border border-white/10 text-pr-amber'
                }
              `}>
                {dragActive && (
                  <div className="absolute inset-0 bg-pr-amber/30 rounded-3xl blur-xl" />
                )}
                <div className="relative z-10 flex flex-col items-center">
                  <Upload size={32} className="md:w-9 md:h-9" />
                </div>
              </div>
              
              <p className="font-display font-bold text-pr-white text-base md:text-lg mb-1 md:mb-2">
                {dragActive ? '¡Suelta aquí!' : 'Sube tu documento'}
              </p>
              <p className="text-xs md:text-sm text-pr-muted mb-4 md:mb-5 hidden md:block">
                Arrastra o selecciona una opción
              </p>

              {/* Upload Buttons - Two options for mobile */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full max-w-xs mb-4">
                <button
                  onClick={handleCameraClick}
                  disabled={isAnalyzing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-pr-amber to-orange-500 hover:from-pr-amber/90 hover:to-orange-500/90 rounded-xl text-sm font-bold text-pr-charcoal transition-all duration-200 disabled:opacity-50 shadow-lg shadow-pr-amber/20 active:scale-95"
                >
                  <Camera size={18} />
                  <span>Tomar foto</span>
                </button>
                <button
                  onClick={handleFileClick}
                  disabled={isAnalyzing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-pr-gray to-pr-dark hover:from-pr-gray/80 hover:to-pr-dark/80 rounded-xl text-sm font-bold text-pr-white transition-all duration-200 border border-white/10 hover:border-pr-amber/30 disabled:opacity-50 shadow-lg active:scale-95"
                >
                  <FolderOpen size={18} />
                  <span>Elegir archivo</span>
                </button>
              </div>
              
              {/* Supported formats */}
              <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
                {['PNG', 'JPG', 'PDF'].map((format) => (
                  <span 
                    key={format}
                    className="px-2 md:px-3 py-0.5 md:py-1 rounded-lg bg-white/5 text-[10px] md:text-xs font-semibold text-pr-muted border border-white/5"
                  >
                    {format}
                  </span>
                ))}
                <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-lg bg-pr-amber/10 text-[10px] md:text-xs font-semibold text-pr-amber border border-pr-amber/20">
                  Max 100MB
                </span>
              </div>
            </div>
          )}

          {/* Hidden Inputs - Separate for camera and file picker */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isAnalyzing}
            capture="environment"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_CONFIG.ALLOWED_TYPES.join(', ')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isAnalyzing}
          />
        </div>

        {/* Demo Controls - Enhanced */}
        <div className="relative overflow-hidden rounded-xl flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-pr-amber/5 via-transparent to-orange-500/5" />
          <div className="relative p-4 border border-pr-amber/10">
            <h4 className="text-[10px] font-bold text-pr-amber uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles size={12} />
              Prueba con imágenes demo
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => handleDemoSelect(DEMO_IMAGES_EXTERNAL.INE)}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-br from-pr-gray/80 to-pr-dark/80 hover:from-pr-gray hover:to-pr-gray rounded-xl text-sm font-semibold text-pr-white whitespace-nowrap transition-all duration-200 border border-white/5 hover:border-pr-amber/30 disabled:opacity-50 group shadow-lg"
              >
                <div className="w-8 h-8 rounded-lg bg-pr-amber/20 flex items-center justify-center group-hover:bg-pr-amber/30 transition-colors">
                  <ImageIcon size={16} className="text-pr-amber" />
                </div>
                <span>INE Demo</span>
              </button>
              <button
                onClick={() => handleDemoSelect(DEMO_IMAGES_EXTERNAL.GENERIC)}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-br from-pr-gray/80 to-pr-dark/80 hover:from-pr-gray hover:to-pr-gray rounded-xl text-sm font-semibold text-pr-white whitespace-nowrap transition-all duration-200 border border-white/5 hover:border-green-500/30 disabled:opacity-50 group shadow-lg"
              >
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                  <FileImage size={16} className="text-green-500" />
                </div>
                <span>Doc Demo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
