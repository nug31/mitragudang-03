import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Import pages
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import LogoutPage from "../pages/LogoutPage";
import RequestsPage from "../pages/RequestsPage";
import RequestDetailPage from "../pages/RequestDetailPage";
import NewRequestPage from "../pages/NewRequestPage";

import InventoryPage from "../pages/InventoryPage";
import BrowseItemsPage from "../pages/BrowseItemsPage";
import UsersPage from "../pages/UsersPage";
import LoansPage from "../pages/LoansPage";
import MonthlyReportPage from "../pages/MonthlyReportPage";
// ChatPage removed

// Protected route component
const ProtectedRoute: React.FC<{
  element: React.ReactElement;
  requireAdmin?: boolean;
  requireManager?: boolean;
}> = ({ element, requireAdmin = false, requireManager = false }) => {
  const { user, isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireManager && user?.role !== "manager") {
    return <Navigate to="/" replace />;
  }

  return element;
};

// Auth route component that redirects authenticated users
const AuthRoute: React.FC<{
  element: React.ReactElement;
}> = ({ element }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return element;
};

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthRoute element={<LoginPage />} />} />
        <Route
          path="/register"
          element={<AuthRoute element={<RegisterPage />} />}
        />
        <Route path="/logout" element={<LogoutPage />} />
        <Route path="/browse" element={<BrowseItemsPage />} />
        <Route
          path="/requests"
          element={<ProtectedRoute element={<RequestsPage />} />}
        />
        <Route
          path="/requests/new"
          element={<ProtectedRoute element={<NewRequestPage />} />}
        />
        <Route
          path="/requests/:id"
          element={<ProtectedRoute element={<RequestDetailPage />} />}
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute element={<InventoryPage />} requireAdmin={true} />
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute element={<UsersPage />} requireManager={true} />
          }
        />
        <Route
          path="/loans"
          element={<ProtectedRoute element={<LoansPage />} />}
        />
        <Route
          path="/reports/monthly"
          element={
            <ProtectedRoute element={<MonthlyReportPage />} requireAdmin={true} />
          }
        />
        {/* Chat route removed */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default AppRouter;
