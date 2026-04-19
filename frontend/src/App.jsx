import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import EditorPage from "./pages/EditorPage";
import PrintPage from "./pages/PrintPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import UploadPage from "./pages/UploadPage";
import AccountManager from "./pages/AccountManager";
import HeroPage from "./pages/HeroPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const HomeRoute = () => {
  const { token } = useAuth();
  if (token) return <Navigate to="/dashboard" replace />;
  return <HeroPage />;
};

const LoginRoute = () => {
  // Allow login page even when authenticated (for adding or switching accounts)
  return <Login />;
};

const SignupRoute = () => {
  // Allow signup page even when authenticated (for adding new accounts)
  return <Signup />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomeRoute />} />
          <Route path="/hero" element={<HeroPage />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/signup" element={<SignupRoute />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/accounts" element={
            <ProtectedRoute>
              <AccountManager />
            </ProtectedRoute>
          } />
          <Route path="/upload" element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          } />
          <Route path="/editor/:id" element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          } />
          <Route path="/print" element={
            <ProtectedRoute>
              <PrintPage />
            </ProtectedRoute>
          } />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}