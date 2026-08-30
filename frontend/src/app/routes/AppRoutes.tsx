import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../../features/auth/auth.context";
import { StandardLayout } from "../layouts/StandardLayout";
import { RoleRoute } from "./RoleRoute";

const LoginPage = lazy(() => import("../../features/auth/pages/LoginPage"));
const SignupPage = lazy(() => import("../../features/auth/pages/SignupPage"));
const AdminDashboardPage = lazy(() => import("../../features/admin/pages/AdminDashboardPage"));
const CaregiverDashboardPage = lazy(() => import("../../features/caregiver/pages/CaregiverDashboardPage"));
const ElderCheckinPage = lazy(() => import("../../features/elder/pages/ElderCheckinPage"));
const FamilyStatusPage = lazy(() => import("../../features/family/pages/FamilyStatusPage"));

function RoleHome() {
  const { session } = useAuth();
  const destinations = { admin: "/admin", caregiver: "/caregiver", elder: "/elder", family: "/family" };
  return <Navigate to={session ? destinations[session.role] : "/login"} replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<main className="container" role="status">Loading…</main>}>
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
    </Suspense>
  );
}
