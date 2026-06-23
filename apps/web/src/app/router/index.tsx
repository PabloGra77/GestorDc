import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import App from '../../App';
import { FirstPasswordChangePage } from '../../features/auth/FirstPasswordChangePage';
import { ForgotPasswordPage } from '../../features/auth/ForgotPasswordPage';
import { getAuthSession } from '../../features/auth/auth.service';
import { LoginPage } from '../../features/auth/LoginPage';
import { RegistroPage } from '../../features/auth/RegistroPage';
import { ResetPasswordPage } from '../../features/auth/ResetPasswordPage';
import { DashboardPage } from '../../features/dashboard/DashboardPage';
import { InstallPage } from '../../features/install/InstallPage';

function RequireAuth() {
  if (!getAuthSession()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RequirePasswordUpdated() {
  const session = getAuthSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.usuario.debeCambiarPassword) {
    return <Navigate to="/first-password" replace />;
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'registro', element: <RegistroPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'instalar', element: <InstallPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'first-password', element: <FirstPasswordChangePage /> },
          {
            element: <RequirePasswordUpdated />,
            children: [{ path: 'dashboard', element: <DashboardPage /> }],
          },
        ],
      },
    ],
  },
]);