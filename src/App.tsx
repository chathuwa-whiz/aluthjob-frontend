import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { ResumeProvider } from "./auth/ResumeProvider";
import { Skeleton } from "./components/Bits";
import { AppShell, AuthLayout } from "./components/Layouts";
import { AccountPage } from "./pages/Account";
import { ApplicationsPage } from "./pages/Applications";
import { ForgotPassword, Login, Register, ResetPassword } from "./pages/AuthPages";
import { MailboxPage } from "./pages/Mailbox";
import { MatchDetail } from "./pages/MatchDetail";
import { Matches } from "./pages/Matches";
import { NotFound } from "./pages/NotFound";
import { ResumePage } from "./pages/Resume";
import { ConfirmEmailGate, VerifyEmail } from "./pages/VerifyPages";

/** While we find out whether anyone is signed in */
function Splash() {
  return (
    <div className="auth">
      <div className="auth__column" aria-busy="true" aria-label="Loading">
        <Skeleton height="2rem" width="9rem" />
        <Skeleton height="14rem" />
      </div>
    </div>
  );
}

/** Pages for people who are not signed in; someone who is goes straight to the app. */
function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;

  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}

/** Everything inside requires a signed-in person whose email address has been confirmed. */
function RequireAccount() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!user.emailVerified) return <ConfirmEmailGate />;

  return (
    <ResumeProvider>
      <AppShell />
    </ResumeProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Reached from emailed links, signed in or not */}
      <Route
        path="/reset-password"
        element={
          <AuthLayout>
            <ResetPassword />
          </AuthLayout>
        }
      />
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route element={<RequireAccount />}>
        <Route index element={<Matches />} />
        <Route path="matches/:id" element={<MatchDetail />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="resume" element={<ResumePage />} />
        <Route path="mailbox" element={<MailboxPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
