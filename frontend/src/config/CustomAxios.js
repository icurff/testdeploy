import axios from "axios";
import { useAuthStore } from "../stores/useAuthStore";

// Function to get cookie value by name
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
};

// Function to remove cookie
const removeCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

// Function to clear all auth data
const clearAuthData = () => {
  // Clear cookies
  removeCookie("access_token");
  removeCookie("refresh_token");
  removeCookie("id_token");
  
  // Clear localStorage
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("conversations");
  localStorage.removeItem("documents");
  
  // Clear Zustand store
  const logout = useAuthStore.getState().logout;
  logout();
};

const myAxios = axios.create({ baseURL: import.meta.env.VITE_BASE_URL });

myAxios.interceptors.request.use(
  (config) => {
    const token = getCookie("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.log(error);
  }
);

myAxios.interceptors.response.use(
  (response) => response,
  (err) => {
    if (err.response && err.response.status === 401) {
      // Clear all auth data when token is invalid
      clearAuthData();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default myAxios;
