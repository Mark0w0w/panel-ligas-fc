import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Role } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';
import { useLigas } from '../hooks/useLigas';

interface AdminUser {
  id: string;
  correo: string;
  nombre: string;
  rol: Role;
}

export default function AdminList() {
  const { user, role } = useAuth();
  const { ligas } = useLigas();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState<Role>('admin_liga1');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AdminUser, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof AdminUser) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof AdminUser) => {
    if (sortConfig?.key !== key) {
      return <span className="ml-1 text-slate-600">↕</span>;
    }
    return sortConfig.direction === 'asc' ? <span className="ml-1 text-indigo-400">↑</span> : <span className="ml-1 text-indigo-400">↓</span>;
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios_admin'), (snapshot) => {
      const data: AdminUser[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as AdminUser);
      });
      setAdmins(data);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string, nombre: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al administrador ${nombre}? (Esto revocará su acceso)`)) {
      try {
        await deleteDoc(doc(db, 'usuarios_admin', id));
        await logAction(user?.email, role, 'ELIMINAR', 'Administrador', `Revocó el acceso de ${nombre}`);
      } catch (error) {
        console.error("Error eliminando admin:", error);
        alert("Error al eliminar administrador.");
      }
    }
  };

  const startEdit = (admin: AdminUser) => {
    setEditingId(admin.id);
    setEditNombre(admin.nombre);
    setEditRol(admin.rol);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'usuarios_admin', id), {
        nombre: editNombre,
        rol: editRol
      });
      await logAction(user?.email, role, 'EDITAR', 'Administrador', `Actualizó el rol de ${editNombre} a ${editRol}`);
      setEditingId(null);
    } catch (error) {
      console.error("Error actualizando admin:", error);
      alert("Error al actualizar administrador.");
    }
  };

  const filteredAdmins = admins.filter(a => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;

    switch (searchColumn) {
      case 'nombre':
        return a.nombre.toLowerCase().includes(term);
      case 'correo':
        return a.correo.toLowerCase().includes(term);
      case 'rol':
        return a.rol && a.rol.toLowerCase().includes(term);
      default:
        return a.nombre.toLowerCase().includes(term) || 
               a.correo.toLowerCase().includes(term) ||
               (a.rol && a.rol.toLowerCase().includes(term));
    }
  });

  const sortedAdmins = [...filteredAdmins].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const valA = a[key] ?? '';
    const valB = b[key] ?? '';
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl mt-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-200">Directorio de Administradores</h3>
      </div>
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <select 
          value={searchColumn}
          onChange={(e) => setSearchColumn(e.target.value)}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        >
          <option value="all">Todas las columnas</option>
          <option value="nombre">Nombre</option>
          <option value="correo">Correo Electrónico</option>
          <option value="rol">Rol Asignado</option>
        </select>
        <input 
          type="text" 
          placeholder="Buscar..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
      </div>
      
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
            <tr>
              <th className="px-5 py-3.5 font-medium cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('nombre')}>Nombre {renderSortIcon('nombre')}</th>
              <th className="px-5 py-3.5 font-medium cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('correo')}>Correo Electrónico {renderSortIcon('correo')}</th>
              <th className="px-5 py-3.5 font-medium cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('rol')}>Rol Asignado {renderSortIcon('rol')}</th>
              <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 bg-slate-900/20">
            {sortedAdmins.map(admin => (
              <tr key={admin.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-4">
                  {editingId === admin.id ? (
                    <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  ) : (
                    <span className="text-white font-medium">{admin.nombre}</span>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-300">{admin.correo}</td>
                <td className="px-5 py-4">
                  {editingId === admin.id ? (
                    <select value={editRol || ''} onChange={e => setEditRol(e.target.value as Role)} className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      {ligas.map(l => (
                        <option key={l.id} value={`admin_${l.id}`}>Admin {l.nombre}</option>
                      ))}
                      <option value="superadmin">Super Admin</option>
                    </select>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${admin.rol === 'superadmin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      {admin.rol === 'superadmin' ? 'SUPER ADMIN' : admin.rol?.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  {editingId === admin.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleSaveEdit(admin.id)} className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors text-xs font-medium">Guardar</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg transition-colors text-xs font-medium">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(admin)} className="p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-colors shadow-sm" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(admin.id, admin.nombre)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors shadow-sm" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {sortedAdmins.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                  No se encontraron administradores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
