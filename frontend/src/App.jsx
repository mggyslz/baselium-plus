import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ElderCheckin from "./pages/ElderCheckin";
import CaregiverDashboard from "./pages/CaregiverDashboard";
import FamilyStatus from "./pages/FamilyStatus";

function TopBar() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  if (!session) return null;
  return (
    <div className="topbar">
      <h1>Baselium+</h1>
      <div className="row">
        <span className="role-badge">{session.role}</span>
        <button className="secondary" onClick={() => { logout(); navigate("/login"); }}>Log out</button>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function Home() {
  const { session } = useAuth();
  if (session.role === "elder") return <ElderCheckin />;
  if (session.role === "caregiver") return <CaregiverDashboard />;
  if (session.role === "family") return <FamilyStatus />;
  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <TopBar />
          <AppRoutes />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
