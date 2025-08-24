import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useChatStore } from "../stores/useChatStore";
import conversationAPI from "../api/conversationApi";

// Custom hooks for conversations
export const useConversations = () => {
  const { setConversations } = useChatStore();

  const query = useQuery({
    queryKey: ["conversations"],
    queryFn: conversationAPI.getConversations,
  });

  // Handle successful data fetch
  useEffect(() => {
    if (query.data && query.isSuccess) {
      setConversations(query.data.conversations || []);

      // Auto-select latest conversation on initial load/refresh
      const state = useChatStore.getState();
      const conversations = Array.isArray(query.data.conversations)
        ? query.data.conversations
        : [];
      if (!state.currentConversation && conversations.length > 0) {
        const latest = [...conversations].sort((a, b) => {
          const atA = new Date(a.updated_at || a.created_at || 0).getTime();
          const atB = new Date(b.updated_at || b.created_at || 0).getTime();
          return atB - atA;
        })[0];
        if (latest?.conv_id) {
          state.selectConversation(latest.conv_id);
          // Fetch and set history for the initially selected conversation
          (async () => {
            try {
              const data = await conversationAPI.getConversationHistory(latest.conv_id);
              if (data && Array.isArray(data.messages)) {
                useChatStore.getState().updateConversation(latest.conv_id, { messages: data.messages });
              }
            } catch (e) {
              console.error("Failed to load initial conversation history", e);
            }
          })();
        }
      }
    }
  }, [query.data, query.isSuccess, setConversations]);

  return query;
};

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  const { addConversation, selectConversation } = useChatStore();

  return useMutation({
    mutationFn: conversationAPI.createConversation,
    onSettled: () => {
      // Invalidate conversations query
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onSuccess: (data) => {
      // Add to store with empty messages array
      addConversation({ ...data, messages: [] });
      if (data?.conv_id) {
        // Set the newly created conversation as current
        selectConversation(data.conv_id);
      }
    },
  });
};

export const useUpdateConversation = () => {
  const queryClient = useQueryClient();
  const { updateConversation } = useChatStore();

  return useMutation({
    mutationFn: ({ convId, name }) =>
      conversationAPI.updateConversation(convId, name),
    onSettled: () => {
      // Invalidate conversations query
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onSuccess: (data, variables) => {
      // Update store
      updateConversation(variables.convId, { name: variables.name });
    },
  });
};

export const useDeleteConversation = () => {
  const queryClient = useQueryClient();
  const { removeConversation } = useChatStore();

  return useMutation({
    mutationFn: conversationAPI.deleteConversation,
    onSettled: () => {
      // Invalidate conversations query
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onSuccess: (data, convId) => {
      // Remove from store
      removeConversation(convId);
    },
  });
};

export const useSendMessage = () => {
  const { addMessage, setIsTyping } = useChatStore();

  return useMutation({
    mutationFn: ({ question, convId }) => {
      if (!convId) {
        throw new Error("No conversation ID provided");
      }
      return conversationAPI.sendMessage(convId, question);
    },
    onMutate: async ({ question, convId }) => {
      if (!convId) return;

      // Add user message immediately
      const userMessage = {
        id: Date.now().toString(),
        content: question,
        sender: "user",
        timestamp: new Date().toISOString(),
      };

      addMessage(convId, userMessage);
      setIsTyping(true);
    },
    onSuccess: (data, { convId }) => {
      if (!convId) return;

      // Add bot response to the correct conversation
      const botMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response || "Sorry, I couldn't generate a response.",
        sender: "bot",
        timestamp: new Date().toISOString(),
      };

      addMessage(convId, botMessage);
      setIsTyping(false);
    },
    onError: (error, { convId }) => {
      console.error("Chat error:", error);
      setIsTyping(false);

      if (!convId) return;

      // Add error message to the correct conversation
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content:
          "Sorry, there was an error processing your message. Please try again.",
        sender: "bot",
        timestamp: new Date().toISOString(),
      };

      addMessage(convId, errorMessage);
    },
  });
};

// Hook để sử dụng chat functionality
export const useChat = () => {
  const store = useChatStore();
  const sendMessageMutation = useSendMessage();
  const createConversationMutation = useCreateConversation();

  const sendMessage = async (message) => {
    if (!store.currentConversation) {
      console.error("No conversation selected");
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({
        question: message,
        convId: store.currentConversation.conv_id,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const startNewConversation = async (documentId = null) => {
    try {
      const name = documentId
        ? `Chat about document ${documentId}`
        : "New Chat";
      const newConv = await createConversationMutation.mutateAsync(name);
      store.selectConversation(newConv.conv_id);
      return newConv;
    } catch (error) {
      console.error("Failed to create new conversation:", error);
      throw error;
    }
  };

  const selectConversation = (convId) => {
    store.selectConversation(convId);
    // lazy-load history when selecting
    (async () => {
      try {
        const data = await conversationAPI.getConversationHistory(convId);
        if (data && Array.isArray(data.messages)) {
          // push messages into the selected conversation
          // We'll set them in one go using updateConversation to avoid duplications
          store.updateConversation(convId, { messages: data.messages });
        }
      } catch (e) {
        console.error("Failed to load conversation history", e);
      }
    })();
  };

  return {
    ...store,
    sendMessage,
    startNewConversation,
    selectConversation,
    isLoading: sendMessageMutation.isPending,
  };
};
