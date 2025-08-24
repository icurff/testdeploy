import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
  // State
  user: null,
  isAuthenticated: false,
  token: null,

  // Actions
  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  setToken: (token) => set({ token }),

  login: (userData, token = null) =>
    set({
      user: userData,
      isAuthenticated: true,
      token,
    }),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      token: null,
    }),

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),

  // Reset store
  reset: () =>
    set({
      user: null,
      isAuthenticated: false,
      token: null,
    }),
    }),
    {
      name: "auth-store",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated, token: state.token }),
    }
  )
);
