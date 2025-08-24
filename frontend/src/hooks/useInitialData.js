
import { useDocuments } from "./useDocuments";
import { useConversations } from "./useChat";
import { useCurrentUser } from "./useAuth";
import { useAuthStore } from "../stores/useAuthStore";

// Hook để khởi tạo dữ liệu khi app start
export const useInitialData = () => {
  const documentsQuery = useDocuments();
  const conversationsQuery = useConversations();
  const userQuery = useCurrentUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Chỉ load dữ liệu khi user đã authenticated
  const shouldLoadData = isAuthenticated && userQuery.data;

  return {
    isLoading:
      (shouldLoadData && documentsQuery.isLoading) ||
      (shouldLoadData && conversationsQuery.isLoading) ||
      userQuery.isLoading,
    error: documentsQuery.error || conversationsQuery.error || userQuery.error,
    isAuthenticated,
  };
};
