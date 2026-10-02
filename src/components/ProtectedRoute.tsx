import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { InactiveAccountPage } from "../pages/InactiveAccountPage";
import { LoadingScreen } from "./LoadingScreen";

export function ProtectedRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && sessionStorage.getItem("roadshow-auth-flow") === "invite") return <Navigate to="/update-password" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.is_active === false) return <InactiveAccountPage />;
  return <Outlet />;
}

export function AdminRoute() {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return profile?.is_active && profile.role === "admin" ? <Outlet /> : <Navigate to="/" replace />;
}
