import { useState } from 'react';
import type { Jugador } from '../types';

export interface LeagueSectionProps {
  ligaId: string;
  titulo: string;
  colorClass: string;
  bgClass: string;
  players: Jugador[];
  onAddPlayer: (ligaId: string) => void;
  onEditPlayer: (jugador: Jugador) => void;
  onDeletePlayer: (jugador: Jugador) => void;
}

export default function LeagueSection({ ligaId, titulo, colorClass, bgClass, players, onAddPlayer, onEditPlayer, onDeletePlayer }: LeagueSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');
  const [grlMin, setGrlMin] = useState<string>('');
  const [grlMax, setGrlMax] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Jugador, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof Jugador) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredPlayers = players.filter(p => {
    // 1. Filtros avanzados: Min/Max GRL
    const pGrl = Number(p.grl);
    if (grlMin && pGrl < Number(grlMin)) return false;
    if (grlMax && pGrl > Number(grlMax)) return false;

    // 2. Filtro de texto
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    
    switch (searchColumn) {
      case 'nombre':
        return p.nombre.toLowerCase().includes(term);
      case 'grl':
        return p.grl.toString().includes(term);
      case 'whatsapp':
        return p.whatsapp.toLowerCase().includes(term);
      case 'uid_jugador':
        return p.uid_jugador.toLowerCase().includes(term);
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
    return sortConfig.direction === 'asc' ? <span className="ml-1 text-blue-400">↑</span> : <span className="ml-1 text-blue-400">↓</span>;
  };

  return (
    <section className="bg-[#1e293b]/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className={`text-2xl font-semibold flex items-center gap-3 ${colorClass}`}>
          <span className={`w-2 h-8 rounded-full ${bgClass}`}></span>
          {titulo}
        </h2>
        <button 
          onClick={() => onAddPlayer(ligaId)}
          className={`font-medium transition-colors px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 ${colorClass} flex items-center gap-2 shadow-sm`}
        >
          <span>+</span> Agregar Usuario
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700 shadow-md">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Total Usuarios</h3>
          <p className="text-4xl font-bold text-white">{players.length}</p>
        </div>
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700 shadow-md">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Equipos Registrados</h3>
          <p className="text-4xl font-bold text-slate-500">Próximamente</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <select 
            value={searchColumn}
            onChange={(e) => setSearchColumn(e.target.value)}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          >
            <option value="all">Todas las columnas</option>
            <option value="nombre">Nombre</option>
            <option value="grl">GRL</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="uid_jugador">UID Usuario</option>
          </select>
          <input 
            type="text" 
            placeholder="Buscar por texto..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
          <span className="text-sm font-medium text-slate-400">Filtros Avanzados:</span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">GRL Mínimo:</label>
            <input 
              type="number" 
              value={grlMin}
              onChange={(e) => setGrlMin(e.target.value)}
              className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 text-sm"
              placeholder="Ej: 80"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">GRL Máximo:</label>
            <input 
              type="number" 
              value={grlMax}
              onChange={(e) => setGrlMax(e.target.value)}
              className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 text-sm"
              placeholder="Ej: 150"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden shadow-md flex-1">
        <div className="overflow-x-auto h-full">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800/50 text-slate-300 border-b border-slate-700">
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
            <tbody className="divide-y divide-slate-700/50">
              {sortedPlayers.map(j => (
                <tr key={j.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-white font-medium">{j.nombre}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-300 font-bold">{j.grl}</span>
                  </td>
                  <td className="px-6 py-4">{j.whatsapp}</td>
                  <td className="px-6 py-4 font-mono text-slate-500">{j.uid_jugador}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => onEditPlayer(j)} className="p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-colors shadow-sm" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => onDeletePlayer(j)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors shadow-sm" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedPlayers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No se encontraron usuarios.
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
