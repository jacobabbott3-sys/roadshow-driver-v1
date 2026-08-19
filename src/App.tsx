import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute";
import { AdminChecklistReviewPage } from "./pages/AdminChecklistReviewPage";
import { AdminChecklistsPage } from "./pages/AdminChecklistsPage";
import { AdminMessagesPage } from "./pages/AdminMessagesPage";
import { AdminOperationsPage } from "./pages/AdminOperationsPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminShowsPage } from "./pages/AdminShowsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { ContractDetailPage } from "./pages/ContractDetailPage";
import { ContractsPage } from "./pages/ContractsPage";
import { FaqPage } from "./pages/FaqPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RedFolderPage } from "./pages/RedFolderPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { ToolbagPage } from "./pages/ToolbagPage";
import { UpdatePasswordPage } from "./pages/UpdatePasswordPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="contracts" element={<ContractsPage />} />
            <Route path="contracts/:id" element={<ContractDetailPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="resources" element={<ResourcesPage />} />
            <Route path="resources/toolbag" element={<ToolbagPage />} />
            <Route path="resources/red-folder" element={<RedFolderPage />} />
            <Route path="resources/faq" element={<FaqPage />} />
            <Route path="resources/feedback" element={<FeedbackPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<AdminPage />} />
              <Route path="admin/shows" element={<AdminShowsPage />} />
              <Route
                path="admin/checklists"
                element={<AdminChecklistsPage />}
              />
              <Route
                path="admin/checklists/:contractId"
                element={<AdminChecklistReviewPage />}
              />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/messages" element={<AdminMessagesPage />} />
              <Route
                path="admin/operations"
                element={<AdminOperationsPage />}
              />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
