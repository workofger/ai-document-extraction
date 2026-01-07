import { RequirementType, RoleConfig, DocumentStatus, DocumentRequirement } from '@/types';

// Helper to generate a fresh document object
const createDoc = (id: string, name: string, description: string): DocumentRequirement => ({
  id,
  name,
  description,
  status: DocumentStatus.Pending,
});

// Role configurations with their required documents
export const ROLES: RoleConfig[] = [
  {
    id: RequirementType.Encargado,
    label: 'Encargado',
    icon: 'briefcase',
    description: 'Responsable de la operación logística',
    documents: [
      createDoc('enc_ine', 'INE', 'Identificación oficial (ambos lados, legible)'),
      createDoc('enc_licencia', 'Licencia de Conducir', 'Licencia vigente (ambos lados)'),
      createDoc('enc_telefono', 'Comprobante Teléfono', 'Recibo o estado de cuenta del número'),
      createDoc('enc_email', 'Correo Electrónico', 'Captura de pantalla del correo'),
    ],
  },
  {
    id: RequirementType.Conductor,
    label: 'Conductor',
    icon: 'user',
    description: 'Operador del vehículo de carga',
    documents: [
      createDoc('con_ine', 'INE', 'Identificación oficial (ambos lados, legible)'),
      createDoc('con_licencia', 'Licencia de Conducir', 'Licencia tipo E o superior vigente'),
      createDoc('con_telefono', 'Comprobante Teléfono', 'Evidencia del número telefónico'),
      createDoc('con_antecedentes', 'Carta de Antecedentes', 'Carta de no antecedentes penales'),
    ],
  },
  {
    id: RequirementType.Vehiculo,
    label: 'Vehículo',
    icon: 'truck',
    description: 'Unidad de transporte',
    documents: [
      createDoc('veh_fotos', 'Fotos del Vehículo', 'Frontal, lateral derecho, lateral izquierdo, trasera'),
      createDoc('veh_circulacion', 'Tarjeta de Circulación', 'Ambos lados, vigente'),
      createDoc('veh_poliza', 'Póliza de Seguro', 'Póliza de responsabilidad civil vigente'),
      createDoc('veh_verificacion', 'Verificación Vehicular', 'Constancia de verificación vigente'),
    ],
  },
  {
    id: RequirementType.PersonaMoral,
    label: 'Persona Moral',
    icon: 'building',
    description: 'Empresa constituida legalmente',
    documents: [
      createDoc('pm_constancia', 'Constancia de Situación Fiscal', 'RFC actualizado (no mayor a 3 meses)'),
      createDoc('pm_acta', 'Acta Constitutiva', 'Primera hoja + hoja de datos + INE Rep. Legal'),
      createDoc('pm_poder', 'Poder Notarial', 'En caso de representante diferente'),
      createDoc('pm_banco', 'Datos Bancarios', 'Carátula bancaria con CLABE (18 dígitos)'),
    ],
  },
  {
    id: RequirementType.PersonaFisica,
    label: 'Persona Física',
    icon: 'user-check',
    description: 'Persona física con actividad empresarial',
    documents: [
      createDoc('pf_constancia', 'Constancia de Situación Fiscal', 'RFC actualizado (no mayor a 3 meses)'),
      createDoc('pf_ine', 'INE', 'Identificación oficial vigente'),
      createDoc('pf_banco', 'Datos Bancarios', 'Carátula bancaria con CLABE (18 dígitos)'),
      createDoc('pf_domicilio', 'Comprobante de Domicilio', 'No mayor a 3 meses'),
    ],
  },
];

// Demo images stored in public folder for reliability
export const DEMO_IMAGES = {
  INE: '/doc_demo/demo/ine-example.jpg',
  LICENSE: '/doc_demo/demo/licencia-example.jpg',
  INVOICE: '/doc_demo/demo/factura-example.jpg',
  CIRCULACION: '/doc_demo/demo/circulacion-example.jpg',
};

// External demo images (fallback)
export const DEMO_IMAGES_EXTERNAL = {
  INE: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=640&q=80',
  GENERIC: 'https://images.unsplash.com/photo-1568219557405-376e23e4f7cf?w=640&q=80',
};

// File validation constants
export const FILE_CONFIG = {
  MAX_SIZE_MB: 100,
  MAX_SIZE_BYTES: 100 * 1024 * 1024, // 100MB máximo
  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'],
};

// API configuration
export const API_CONFIG = {
  OPENAI_MODEL: 'gpt-4o', // Vision model - best OCR accuracy
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  TIMEOUT_MS: 60000, // 60 segundos para archivos grandes
};

// Local storage keys
export const STORAGE_KEYS = {
  ROLE_DOCUMENTS: 'docval_role_documents',
  SELECTED_ROLE: 'docval_selected_role',
  HISTORY: 'docval_history',
  THEME: 'docval_theme',
};

// Status messages
export const STATUS_MESSAGES = {
  [DocumentStatus.Pending]: 'Pendiente de revisión',
  [DocumentStatus.Analyzing]: 'Analizando con IA...',
  [DocumentStatus.Valid]: 'Documento válido',
  [DocumentStatus.Invalid]: 'Documento rechazado',
  [DocumentStatus.Error]: 'Error en el análisis',
};

// Validation rules per document type
export const VALIDATION_RULES: Record<string, string[]> = {
  INE: [
    'Debe mostrar ambos lados',
    'Debe ser legible',
    'No debe estar vencida',
    'Foto clara del rostro',
  ],
  'Licencia de Conducir': [
    'Tipo E o superior para vehículos de carga',
    'Debe estar vigente',
    'Ambos lados visibles',
  ],
  'Tarjeta de Circulación': [
    'Placas claramente visibles',
    'Datos del vehículo legibles',
    'Vigencia actualizada',
  ],
  'Constancia de Situación Fiscal': [
    'Emitida por el SAT',
    'No mayor a 3 meses',
    'RFC correcto',
  ],
  'Póliza de Seguro': [
    'Cobertura de responsabilidad civil',
    'Vigencia activa',
    'Datos del vehículo correctos',
  ],
  'Datos Bancarios': [
    'CLABE de 18 dígitos',
    'Nombre del titular',
    'Banco emisor',
  ],
};

