import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  RequirementType, 
  DocumentRequirement, 
  DocumentStatus, 
  ValidationResult,
  DocumentStats,
  HistoryEntry 
} from '@/types';
import { ROLES, STORAGE_KEYS } from '@/constants';
import { v4 as uuidv4 } from 'uuid';

// State interface
interface DocumentState {
  selectedRole: RequirementType;
  roleDocuments: Record<string, DocumentRequirement[]>;
  activeDocId: string | null;
  isAnalyzing: boolean;
  history: HistoryEntry[];
}

// Action types
type DocumentAction =
  | { type: 'SET_ROLE'; payload: RequirementType }
  | { type: 'SET_ACTIVE_DOC'; payload: string | null }
  | { type: 'SET_ANALYZING'; payload: boolean }
  | { type: 'UPDATE_DOC_STATUS'; payload: { docId: string; status: DocumentStatus; result?: ValidationResult; preview?: string; mimeType?: string; fileName?: string; fileSize?: number } }
  | { type: 'RESET_DOCUMENT'; payload: string }
  | { type: 'RESET_ROLE'; payload: RequirementType }
  | { type: 'RESET_ALL' }
  | { type: 'ADD_TO_HISTORY'; payload: HistoryEntry }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'LOAD_STATE'; payload: Partial<DocumentState> };

// Context interface
interface DocumentContextValue {
  state: DocumentState;
  dispatch: React.Dispatch<DocumentAction>;
  // Computed values
  currentDocs: DocumentRequirement[];
  activeDoc: DocumentRequirement | undefined;
  stats: DocumentStats;
  // Helper actions
  setRole: (role: RequirementType) => void;
  setActiveDoc: (docId: string | null) => void;
  updateDocumentStatus: (docId: string, status: DocumentStatus, result?: ValidationResult, preview?: string, mimeType?: string, fileName?: string, fileSize?: number) => void;
  resetDocument: (docId: string) => void;
  resetRole: (role: RequirementType) => void;
  resetAll: () => void;
  addToHistory: (entry: Omit<HistoryEntry, 'id'>) => void;
  clearHistory: () => void;
}

// Initial state
const getInitialState = (): DocumentState => {
  const initialDocs: Record<string, DocumentRequirement[]> = {};
  
  ROLES.forEach(role => {
    initialDocs[role.id] = role.documents.map(doc => ({ ...doc }));
  });

  return {
    selectedRole: RequirementType.Encargado,
    roleDocuments: initialDocs,
    activeDocId: initialDocs[RequirementType.Encargado]?.[0]?.id || null,
    isAnalyzing: false,
    history: [],
  };
};

// Reducer
const documentReducer = (state: DocumentState, action: DocumentAction): DocumentState => {
  switch (action.type) {
    case 'SET_ROLE': {
      const newRole = action.payload;
      const firstDocId = state.roleDocuments[newRole]?.[0]?.id || null;
      return {
        ...state,
        selectedRole: newRole,
        activeDocId: state.roleDocuments[newRole]?.find(d => d.id === state.activeDocId) 
          ? state.activeDocId 
          : firstDocId,
      };
    }

    case 'SET_ACTIVE_DOC':
      return {
        ...state,
        activeDocId: action.payload,
      };

    case 'SET_ANALYZING':
      return {
        ...state,
        isAnalyzing: action.payload,
      };

    case 'UPDATE_DOC_STATUS': {
      const { docId, status, result, preview, mimeType, fileName, fileSize } = action.payload;
      return {
        ...state,
        roleDocuments: {
          ...state.roleDocuments,
          [state.selectedRole]: state.roleDocuments[state.selectedRole]?.map(doc =>
            doc.id === docId
              ? {
                  ...doc,
                  status,
                  // Use undefined check to allow clearing values with empty strings
                  result: result !== undefined ? result : doc.result,
                  filePreview: preview !== undefined ? preview : doc.filePreview,
                  mimeType: mimeType !== undefined ? mimeType : doc.mimeType,
                  fileName: fileName !== undefined ? fileName : doc.fileName,
                  fileSize: fileSize !== undefined ? fileSize : doc.fileSize,
                  uploadedAt: new Date().toISOString(),
                }
              : doc
          ) || [],
        },
      };
    }

    case 'RESET_DOCUMENT': {
      const docId = action.payload;
      return {
        ...state,
        roleDocuments: {
          ...state.roleDocuments,
          [state.selectedRole]: state.roleDocuments[state.selectedRole]?.map(doc =>
            doc.id === docId
              ? {
                  ...doc,
                  status: DocumentStatus.Pending,
                  result: undefined,
                  filePreview: undefined,
                  mimeType: undefined,
                  fileName: undefined,
                  fileSize: undefined,
                  uploadedAt: undefined,
                }
              : doc
          ) || [],
        },
      };
    }

    case 'RESET_ROLE': {
      const role = action.payload;
      const originalDocs = ROLES.find(r => r.id === role)?.documents || [];
      return {
        ...state,
        roleDocuments: {
          ...state.roleDocuments,
          [role]: originalDocs.map(doc => ({ ...doc })),
        },
      };
    }

    case 'RESET_ALL':
      return getInitialState();

    case 'ADD_TO_HISTORY':
      return {
        ...state,
        history: [action.payload, ...state.history].slice(0, 50), // Keep last 50
      };

    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: [],
      };

    case 'LOAD_STATE':
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
};

// Create context
const DocumentContext = createContext<DocumentContextValue | undefined>(undefined);

// Provider component
export const DocumentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(documentReducer, getInitialState());

  // Load persisted state on mount
  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem(STORAGE_KEYS.ROLE_DOCUMENTS);
      const savedRole = localStorage.getItem(STORAGE_KEYS.SELECTED_ROLE);
      const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);

      if (savedDocs || savedRole || savedHistory) {
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            ...(savedDocs && { roleDocuments: JSON.parse(savedDocs) }),
            ...(savedRole && { selectedRole: savedRole as RequirementType }),
            ...(savedHistory && { history: JSON.parse(savedHistory) }),
          },
        });
      }
    } catch (error) {
      console.error('Error loading persisted state:', error);
    }
  }, []);

  // Persist state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE_DOCUMENTS, JSON.stringify(state.roleDocuments));
      localStorage.setItem(STORAGE_KEYS.SELECTED_ROLE, state.selectedRole);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  }, [state.roleDocuments, state.selectedRole, state.history]);

  // Computed values
  const currentDocs = state.roleDocuments[state.selectedRole] || [];
  const activeDoc = currentDocs.find(d => d.id === state.activeDocId);

  const stats: DocumentStats = {
    total: currentDocs.length,
    valid: currentDocs.filter(d => d.status === DocumentStatus.Valid).length,
    invalid: currentDocs.filter(d => d.status === DocumentStatus.Invalid).length,
    pending: currentDocs.filter(d => d.status === DocumentStatus.Pending).length,
    analyzing: currentDocs.filter(d => d.status === DocumentStatus.Analyzing).length,
  };

  // Helper actions
  const setRole = (role: RequirementType) => {
    dispatch({ type: 'SET_ROLE', payload: role });
  };

  const setActiveDoc = (docId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_DOC', payload: docId });
  };

  const updateDocumentStatus = (
    docId: string,
    status: DocumentStatus,
    result?: ValidationResult,
    preview?: string,
    mimeType?: string,
    fileName?: string,
    fileSize?: number
  ) => {
    dispatch({
      type: 'UPDATE_DOC_STATUS',
      payload: { docId, status, result, preview, mimeType, fileName, fileSize },
    });
  };

  const resetDocument = (docId: string) => {
    dispatch({ type: 'RESET_DOCUMENT', payload: docId });
  };

  const resetRole = (role: RequirementType) => {
    dispatch({ type: 'RESET_ROLE', payload: role });
  };

  const resetAll = () => {
    dispatch({ type: 'RESET_ALL' });
    localStorage.removeItem(STORAGE_KEYS.ROLE_DOCUMENTS);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_ROLE);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  };

  const addToHistory = (entry: Omit<HistoryEntry, 'id'>) => {
    dispatch({
      type: 'ADD_TO_HISTORY',
      payload: { ...entry, id: uuidv4() },
    });
  };

  const clearHistory = () => {
    dispatch({ type: 'CLEAR_HISTORY' });
  };

  const value: DocumentContextValue = {
    state,
    dispatch,
    currentDocs,
    activeDoc,
    stats,
    setRole,
    setActiveDoc,
    updateDocumentStatus,
    resetDocument,
    resetRole,
    resetAll,
    addToHistory,
    clearHistory,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
};

// Hook to use context
export const useDocuments = (): DocumentContextValue => {
  const context = useContext(DocumentContext);
  
  if (!context) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  
  return context;
};

