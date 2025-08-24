import React from "react";
import { useAuth } from "../hooks/useAuth";
import {
  FileText,
  LogOut,
  User,
  X,
  Plus,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useCreateConversation, useChat } from "../hooks/useChat";


interface SidebarProps {
  onClose: () => void;
  onToggleDocuments: () => void;
  showDocuments: boolean;
  onDeleteConversation?: (convId: string) => void;
}

export function Sidebar({
  onClose,
  onToggleDocuments,
  showDocuments,
  onDeleteConversation,
}: SidebarProps) {
  const { user, logout, isLogoutLoading } = useAuth();
  const createConversationMutation = useCreateConversation();
  const { conversations, currentConversation, selectConversation } = useChat();



  const handleNewChat = async () => {
    try {
      const newConv = await createConversationMutation.mutateAsync("");
    } catch (e) {
      console.error("Failed to create conversation", e);
    }
  };

  const handleDeleteConversation = async (
    convId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent conversation selection
    if (onDeleteConversation) {
      onDeleteConversation(convId);
    }
  };



  return (
    <div className="h-full flex flex-col bg-gray-900 text-white relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <span className="font-semibold">DocChat</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
          disabled={createConversationMutation.isPending}
        >
          <Plus className="w-4 h-4" />
          <span>
            {createConversationMutation.isPending ? "Creating..." : "New Chat"}
          </span>
        </button>
        <button
          onClick={onToggleDocuments}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            showDocuments
              ? "bg-gray-700 text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Documents</span>
        </button>
      </div>

      {/* Conversation History */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Conversations
          </h3>
          <div className="space-y-1">
            {[...conversations]
              .sort((a, b) => {
                const atA = new Date(a.updated_at || a.created_at || 0).getTime();
                const atB = new Date(b.updated_at || b.created_at || 0).getTime();
                return atB - atA;
              })
              .map((conversation) => (
              <div
                key={conversation.conv_id}
                className={`group relative flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
               currentConversation && currentConversation.conv_id === conversation.conv_id
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <button
                  onClick={() => selectConversation(conversation.conv_id)}
                  className="flex items-center space-x-3 flex-1 min-w-0 text-left"
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="truncate text-sm text-left">
                      {conversation.name}
                    </div>
                    <div className="text-xs text-gray-400 text-left">
                      {conversation.updated_at
                        ? new Date(conversation.updated_at).toLocaleDateString()
                        : ""}
                    </div>
                  </div>
                </button>

                <button
                  onClick={(e) =>
                    handleDeleteConversation(conversation.conv_id, e)
                  }
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-all duration-200"
                  title="Delete conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className="bg-gray-700 p-2 rounded-full">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.username || user?.name || user?.email || ""}</div>
            <div className="text-xs text-gray-400 truncate">{user?.email || ""}</div>
          </div>
        </div>

        <button
          onClick={logout}
          disabled={isLogoutLoading}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            isLogoutLoading
              ? "bg-gray-800 text-gray-400 cursor-not-allowed"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <LogOut className="w-4 h-4" />
          <span>{isLogoutLoading ? "Signing out..." : "Sign Out"}</span>
        </button>
      </div>
    </div>
  );
}
