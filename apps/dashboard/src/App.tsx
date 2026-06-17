import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import GuestsPage from './pages/GuestsPage';
import ManagersPage from './pages/ManagersPage';
import SuperAdminPage from './pages/SuperAdminPage';
import SegmentsPage from './pages/SegmentsPage';
import SurveyPage from './pages/SurveyPage';
import CampaignsPage from './pages/CampaignsPage';
import AutomationsPage from './pages/AutomationsPage';
import BillingPage from './pages/BillingPage';
import AppLayout from './layouts/AppLayout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="team" element={<ManagersPage />} />
        <Route path="admin" element={<SuperAdminPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="segments" element={<SegmentsPage />} />
        <Route path="survey" element={<SurveyPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
