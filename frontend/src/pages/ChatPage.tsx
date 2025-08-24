import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { ChatArea } from "../components/ChatArea";
import { DocumentsPanel } from "../components/DocumentsPanel";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { useInitialData } from "../hooks/useInitialData";
import { useDeleteConversation } from "../hooks/useChat";
import { Menu } from "lucide-react";

export function ChatPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showDocuments, setShowDocuments] = useState(false);
    
    // Modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
    
    // Load initial data
    const { isAuthenticated, isLoading, error } = useInitialData();

    // Redirect to login if not authenticated
    if (!isAuthenticated && !isLoading) {
      window.location.href = "/login";
      return null;
    }

    const deleteConversationMutation = useDeleteConversation();

    const handleConfirmDelete = async () => {
      if (!conversationToDelete) return;
      
      try {
        await deleteConversationMutation.mutateAsync(conversationToDelete);
        setIsDeleteModalOpen(false);
        setConversationToDelete(null);
      } catch (e) {
        console.error("Failed to delete conversation", e);
      }
    };

    const handleCloseDeleteModal = () => {
      setIsDeleteModalOpen(false);
      setConversationToDelete(null);
    };

    return (
      <>
        <div className="flex h-screen bg-gray-50">
          {/* Mobile sidebar backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div
            className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
          >
            <Sidebar
              onClose={() => setSidebarOpen(false)}
              onToggleDocuments={() => setShowDocuments(!showDocuments)}
              showDocuments={showDocuments}
              onDeleteConversation={(convId) => {
                setConversationToDelete(convId);
                setIsDeleteModalOpen(true);
              }}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-600 hover:text-gray-900"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Chat area */}
              <div className="flex-1 flex flex-col min-h-0">
                <ChatArea />
              </div>

              {/* Documents panel */}
              {showDocuments && (
                <div className="w-80 border-l border-gray-200 bg-white">
                  <DocumentsPanel onClose={() => setShowDocuments(false)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseDeleteModal}
          onConfirm={handleConfirmDelete}
          title="Xóa cuộc trò chuyện"
          message="Bạn có chắc chắn muốn xóa cuộc trò chuyện này không? Hành động này không thể hoàn tác."
          isLoading={deleteConversationMutation.isPending}
                 />
       </>
     );
   }

