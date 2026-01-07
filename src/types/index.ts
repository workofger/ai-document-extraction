// Document requirement types
export enum RequirementType {
  Encargado = 'Encargado',
  Conductor = 'Conductor',
  Vehiculo = 'Vehículo',
  PersonaMoral = 'Persona Moral',
  PersonaFisica = 'Persona Física',
}

// Document validation status
export enum DocumentStatus {
  Pending = 'pending',
  Analyzing = 'analyzing',
  Valid = 'valid',
  Invalid = 'invalid',
  Error = 'error',
}

// Extracted data from documents
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
  [key: string]: string | number | undefined;
}

// AI validation result
export interface ValidationResult {
  isValid: boolean;
  detectedType: string;
  reason: string;
  confidence: number;
  extractedData: ExtractedData;
  timestamp?: string;
  processingTime?: number;
  matchesExpected?: boolean;
  crossValidationWarnings?: string[];
}

// Document requirement configuration
export interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  status: DocumentStatus;
  result?: ValidationResult;
  filePreview?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt?: string;
}

// Role configuration
export interface RoleConfig {
  id: RequirementType;
  label: string;
  icon: string;
  description: string;
  documents: DocumentRequirement[];
}

// App state for context
export interface AppState {
  selectedRole: RequirementType;
  roleDocuments: Record<string, DocumentRequirement[]>;
  activeDocId: string | null;
  isAnalyzing: boolean;
}

// Toast notification types
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// File validation
export interface FileValidation {
  isValid: boolean;
  error?: string;
  file?: File;
}

// API response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Statistics
export interface DocumentStats {
  total: number;
  valid: number;
  invalid: number;
  pending: number;
  analyzing: number;
}

// History entry
export interface HistoryEntry {
  id: string;
  documentName: string;
  role: RequirementType;
  result: ValidationResult;
  timestamp: string;
  filePreview?: string;
}

