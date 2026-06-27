import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db, secondaryAuth } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';
import { useLigas } from '../hooks/useLigas';

export default function AdminManager() {
  const { user, role: currentRole } = useAuth();
  const { ligas } = useLigas();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<string>('admin_liga1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      // 1. Crear usuario en Firebase Auth usando la app secundaria (no cierra la sesión principal)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;

      // 2. Guardar en Firestore usando la instancia principal db (usa los privilegios del superadmin actual)
      await setDoc(doc(db, 'usuarios_admin', newUser.uid), {
        correo: email,
        nombre,
        rol
      });

      await logAction(user?.email, currentRole, 'CREAR', 'Administrador', `Creó la cuenta de administrador: ${nombre} (${rol})`);

      setMessage({ text: 'Administrador creado exitosamente.', type: 'success' });
      setEmail('');
      setPassword('');
      setNombre('');
    } catch (error: any) {
      console.error(error);
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl mt-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-200">Gestión de Administradores</h3>
      </div>
      
      {message.text && (
        <div className={`p-4 mb-6 rounded-xl border text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Nombre Completo</label>
          <input required type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Ej: Juan Pérez" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Correo Electrónico</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="admin@liga1.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Contraseña Temporal</label>
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Mínimo 6 caracteres" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Rol a Asignar</label>
          <select required value={rol || ''} onChange={e => setRol(e.target.value as string)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors">
            {ligas.map(l => (
              <option key={l.id} value={`admin_${l.id}`}>Admin {l.nombre}</option>
            ))}
            <option value="superadmin">Super Admin</option>
          </select>
        </div>
        <div className="md:col-span-2 mt-2">
          <button disabled={loading} type="submit" className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:transform-none">
            {loading ? 'Creando Administrador...' : 'Crear Cuenta de Administrador'}
          </button>
        </div>
      </form>
    </div>
  );
}
