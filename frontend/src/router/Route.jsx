import { createBrowserRouter, RouterProvider, Navigate, useLocation } from "react-router-dom";
import { LoginPage } from "../pages/AuthPage";
import { ChatPage } from "../pages/ChatPage";
import { useAuthStore } from "../stores/useAuthStore";

const RequireAuth = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  
  // AuthProvider will handle the authentication check and redirect
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
};

const RedirectIfAuthenticated = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RequireAuth>
        <ChatPage />
      </RequireAuth>
    ),
  },

  {
    path: "/login",
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  // {
  //   path: "/reset-password",
  //   element: <PasswordResetPage />,
  // },
  // {
  //   path: "/auth/google",
  //   element: (
  //     <RedirectIfAuthenticated>
  //       <GoogleAuth />
  //     </RedirectIfAuthenticated>
  //   ),
  // },
  // {
  //   path: "/auth/github",
  //   element: (
  //     <RedirectIfAuthenticated>
  //       <GithubAuth />
  //     </RedirectIfAuthenticated>
  //   ),
  // },

  // {
  //   path: "*",
  //   element: <NotFoundPage />,
  // },
]);

const PageRoute = () => {
  return <RouterProvider router={router} />;
};

export default PageRoute;
