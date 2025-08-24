import { create } from "zustand";
import { devtools } from "zustand/middleware";

const useDocumentStore = create((set) => ({
  // State
  documents: [],
  documentStatus: "no_documents", // no_documents, waiting, processing, processed, error

  // Actions
  setDocuments: (documents) => set({ documents }),

  setDocumentStatus: (status) => set({ documentStatus: status }),

  addDocument: (document) =>
    set((state) => ({
      documents: [document, ...state.documents],
    })),

  updateDocument: (documentId, updates) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === documentId ? { ...doc, ...updates } : doc
      ),
    })),

  removeDocument: (documentId) =>
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== documentId),
    })),

  // Reset store
  reset: () =>
    set({
      documents: [],
      documentStatus: "no_documents",
    }),
}));

export default useDocumentStore;
