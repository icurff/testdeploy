import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat } from "../hooks/useChat";
import { useDocumentManagement } from "../hooks/useDocuments";
import { Send, Bot, User, Edit2, Check, X as Close } from "lucide-react";
import { useUpdateConversation } from "../hooks/useChat";

export function ChatArea() {
  const [message, setMessage] = useState("");
  const { currentConversation, sendMessage, isTyping } = useChat();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const { selectedDocument } = useDocumentManagement();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const renameMutation = useUpdateConversation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages, isTyping]);
  useEffect(() => {
    if (currentConversation) {
      setNewName(currentConversation.name || "");
    }
  }, [currentConversation?.conv_id]);

  const startRename = () => {
    setRenaming(true);
    setNewName(currentConversation?.name || "");
  };

  const cancelRename = () => {
    setRenaming(false);
  };

  const confirmRename = async () => {
    if (!currentConversation) return;
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    
    try {
      await renameMutation.mutateAsync({ convId: currentConversation.conv_id, name: trimmed } as any);
      setRenaming(false);
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const currentMessage = message;
    setMessage(""); // Clear input immediately
    await sendMessage(currentMessage);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Render markdown with tables and proper line breaks
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    // Convert HTML <br> tags to Markdown hard line breaks
    const normalized = text.replace(/<br\s*\/?>(?=\s|$)/gi, "  \n");

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table(props) {
            return (
              <table className="w-full border-collapse my-2 text-sm" {...props} />
            );
          },
          thead(props) {
            return <thead className="bg-gray-100" {...props} />;
          },
          th(props) {
            const { className, ...rest } = props as any;
            return (
              <th
                className={`border border-gray-300 px-2 py-1 text-left ${className || ""}`}
                {...(rest as any)}
              />
            );
          },
          td(props) {
            const { className, ...rest } = props as any;
            return (
              <td
                className={`border border-gray-300 px-2 py-1 align-top ${className || ""}`}
                {...(rest as any)}
              />
            );
          },
          ul(props) {
            return <ul className="list-disc pl-5 my-2" {...props} />;
          },
          ol(props) {
            return <ol className="list-decimal pl-5 my-2" {...props} />;
          },
          p(props) {
            return <p className="my-2" {...props} />;
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    );
  };

  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="bg-gray-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome to DocChat
          </h2>
          <p className="text-gray-600 mb-4">
            Start a new conversation or upload a document to begin chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-full">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            {!renaming ? (
              <>
                <h1 className="text-lg font-semibold text-gray-900">
                  {currentConversation.name}
                </h1>
                <button
                  onClick={startRename}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Rename conversation"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  className="px-2 py-1 border rounded text-sm"
                  autoFocus
                />
                <button
                  onClick={confirmRename}
                  disabled={renameMutation.isPending}
                  className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelRename}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Cancel"
                >
                  <Close className="w-4 h-4" />
                </button>
              </div>
            )}
            {selectedDocument && (
              <p className="text-sm text-gray-500">
                Chatting about: {selectedDocument.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <div className="max-w-3xl mx-auto space-y-4 pb-4">
          {(currentConversation.messages || []).map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg break-words ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-1">
                    {msg.sender === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.sender === "bot" ? renderMarkdown(msg.content) : msg.content}
                    </div>
                    <p
                      className={`text-xs mt-1 ${
                        msg.sender === "user"
                          ? "text-blue-100"
                          : "text-gray-500"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 max-w-xs px-4 py-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 flex-shrink-0" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Type your message... (Press Enter to send)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isTyping}
              />
            </div>
            <button
              type="submit"
              disabled={!message.trim() || isTyping}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
