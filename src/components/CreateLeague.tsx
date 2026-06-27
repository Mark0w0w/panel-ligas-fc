import { useState } from 'react';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';
import { useLigas, type Liga } from '../hooks/useLigas';

export default function CreateLeague() {
  const { user, role } = useAuth();
  const { ligas } = useLigas();
  const [nombre, setNombre] = useState('');
  const [colorClass, setColorClass] = useState('text-indigo-400');
  const [bgClass, setBgClass] = useState('bg-indigo-500');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'superadmin') return;
    
    setLoading(true);
    setMsg({ text: '', type: '' });

    try {
      const id = nombre.toLowerCase().replace(/\s+/g, '_'); // Ej: "Liga 4" -> "liga_4"
      
      await setDoc(doc(db, 'ligas', id), {
        nombre,
        colorClass,
        bgClass,
        logoUrl,
        createdAt: new Date()
      });

      await logAction(user?.email, role, 'CREAR', 'Liga', `Creó una nueva liga: ${nombre}`);
      
      setMsg({ text: 'Liga creada exitosamente.', type: 'success' });
      setNombre('');
      setLogoUrl('');
    } catch (error: any) {
      console.error(error);
      setMsg({ text: `Error al crear liga: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (liga: Liga) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar la liga "${liga.nombre}"?\n\n¡ADVERTENCIA! Todos los jugadores y administradores asociados a esta liga quedarán huérfanos. Deberás reasignarlos o borrarlos manualmente.`)) {
      try {
        await deleteDoc(doc(db, 'ligas', liga.id));
        await logAction(user?.email, role, 'ELIMINAR', 'Liga', `Eliminó la liga: ${liga.nombre}`);
      } catch (error) {
        console.error("Error al eliminar la liga:", error);
        alert("Hubo un error al eliminar la liga.");
      }
    }
  };

  const startEdit = (liga: Liga) => {
    setEditingId(liga.id);
    setEditNombre(liga.nombre);
    setEditLogoUrl(liga.logoUrl || '');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'ligas', id), {
        nombre: editNombre,
        logoUrl: editLogoUrl
      });
      await logAction(user?.email, role, 'EDITAR', 'Liga', `Actualizó la liga: ${editNombre}`);
      setEditingId(null);
    } catch (error) {
      console.error("Error al editar la liga:", error);
      alert("Hubo un error al guardar los cambios.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Formulario de Creación */}
      <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl mt-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-200">Crear Nueva Liga</h3>
        </div>
        
        {msg.text && (
          <div className={`p-4 mb-6 rounded-xl border text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Nombre de la Liga</label>
            <input required type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors" placeholder="Ej: Liga 4" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Color Tema</label>
            <select value={colorClass} onChange={e => {
              setColorClass(e.target.value);
              setBgClass(e.target.options[e.target.selectedIndex].dataset.bg || 'bg-slate-500');
            }} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors">
              <option value="text-emerald-400" data-bg="bg-emerald-500">Esmeralda</option>
              <option value="text-sky-400" data-bg="bg-sky-500">Cielo</option>
              <option value="text-amber-400" data-bg="bg-amber-500">Ambar</option>
              <option value="text-purple-400" data-bg="bg-purple-500">Púrpura</option>
              <option value="text-pink-400" data-bg="bg-pink-500">Rosa</option>
              <option value="text-blue-400" data-bg="bg-blue-500">Azul</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">URL del Logo (Opcional)</label>
            <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors" placeholder="https://ejemplo.com/logo.png" />
          </div>
          <div className="md:col-span-2 mt-2">
            <button disabled={loading} type="submit" className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:transform-none">
              {loading ? 'Creando...' : 'Crear Liga'}
            </button>
          </div>
        </form>
      </div>

      {/* Tabla de Gestión de Ligas */}
      <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-200">Ligas Existentes</h3>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3.5 font-medium">Logo</th>
                <th className="px-5 py-3.5 font-medium">Nombre de la Liga</th>
                <th className="px-5 py-3.5 font-medium">Color Tema</th>
                <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900/20">
              {ligas.map(liga => (
                <tr key={liga.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4">
                    {liga.logoUrl ? (
                      <img src={liga.logoUrl} alt={liga.nombre} className="w-8 h-8 object-contain rounded-md bg-slate-800" />
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-700">
                        {liga.nombre.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {editingId === liga.id ? (
                      <div className="flex flex-col gap-2">
                        <input 
                          type="text" 
                          value={editNombre} 
                          onChange={e => setEditNombre(e.target.value)} 
                          className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                          placeholder="Nombre"
                        />
                        <input 
                          type="text" 
                          value={editLogoUrl} 
                          onChange={e => setEditLogoUrl(e.target.value)} 
                          className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs" 
                          placeholder="URL del Logo (Opcional)"
                        />
                      </div>
                    ) : (
                      <span className="text-white font-medium flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${liga.bgClass || 'bg-slate-500'}`}></span>
                        {liga.nombre}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-semibold ${liga.colorClass || 'text-slate-400'}`}>
                      {liga.colorClass?.replace('text-', '') || 'Default'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {editingId === liga.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleSaveEdit(liga.id)} className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors text-xs font-medium">Guardar</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg transition-colors text-xs font-medium">Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(liga)} className="p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-colors shadow-sm" title="Editar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(liga)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors shadow-sm" title="Eliminar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {ligas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                    No se encontraron ligas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
