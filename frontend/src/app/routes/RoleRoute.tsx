import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../features/auth/auth.context";
import type { Role } from "../../shared/types/models";

export function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!roles.includes(session.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
