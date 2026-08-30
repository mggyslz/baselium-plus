import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../../features/auth/auth.context";
import LoginPage from "../../features/auth/pages/LoginPage";
import SignupPage from "../../features/auth/pages/SignupPage";
import AdminDashboardPage from "../../features/admin/pages/AdminDashboardPage";
import CaregiverDashboardPage from "../../features/caregiver/pages/CaregiverDashboardPage";
import ElderCheckinPage from "../../features/elder/pages/ElderCheckinPage";
import FamilyStatusPage from "../../features/family/pages/FamilyStatusPage";
import { StandardLayout } from "../layouts/StandardLayout";
import { RoleRoute } from "./RoleRoute";

function RoleHome() {
  const { session } = useAuth();
  const destinations = { admin: "/admin", caregiver: "/caregiver", elder: "/elder", family: "/family" };
  return <Navigate to={session ? destinations[session.role] : "/login"} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/admin" element={<RoleRoute roles={["admin"]}><AdminDashboardPage /></RoleRoute>} />
      <Route path="/caregiver" element={<RoleRoute roles={["caregiver"]}><CaregiverDashboardPage /></RoleRoute>} />
      <Route path="/elder" element={<RoleRoute roles={["elder"]}><StandardLayout><ElderCheckinPage /></StandardLayout></RoleRoute>} />
      <Route path="/family" element={<RoleRoute roles={["family"]}><StandardLayout><FamilyStatusPage /></StandardLayout></RoleRoute>} />
      <Route path="/" element={<RoleHome />} />
      <Route path="*" element={<RoleHome />} />
    </Routes>
  );
}
