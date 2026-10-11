import { useOffline } from "../native/offline/context";
import { canReadSaved } from "../native/offline/model";
import { SavedContentGate } from "../native/offline/SavedContentGate";
import { savedRoute } from "../native/offline/routes";
import { useLocation } from "react-router-dom";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { InactiveAccountPage } from "../pages/InactiveAccountPage";
import { LoadingScreen } from "./LoadingScreen";
import { isNativeApp } from "../lib/nativePlatform";

export function ProtectedRoute() {
  const { user, profile, loading, nativeProfileVerified, refreshProfile, savedSessionOwner } = useAuth();
  const {state}=useOffline(),location=useLocation();const savedOwner=user?.id||savedSessionOwner;
  if (savedOwner && sessionStorage.getItem("roadshow-auth-flow") !== "invite" && profile?.is_active !== false && isNativeApp() && state?.snapshot && canReadSaved(state.snapshot,savedOwner,Date.now()) && savedRoute(location.pathname)) return <SavedContentGate owner={savedOwner}/>;
  if (loading) return <LoadingScreen />;
  if (user && sessionStorage.getItem("roadshow-auth-flow") === "invite") return <Navigate to="/update-password" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.is_active === false) return <InactiveAccountPage />;
  if (isNativeApp() && !nativeProfileVerified) return (
    <main className="recovery-screen"><section className="recovery-card">
      <h1>Unable to verify your account</h1>
      <p role="alert">Connect to the internet and try again.</p>
      <button className="button primary" onClick={() => void refreshProfile()}>Try again</button>
    </section></main>
  );
  if(isNativeApp()&&state&&!state.snapshot&&state.contracts.error&&profile?.role!=="admin")return <main className="recovery-screen"><section className="recovery-card"><h1>Could not load your contracts</h1><p role="alert">{state.contracts.error}</p><button className="button primary" onClick={()=>void refreshProfile()}>Try again</button></section></main>;
  return <Outlet />;
}

export function AdminRoute() {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return profile?.is_active && profile.role === "admin" ? <Outlet /> : <Navigate to="/" replace />;
}
