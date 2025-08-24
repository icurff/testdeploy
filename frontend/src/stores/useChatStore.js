import { create } from 'zustand';

export const useChatStore = create(
  (set) => ({
    // State
    conversations: [],
    currentConversation: null,
    isTyping: false,

    // Actions
    setConversations: (conversations) => set({ conversations }),
    
    setLoading: (loading) => set({ loading }),

    setIsTyping: (isTyping) => set({ isTyping }),

    selectConversation: (convId) => set((state) => {
      const selected = state.conversations.find((c) => c.conv_id === convId) || null;
      return { currentConversation: selected };
    }),
    
    addConversation: (conversation) => set((state) => ({
      conversations: [conversation, ...state.conversations]
    })),
    
    updateConversation: (convId, updates) => set((state) => {
      const updatedConversations = state.conversations.map(conv => 
        conv.conv_id === convId ? { ...conv, ...updates } : conv
      );
      const updatedCurrent = state.currentConversation && state.currentConversation.conv_id === convId
        ? { ...state.currentConversation, ...updates }
        : state.currentConversation;
      return { conversations: updatedConversations, currentConversation: updatedCurrent };
    }),
    
    removeConversation: (convId) => set((state) => {
      const filtered = state.conversations.filter(conv => conv.conv_id !== convId);
      const currentRemoved = state.currentConversation && state.currentConversation.conv_id === convId;
      return {
        conversations: filtered,
        currentConversation: currentRemoved ? null : state.currentConversation,
      };
    }),
    
    addMessage: (convId, message) => set((state) => {
      const updatedConversations = state.conversations.map(conv => 
        conv.conv_id === convId 
          ? { ...conv, messages: [...(conv.messages || []), message] }
          : conv
      );
      const updatedCurrent = state.currentConversation && state.currentConversation.conv_id === convId
        ? { ...state.currentConversation, messages: [...(state.currentConversation.messages || []), message] }
        : state.currentConversation;
      return { conversations: updatedConversations, currentConversation: updatedCurrent };
    }),
    

    // Reset store
    reset: () => set({
      conversations: [],
      currentConversation: null,
      isTyping: false,
    })
  })
);

