import React from 'react';
import { 
  Check, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  AlertTriangle,
  FileText,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useDocuments } from '@/contexts/DocumentContext';
import { DocumentRequirement, DocumentStatus } from '@/types';
import { Card, Badge, Spinner } from '@/components/ui';

export const DocumentList: React.FC = () => {
  const { currentDocs, activeDoc, setActiveDoc, resetDocument } = useDocuments();

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.Valid:
        return <Check size={16} className="text-green-400" />;
      case DocumentStatus.Invalid:
        return <AlertCircle size={16} className="text-red-400" />;
      case DocumentStatus.Error:
        return <AlertTriangle size={16} className="text-orange-400" />;
      case DocumentStatus.Analyzing:
        return <Spinner size="sm" color="accent" />;
      default:
        return <Clock size={16} className="text-pr-muted/60" />;
    }
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.Valid:
        return <Badge variant="success" size="sm">Válido</Badge>;
      case DocumentStatus.Invalid:
        return <Badge variant="error" size="sm">Rechazado</Badge>;
      case DocumentStatus.Error:
        return <Badge variant="warning" size="sm">Error</Badge>;
      case DocumentStatus.Analyzing:
        return <Badge variant="info" size="sm">Analizando</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Pendiente</Badge>;
    }
  };

  const getItemStyles = (doc: DocumentRequirement, isActive: boolean): string => {
    const base = `
      relative transition-all duration-200 p-4 cursor-pointer 
      rounded-xl group
    `;

    if (isActive) {
      return `${base} bg-gradient-to-r from-pr-amber/20 via-pr-amber/10 to-transparent border-l-4 border-pr-amber shadow-lg shadow-pr-amber/10`;
    }

    switch (doc.status) {
      case DocumentStatus.Valid:
        return `${base} bg-gradient-to-r from-green-500/10 to-transparent border-l-4 border-green-500/50 hover:from-green-500/15`;
      case DocumentStatus.Invalid:
        return `${base} bg-gradient-to-r from-red-500/10 to-transparent border-l-4 border-red-500/50 hover:from-red-500/15`;
      case DocumentStatus.Error:
        return `${base} bg-gradient-to-r from-orange-500/10 to-transparent border-l-4 border-orange-500/50 hover:from-orange-500/15`;
      case DocumentStatus.Analyzing:
        return `${base} bg-gradient-to-r from-pr-amber/10 to-transparent border-l-4 border-pr-amber/50 animate-pulse`;
      default:
        return `${base} bg-white/[0.02] hover:bg-white/[0.05] border-l-4 border-white/10 hover:border-white/20`;
    }
  };

  const handleReset = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (window.confirm('¿Deseas reiniciar este documento?')) {
      resetDocument(docId);
    }
  };

  if (currentDocs.length === 0) {
    return (
      <Card className="p-8 text-center bg-gradient-to-br from-pr-gray/50 to-pr-dark/50">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center mb-4 border border-white/5">
          <FileText size={28} className="text-pr-muted/50" />
        </div>
        <p className="text-pr-muted font-medium">No hay documentos para este rol</p>
      </Card>
    );
  }

  return (
    <Card className="flex-1 overflow-hidden flex flex-col">
      {/* Header with gradient accent */}
      <div className="relative p-4 border-b border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-pr-white flex items-center gap-2">
            <FileText size={16} className="text-pr-amber" />
            Requisitos
          </h3>
          <span className="text-xs bg-gradient-to-r from-pr-amber/20 to-orange-500/10 text-pr-amber px-3 py-1 rounded-full font-bold border border-pr-amber/20">
            {currentDocs.length} docs
          </span>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {currentDocs.map((doc) => {
          const isActive = activeDoc?.id === doc.id;
          
          return (
            <div
              key={doc.id}
              onClick={() => setActiveDoc(doc.id)}
              className={getItemStyles(doc, isActive)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveDoc(doc.id)}
              aria-selected={isActive}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className={`font-semibold text-xs xl:text-sm ${isActive ? 'text-pr-amber' : 'text-pr-white'}`}>
                      {doc.name}
                    </h4>
                    
                    {/* Status indicator */}
                    <div className={`
                      flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                      ${doc.status === DocumentStatus.Valid ? 'bg-green-500/20' :
                        doc.status === DocumentStatus.Invalid ? 'bg-red-500/20' :
                        doc.status === DocumentStatus.Analyzing ? 'bg-pr-amber/20' :
                        'bg-white/5'}
                    `}>
                      {getStatusIcon(doc.status)}
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-pr-muted leading-relaxed line-clamp-1">
                    {doc.description}
                  </p>
                  
                  {/* Status badge for completed docs */}
                  {doc.status !== DocumentStatus.Pending && doc.status !== DocumentStatus.Analyzing && (
                    <div className="mt-2.5 flex items-center gap-2">
                      {getStatusBadge(doc.status)}
                      {doc.result?.confidence !== undefined && (
                        <span className="text-[10px] text-pr-muted flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                          <Sparkles size={10} className="text-pr-amber" />
                          {Math.round(doc.result.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 self-center">
                  {/* Reset button for non-pending docs */}
                  {doc.status !== DocumentStatus.Pending && doc.status !== DocumentStatus.Analyzing && (
                    <button
                      onClick={(e) => handleReset(e, doc.id)}
                      className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                      title="Reiniciar documento"
                    >
                      <RotateCcw size={14} className="text-pr-muted" />
                    </button>
                  )}
                  
                  <ChevronRight
                    size={18}
                    className={`
                      transform transition-all text-pr-muted/40 flex-shrink-0
                      ${isActive ? 'translate-x-1 text-pr-amber' : 'group-hover:translate-x-1 group-hover:text-pr-white'}
                    `}
                  />
                </div>
              </div>

              {/* File info if uploaded */}
              {doc.fileName && (
                <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-pr-muted truncate flex items-center gap-2">
                  <FileText size={12} className="flex-shrink-0" />
                  <span className="truncate">{doc.fileName}</span>
                  {doc.fileSize && (
                    <span className="flex-shrink-0 text-pr-muted/60">
                      ({(doc.fileSize / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
