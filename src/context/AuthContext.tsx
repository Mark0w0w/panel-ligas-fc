import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export type Role = string | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // RECOMENDACIÓN: Usar el UID del usuario como ID del documento en Firestore.
          const userDoc = await getDoc(doc(db, 'usuarios_admin', currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().rol as Role);
          } else {
            setRole(null);
          }
        } catch (error) {
          console.error("Error obteniendo el rol del usuario:", error);
          setRole(null);
        }
      } else {
        setRole(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {/* No renderizar hijos hasta que no sepamos el estado de autenticación (evita parpadeos) */}
      {!loading && children}
    </AuthContext.Provider>
  );
};
