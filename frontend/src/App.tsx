import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./features/auth/auth.context";
import { AppRoutes } from "./app/routes/AppRoutes";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
