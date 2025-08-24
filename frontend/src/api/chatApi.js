import CustomAxios from "../config/CustomAxios";

// Chat API functions (legacy support)
export const chatAPI = {
  // Legacy chat endpoint (kept for backward compatibility)
  sendMessage: async ({ sessionId, question }) => {
    const response = await CustomAxios.post("/chat", {
      session_id: sessionId,
      question,
    });
    return response.data;
  },
};

export default chatAPI;