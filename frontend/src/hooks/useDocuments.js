import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CustomAxios from "../config/CustomAxios";
import useDocumentStore from "../stores/useDocumentStore";
import { useEffect } from "react";

// API functions
const documentsAPI = {
  uploadDocuments: async (files) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await CustomAxios.post("/api/upload/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  getDocuments: async () => {
    try {
      const response = await CustomAxios.get("/api/documents/");

      if (!response.data.documents) {
        console.warn("⚠️ No documents field in response:", response.data);
        return [];
      }

      // Transform backend response to match frontend format
      const transformedDocuments = response.data.documents.map((doc) => ({
        id: doc.key, // Use S3 key as unique ID
        name: doc.filename,
        url: doc.url,
        size: doc.size,
        uploadDate: doc.last_modified,
        type: doc.type,
        s3Key: doc.key, // Keep S3 key for deletion
      }));

      return transformedDocuments;
    } catch {
      // Fallback to localStorage for backward compatibility
      const documents = JSON.parse(localStorage.getItem("documents") || "[]");
      return documents;
    }
  },

  getDocumentStatus: async () => {
    try {
      const response = await CustomAxios.get("/api/documents/status");
      return response.data;
    } catch (error) {
      console.error("Failed to get document status:", error);
      return { status: "no_documents" };
    }
  },

  processDocuments: async () => {
    try {
      const response = await CustomAxios.post("/api/documents/process");
      return response.data;
    } catch (error) {
      console.error("Failed to process documents:", error);
      throw error;
    }
  },

  deleteDocument: async (documentId) => {
    try {
      // documentId is actually the S3 key
      await CustomAxios.delete(`/api/documents/${encodeURIComponent(documentId)}`);
      return documentId;
    } catch (error) {
      console.error("Failed to delete document from backend:", error);
      // Fallback to localStorage for backward compatibility
      const documents = JSON.parse(localStorage.getItem("documents") || "[]");
      const updatedDocuments = documents.filter((doc) => doc.id !== documentId);
      localStorage.setItem("documents", JSON.stringify(updatedDocuments));
      return documentId;
    }
  },

  // Keep this for backward compatibility during upload
  saveDocument: async (document) => {
    const documents = JSON.parse(localStorage.getItem("documents") || "[]");
    const existingIndex = documents.findIndex((d) => d.id === document.id);

    if (existingIndex >= 0) {
      documents[existingIndex] = document;
    } else {
      documents.push(document);
    }

    localStorage.setItem("documents", JSON.stringify(documents));
    return document;
  },
};

// Custom hooks
export const useUploadDocuments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentsAPI.uploadDocuments,
    onSuccess: () => {
      // After successful upload, invalidate both documents and status queries
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documentStatus"] });
    },
    onError: (error) => {
      console.error("Upload error:", error);
    },
  });
};

export const useDocuments = () => {
  const { setDocuments } = useDocumentStore();

  const query = useQuery({
    queryKey: ["documents"],
    queryFn: documentsAPI.getDocuments,
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2,
  });

  // Use useEffect to handle successful data
  useEffect(() => {
    if (query.data) {
      setDocuments(query.data);
    }
  }, [query.data, setDocuments]);

  return query;
};

export const useDocumentStatus = () => {
  const { setDocumentStatus } = useDocumentStore();

  const query = useQuery({
    queryKey: ["documentStatus"],
    queryFn: documentsAPI.getDocumentStatus,
    staleTime: 5000, // Consider data fresh for 5 seconds (frequent updates during processing)
    retry: 2,
    refetchInterval: (data) => {
      // Poll more frequently when processing
      return data?.status === "processing" ? 2000 : false;
    },
  });

  // Use useEffect to handle successful data
  useEffect(() => {
    if (query.data) {
      setDocumentStatus(query.data.status);
    }
  }, [query.data, setDocumentStatus]);

  return query;
};

export const useProcessDocuments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentsAPI.processDocuments,
    onSuccess: () => {
      // After successful processing start, invalidate status query
      queryClient.invalidateQueries({ queryKey: ["documentStatus"] });
    },
    onError: (error) => {
      console.error("Process documents error:", error);
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  const { removeDocument } = useDocumentStore();

  return useMutation({
    mutationFn: documentsAPI.deleteDocument,
    onSuccess: (documentId) => {
      removeDocument(documentId);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documentStatus"] });
    },
  });
};

// Main hook for document functionality
export const useDocumentManagement = () => {
  const store = useDocumentStore();
  const documentsQuery = useDocuments(); // This will automatically fetch and update store
  const statusQuery = useDocumentStatus(); // This will automatically fetch and update store
  const uploadMutation = useUploadDocuments();
  const deleteMutation = useDeleteDocument();
  const processMutation = useProcessDocuments();

  const uploadDocument = async (file) => {
    try {
      // Check if documents are being processed
      if (store.documentStatus === "processing") {
        throw new Error("Cannot upload documents while processing");
      }
      await uploadMutation.mutateAsync([file]);
    } catch (error) {
      console.error("Failed to upload document:", error);
      throw error;
    }
  };

  const uploadDocuments = async (files) => {
    try {
      // Check if documents are being processed
      if (store.documentStatus === "processing") {
        throw new Error("Cannot upload documents while processing");
      }
      await uploadMutation.mutateAsync(files);
    } catch (error) {
      console.error("Failed to upload documents:", error);
      throw error;
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      // Check if documents are being processed
      if (store.documentStatus === "processing") {
        throw new Error("Cannot delete documents while processing");
      }
      await deleteMutation.mutateAsync(documentId);
    } catch (error) {
      console.error("Failed to delete document:", error);
      throw error;
    }
  };

  const processDocuments = async () => {
    try {
      await processMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to process documents:", error);
      throw error;
    }
  };

  return {
    ...store,
    uploadDocument,
    uploadDocuments,
    deleteDocument,
    processDocuments,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isProcessing: processMutation.isPending,
    isLoading: documentsQuery.isLoading,
    statusLoading: statusQuery.isLoading,
    error: documentsQuery.error,
    statusError: statusQuery.error,
  };
};
