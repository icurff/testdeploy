import CustomAxios from "../config/CustomAxios";

// Conversation API functions
export const conversationAPI = {
  // Lấy tất cả conversations của user
  getConversations: async () => {
    const response = await CustomAxios.get("/conversations");
    return response.data;
  },

  // Tạo conversation mới
  createConversation: async (name) => {
    // name is optional; backend will default to "New Chat" when missing/empty
    const payload =
      typeof name === "string" && name.trim().length > 0
        ? { name: name.trim() }
        : {};
    const response = await CustomAxios.post("/conversations", payload);
    return response.data;
  },

  // Cập nhật conversation
  updateConversation: async (convId, name) => {
    const response = await CustomAxios.put(`/conversations/${convId}`, {
      name,
    });
    return response.data;
  },

  // Xóa conversation
  deleteConversation: async (convId) => {
    const response = await CustomAxios.delete(`/conversations/${convId}`);
    return response.data;
  },

  // Gửi tin nhắn trong conversation
  sendMessage: async (convId, question) => {
    const response = await CustomAxios.post("/chat/send", {
      conv_id: convId,
      question,
    });
    return response.data;
  },

  // Lấy lịch sử hội thoại của 1 conversation
  getConversationHistory: async (convId) => {
    const response = await CustomAxios.get(`/conversations/${convId}/history`);
    return response.data;
  },
};

export default conversationAPI;
