import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingScreen } from "./components/LoadingScreen";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { UpdatePasswordPage } from "./pages/UpdatePasswordPage";
import { AuthConfirmPage } from "./pages/AuthConfirmPage";

const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const ContractsPage = lazy(() => import("./pages/ContractsPage").then((module) => ({ default: module.ContractsPage })));
const ContractDetailPage = lazy(() => import("./pages/ContractDetailPage").then((module) => ({ default: module.ContractDetailPage })));
const SigningGroupPage = lazy(() => import("./pages/SigningGroupPage").then((module) => ({ default: module.SigningGroupPage })));
const AvailabilityPage = lazy(() => import("./pages/AvailabilityPage").then((module) => ({ default: module.AvailabilityPage })));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage").then((module) => ({ default: module.ResourcesPage })));
const ToolbagPage = lazy(() => import("./pages/ToolbagPage").then((module) => ({ default: module.ToolbagPage })));
const RedFolderPage = lazy(() => import("./pages/RedFolderPage").then((module) => ({ default: module.RedFolderPage })));
const FaqPage = lazy(() => import("./pages/FaqPage").then((module) => ({ default: module.FaqPage })));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage").then((module) => ({ default: module.FeedbackPage })));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage").then((module) => ({ default: module.DirectoryPage })));
const ChatPage = lazy(() => import("./pages/ChatPage").then((module) => ({ default: module.ChatPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const AdminShowsPage = lazy(() => import("./pages/AdminShowsPage").then((module) => ({ default: module.AdminShowsPage })));
const AdminPublishContractsPage = lazy(() => import("./pages/AdminPublishContractsPage").then((module) => ({ default: module.AdminPublishContractsPage })));
const AdminSigningsPage = lazy(() => import("./pages/AdminSigningsPage").then((module) => ({ default: module.AdminSigningsPage })));
const AdminTemplatesPage = lazy(() => import("./pages/AdminTemplatesPage").then((module) => ({ default: module.AdminTemplatesPage })));
const AdminChecklistsPage = lazy(() => import("./pages/AdminChecklistsPage").then((module) => ({ default: module.AdminChecklistsPage })));
const AdminChecklistReviewPage = lazy(() => import("./pages/AdminChecklistReviewPage").then((module) => ({ default: module.AdminChecklistReviewPage })));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage").then((module) => ({ default: module.AdminUsersPage })));
const AdminOperationsPage = lazy(() => import("./pages/AdminOperationsPage").then((module) => ({ default: module.AdminOperationsPage })));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen label="Opening screen…" />}>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/confirm" element={<AuthConfirmPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="contracts" element={<ContractsPage />} />
            <Route path="contracts/:id" element={<ContractDetailPage />} />
            <Route path="signing-groups/:showId" element={<SigningGroupPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="resources" element={<ResourcesPage />} />
            <Route path="resources/toolbag" element={<ToolbagPage />} />
            <Route path="resources/red-folder" element={<RedFolderPage />} />
            <Route path="resources/faq" element={<FaqPage />} />
            <Route path="resources/feedback" element={<FeedbackPage />} />
            <Route path="resources/directory" element={<DirectoryPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="messages" element={<Navigate to="/chat" replace />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<AdminPage />} />
              <Route path="admin/shows" element={<AdminShowsPage />} />
              <Route path="admin/shows/publish" element={<AdminPublishContractsPage />} />
              <Route path="admin/signings" element={<AdminSigningsPage />} />
              <Route path="admin/templates" element={<AdminTemplatesPage />} />
              <Route
                path="admin/checklists"
                element={<AdminChecklistsPage />}
              />
              <Route
                path="admin/checklists/:contractId"
                element={<AdminChecklistReviewPage />}
              />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/messages" element={<Navigate to="/chat" replace />} />
              <Route
                path="admin/operations"
                element={<AdminOperationsPage />}
              />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
