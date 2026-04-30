import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './components/LoginPage/LoginPage';
import { DashboardPage } from './components/DashboardPage/DashboardPage';
import { NewReservationPage } from './components/NewReservationPage/NewReservationPage';
import { MyReservationsPage } from './components/MyReservationsPage/MyReservationsPage';
import { BadgesPage } from './components/BadgesPage/BadgesPage';
import { ProfilePage } from './components/ProfilePage/ProfilePage';
import { AdminPage } from './components/AdminPage/AdminPage';
import { GuardPage } from './components/GuardPage/GuardPage';
import { getSession, isSessionValid } from './services/tokenStore';

function ProtectedRoute({ children }: { children: JSX.Element }): JSX.Element {
  return isSessionValid() ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ children, roles }: { children: JSX.Element; roles: string[] }): JSX.Element {
  const session = getSession();
  const role = session?.user.role.toLowerCase();
  if (!isSessionValid()) return <Navigate to="/login" replace />;
  return role && roles.includes(role) ? children : <Navigate to="/dashboard" replace />;
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/nueva-reserva" element={<ProtectedRoute><NewReservationPage /></ProtectedRoute>} />
        <Route path="/mis-reservas" element={<ProtectedRoute><MyReservationsPage /></ProtectedRoute>} />
        <Route path="/logros" element={<ProtectedRoute><BadgesPage /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<RoleRoute roles={['admin', 'administrador']}><AdminPage /></RoleRoute>} />
        <Route path="/guardia" element={<RoleRoute roles={['guard', 'guardia']}><GuardPage /></RoleRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
