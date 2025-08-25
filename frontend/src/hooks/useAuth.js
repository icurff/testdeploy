import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/useAuthStore";
import CustomAxios from "../config/CustomAxios";
import Cookies from "js-cookie";
// API functions
const authAPI = {
  login: async ({ email, password }) => {
    const res = await CustomAxios.post("/api/login", {
      email,
      password,
    });

    // Lưu token vào cookie
    Cookies.set("access_token", res.data.access_token, {
      sameSite: "lax",
    });
    Cookies.set("refresh_token", res.data.refresh_token, {
      sameSite: "lax",
    });

    return {
      user: res.data.user,
      token: res.data.access_token,
    };
  },

  register: async ({ username, email, password }) => {
    const res = await CustomAxios.post("/api/register", {
      username,
      email,
      password,
    });

    // Lưu token vào cookie sau khi đăng ký thành công
    Cookies.set("access_token", res.data.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    Cookies.set("id_token", res.data.id_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    Cookies.set("refresh_token", res.data.refresh_token, {
      secure: true,
      sameSite: "lax",
    });

    return res.data;
  },

  getCurrentUser: async () => {
    const token = Cookies.get("access_token");
    if (!token) {
      // Clear any remaining auth data if no token exists
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }
    try {
      const res = await CustomAxios.get("/api/me");
      return res.data;
    } catch {
      // Clear all auth data on error
      Cookies.remove("access_token");
      Cookies.remove("id_token");
      Cookies.remove("refresh_token");
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }
  },

  logout: async () => {
    Cookies.remove("access_token");
    Cookies.remove("id_token");
    Cookies.remove("refresh_token");
    return { success: true };
  },

  // Password reset (Cognito)
  forgotPassword: async ({ email }) => {
    const res = await CustomAxios.post("/api/forgot-password", { email });
    return res.data;
  },

  confirmForgotPassword: async ({ email, code, newPassword }) => {
    const res = await CustomAxios.post("/api/confirm-forgot-password", {
      email,
      code,
      new_password: newPassword,
    });
    return res.data;
  },
};

// Custom hooks
export const useLogin = () => {
  const { login: loginStore } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authAPI.login,
    onSuccess: (data) => {
      // Save user to store with the correct token value
      loginStore(data.user, data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error) => {
      console.error("Login error:", error);
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authAPI.register,
    onSuccess: () => {
      // Tokens đã được lưu trong authAPI.register
      // Invalidate query để reload user info
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error) => {
      console.error("Register error:", error);
    },
  });
};

export const useLogout = () => {
  const { logout: logoutStore } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authAPI.logout,
    onSuccess: () => {
      logoutStore();
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("conversations");
      localStorage.removeItem("documents");
      queryClient.clear();
      window.location.href = "/login";
    },
    onError: (error) => {
      console.error("Logout error:", error);
      // Force logout even on error
      logoutStore();
      localStorage.clear();
      // Xóa cookies khi logout bị lỗi
      Cookies.remove("access_token");
      Cookies.remove("id_token");
      Cookies.remove("refresh_token");
      queryClient.clear();
    },
  });
};

export const useCurrentUser = () => {
  const { setUser, logout } = useAuthStore();

  return useQuery({
    queryKey: ["user"],
    queryFn: authAPI.getCurrentUser,
    onSuccess: (data) => {
      if (data) {
        setUser(data);
      } else {
        // Clear user data if no valid user returned
        logout();
      }
    },
    onError: () => {
      // Clear user data on error
      logout();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Main hook for auth functionality
export const useAuth = () => {
  const store = useAuthStore();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const logoutMutation = useLogout();

  const login = async (credentials) => {
    try {
      await loginMutation.mutateAsync(credentials);
    } catch (error) {
      console.error("Failed to login:", error);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      await registerMutation.mutateAsync(userData);
    } catch (error) {
      console.error("Failed to register:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      return await authAPI.forgotPassword({ email });
    } catch (error) {
      console.error("Failed to request password reset:", error);
      throw error;
    }
  };

  const confirmPasswordReset = async ({ email, code, newPassword }) => {
    try {
      return await authAPI.confirmForgotPassword({ email, code, newPassword });
    } catch (error) {
      console.error("Failed to confirm password reset:", error);
      throw error;
    }
  };

  return {
    ...store,
    login,
    register,
    logout,
    requestPasswordReset,
    confirmPasswordReset,
    isLoading:
      loginMutation.isPending ||
      registerMutation.isPending ||
      logoutMutation.isPending,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
  };
};
