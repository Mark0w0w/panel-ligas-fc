import { Navigate } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[]; // Si no se provee, solo verifica que el usuario esté logueado
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 1. Si no hay usuario, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Si se requieren roles específicos y el usuario no los tiene, denegar acceso
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Podríamos redirigir a una página de "No Autorizado", pero por ahora lo mandamos al dashboard base
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Todo correcto, renderizar el componente protegido
  return <>{children}</>;
}
