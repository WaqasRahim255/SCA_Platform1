import { createBrowserRouter, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { RouteErrorPage } from "@/pages/RouteErrorPage";
import { SignupPage } from "@/pages/SignupPage";
import { SsoCallbackPage } from "@/pages/SsoCallbackPage";

function ProtectedRoute() {
  return (
    <>
      <SignedIn>
        <AppLayout />
      </SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "projects", element: <Navigate to="/" replace /> },
      { path: "datasets", element: <Navigate to="/" replace /> },
      { path: "sessions", element: <Navigate to="/" replace /> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/login/sso-callback", element: <SsoCallbackPage /> },
      { path: "/signup", element: <SignupPage /> },
      { path: "/signup/sso-callback", element: <SsoCallbackPage /> },
    ],
  },
]);
