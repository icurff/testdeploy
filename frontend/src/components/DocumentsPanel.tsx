import React, { useState } from "react";
import { useDocumentManagement } from "../hooks/useDocuments";
import { useChat } from "../hooks/useChat";
import {
  Upload,
  File,
  Trash2,
  MessageSquare,
  X,
  Plus,
  Play,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface DocumentsPanelProps {
  onClose?: () => void;
}

export function DocumentsPanel({ onClose }: DocumentsPanelProps) {
  const {
    documents,
    documentStatus,
    uploadDocuments,
    deleteDocument,
    processDocuments,
    isUploading,
    isProcessing,
    isLoading,
    error,
  } = useDocumentManagement();

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      await uploadDocuments(files);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const handleProcessDocuments = async () => {
    try {
      await processDocuments();
    } catch (error) {
      console.error("Process error:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusDisplay = () => {
    const hasDocuments = documents.length > 0;
    const docStatus = hasDocuments ? documentStatus : "no_documents";

    switch (docStatus) {
      case "no_documents":
        return {
          icon: <File className="w-5 h-5 text-gray-400" />,
          text: "No Documents",
          color: "text-gray-500",
          bgColor: "bg-gray-50",
          showSection: false,
        };
      case "waiting":
        return {
          icon: <Play className="w-5 h-5 text-blue-600" />,
          text: "Documents Ready for Processing",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          action: true,
          showSection: true,
        };
      case "processing":
        return {
          icon: (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          ),
          text: "Processing Documents...",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          showSection: true,
        };
      // case "processed":
      //   return {
      //     icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      //     text: "Documents Processed Successfully",
      //     color: "text-green-600",
      //     bgColor: "bg-green-50",
      //     showSection: true,
      //   };
      case "error":
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-600" />,
          text: "Processing Error - Try Again",
          color: "text-red-600",
          bgColor: "bg-red-50",
          action: true,
          showSection: true,
        };
      default:
        return {
          icon: <File className="w-5 h-5 text-gray-400" />,
          text: "No Documents",
          color: "text-gray-500",
          bgColor: "bg-gray-50",
          showSection: false,
        };
    }
  };

  // Override status to "no_documents" if there are no documents
  const hasDocuments = documents.length > 0;
  const docStatus = hasDocuments ? documentStatus : "no_documents";
  const statusDisplay = getStatusDisplay();
  const isProcessingState = docStatus === "processing";
  const canUpload = !isProcessingState && !isUploading;
  const canDelete = !isProcessingState;

  // Only show process button if there are documents and status allows it
  const shouldShowProcessButton = hasDocuments && statusDisplay.action;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            {/* Close button */}
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Status Section - Only show when status is waiting or processing */}
      {(docStatus === "waiting" || docStatus === "processing") && (
        <div className="p-6 border-b border-gray-200">
          <div
            className={`flex items-center justify-between p-4 rounded-lg ${statusDisplay.bgColor} border border-gray-200`}
          >
            <div className="flex items-center space-x-3">
              {statusDisplay.icon}
              {docStatus === "processing" && (
                <p className="text-xs text-gray-500 mt-1">
                  This may take a few minutes...
                </p>
              )}
            </div>
            {shouldShowProcessButton && (
              <button
                onClick={handleProcessDocuments}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isProcessing
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                }`}
              >
                {isProcessing ? "Processing..." : "Process Documents"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={!canUpload}
          />
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              !canUpload
                ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                : isUploading
                ? "border-blue-300 bg-blue-50"
                : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
            }`}
          >
            {isUploading ? (
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-sm text-blue-600">Uploading...</p>
              </div>
            ) : !canUpload ? (
              <div className="flex flex-col items-center space-y-2">
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Upload disabled during processing
                </p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports PDF (multiple files allowed)
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-red-600">Error loading documents</p>
            <p className="text-sm text-gray-400 mt-1">
              {error.message || "Failed to fetch documents"}
            </p>
          </div>
        ) : isLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-500">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-6 text-center">
            <File className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No documents uploaded yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Upload a document to start chatting
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 border rounded-lg transition-colors 
                    border-gray-200 hover:border-gray-300"
              >
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <File className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {doc.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(doc.size)} • {formatDate(doc.uploadDate)}
                    </p>

                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        disabled={!canDelete}
                        className={`flex items-center space-x-1 px-3 py-1 text-xs rounded-md transition-colors ${
                          canDelete
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
