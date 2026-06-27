import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';

interface Jugador {
  id: string;
  nombre: string;
  whatsapp: string;
  uid_jugador: string;
  grl: number;
  liga: string;
}

export default function DeletedUsers() {
  const { user, role } = useAuth();
  const [eliminados, setEliminados] = useState<Jugador[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Jugador, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    const q = collection(db, 'jugadores_eliminados');
    const unsub = onSnapshot(q, (snapshot) => {
      let data: Jugador[] = [];
      snapshot.forEach(document => {
        data.push({ id: document.id, ...document.data() } as Jugador);
      });
      
      // Si no es superadmin, solo mostrar de las ligas a las que tiene acceso?
      // O tal vez mostrar solo de la liga de su rol.
      if (role !== 'superadmin') {
        if (role === 'admin_liga1') data = data.filter(j => j.liga === 'liga1');
        else if (role === 'admin_liga2') data = data.filter(j => j.liga === 'liga2');
        else if (role === 'admin_liga3') data = data.filter(j => j.liga === 'liga3');
      }
      
      setEliminados(data);
    });
    
    return () => unsub();
  }, [role]);

  const handleSort = (key: keyof Jugador) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredPlayers = eliminados.filter(p => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    
    switch (searchColumn) {
      case 'nombre': return p.nombre.toLowerCase().includes(term);
      case 'grl': return p.grl.toString().includes(term);
      case 'whatsapp': return p.whatsapp.toLowerCase().includes(term);
      case 'uid_jugador': return p.uid_jugador.toLowerCase().includes(term);
      default:
        return p.nombre.toLowerCase().includes(term) || 
               p.uid_jugador.toLowerCase().includes(term) ||
               p.whatsapp.toLowerCase().includes(term) ||
               p.grl.toString().includes(term);
    }
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const valA = a[key] ?? '';
    const valB = b[key] ?? '';
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (key: keyof Jugador) => {
    if (sortConfig?.key !== key) {
      return <span className="ml-1 text-slate-600">↕</span>;
    }
    return sortConfig.direction === 'asc' ? <span className="ml-1 text-rose-400">↑</span> : <span className="ml-1 text-rose-400">↓</span>;
  };

  const handleRestore = async (jugador: Jugador) => {
    if (window.confirm(`¿Estás seguro de que deseas restaurar a ${jugador.nombre}? Volverá a la ${jugador.liga}.`)) {
      try {
        // Añadir a colección activa
        await addDoc(collection(db, 'jugadores'), {
          nombre: jugador.nombre,
          whatsapp: jugador.whatsapp,
          uid_jugador: jugador.uid_jugador,
          grl: jugador.grl,
          liga: jugador.liga,
          createdAt: serverTimestamp()
        });
        
        // Eliminar de papelera
        await deleteDoc(doc(db, 'jugadores_eliminados', jugador.id));
        
        await logAction(user?.email, role, 'CREAR', 'Usuario', `Restauró al usuario ${jugador.nombre} a la ${jugador.liga}`);
      } catch (error) {
        console.error("Error al restaurar jugador:", error);
        alert("Hubo un error al restaurar el usuario");
      }
    }
  };

  if (eliminados.length === 0 && !searchTerm) return null; // No mostrar sección si no hay eliminados y no se está buscando

  return (
    <section className="bg-rose-950/20 p-6 rounded-2xl border border-rose-900/50 backdrop-blur-sm mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold flex items-center gap-3 text-rose-400">
          <span className="w-2 h-8 rounded-full bg-rose-500"></span>
          Papelera - Usuarios Eliminados
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-[#1e293b] p-6 rounded-xl border border-rose-900/30 shadow-md">
          <h3 className="text-sm font-medium text-rose-300/70 mb-2">Total Usuarios Eliminados</h3>
          <p className="text-4xl font-bold text-rose-200">{eliminados.length}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <select 
          value={searchColumn}
          onChange={(e) => setSearchColumn(e.target.value)}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
        >
          <option value="all">Todas las columnas</option>
          <option value="nombre">Nombre</option>
          <option value="grl">GRL</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="uid_jugador">UID Usuario</option>
        </select>
        <input 
          type="text" 
          placeholder="Buscar usuario eliminado..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
        />
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-rose-900/30 overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800/50 text-slate-300 border-b border-rose-900/30">
              <tr>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('nombre')}>
                  Nombre {renderSortIcon('nombre')}
                </th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('grl')}>
                  GRL {renderSortIcon('grl')}
                </th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('whatsapp')}>
                  WhatsApp {renderSortIcon('whatsapp')}
                </th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('uid_jugador')}>
                  UID Usuario {renderSortIcon('uid_jugador')}
                </th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-900/20">
              {sortedPlayers.map(j => (
                <tr key={j.id} className="hover:bg-slate-800/50 transition-colors opacity-80">
                  <td className="px-6 py-4 text-white font-medium">{j.nombre}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-300 font-bold">{j.grl}</span>
                  </td>
                  <td className="px-6 py-4">{j.whatsapp}</td>
                  <td className="px-6 py-4 font-mono text-slate-500">{j.uid_jugador}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleRestore(j)} className="px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors shadow-sm font-medium border border-emerald-500/20" title="Restaurar">
                        Restaurar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedPlayers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No se encontraron usuarios eliminados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
