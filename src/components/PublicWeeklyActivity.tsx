import { useState, useMemo } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Jugador } from '../types';
import { showAlert, showPublicWeekSelector } from '../utils/alerts';

interface PublicWeeklyActivityProps {
  ligaId: string;
  ligaNombre: string;
  metaSemanal?: number;
  players: Jugador[];
}

type SortField = 'nombre' | 'grl' | 'uid';
type SortDirection = 'asc' | 'desc';

export default function PublicWeeklyActivity({ ligaId,  metaSemanal = 0, players }: PublicWeeklyActivityProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const getCellColor = (status: any) => {
    if (status === 'logrado') return 'bg-emerald-500 text-white shadow-sm';
    if (status === 'no_logrado') return 'bg-rose-500 text-white shadow-sm';
    if (status === 'reciente') return 'bg-purple-500 text-white shadow-sm';
    return 'bg-slate-800/80 text-slate-500';
  };

  const getCellIcon = (status: any) => {
    if (status === 'logrado') return <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>;
    if (status === 'no_logrado') return <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>;
    if (status === 'reciente') return <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    return <span className="text-slate-600">-</span>;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedPlayers = useMemo(() => {
    let result = [...players];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(p => {
        switch (searchColumn) {
          case 'nombre': return p.nombre.toLowerCase().includes(lowerTerm);
          case 'grl': return p.grl.toString().includes(lowerTerm);
          case 'uid_jugador': return p.uid_jugador.toLowerCase().includes(lowerTerm);
          default:
            return p.nombre.toLowerCase().includes(lowerTerm) || 
                   p.uid_jugador.toLowerCase().includes(lowerTerm) ||
                   p.grl.toString().includes(lowerTerm);
        }
      });
    }
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'nombre') comparison = a.nombre.localeCompare(b.nombre);
      else if (sortField === 'grl') comparison = a.grl - b.grl;
      else if (sortField === 'uid') comparison = a.uid_jugador.localeCompare(b.uid_jugador);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [players, searchTerm, searchColumn, sortField, sortDirection]);

  const weeks = ['semana1', 'semana2', 'semana3', 'semana4'];

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <svg className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return sortDirection === 'asc' 
      ? <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  const handleRequestReview = async (jugador: Jugador) => {
    const selectedWeek = await showPublicWeekSelector();
    
    if (selectedWeek) {
      try {
        await addDoc(collection(db, 'revisiones_actividad'), {
          jugadorId: jugador.id,
          nombre: jugador.nombre,
          ligaId: ligaId,
          mensaje: `Revisión para la ${selectedWeek}`,
          status: 'pendiente',
          createdAt: serverTimestamp()
        });
        showAlert('Éxito', 'Se ha enviado tu reporte, ahora los admins lo revisaran para tu caso', 'success');
      } catch (error: any) {
        console.error('Error submitting review request:', error);
        showAlert('Error', `Detalle: ${error.message}`, 'error');
      }
    }
  };

  return (
    <div className="bg-[#1e293b] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
      <div className="p-6 md:p-8 border-b border-slate-800 bg-slate-800/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Actividad Semanal</h2>
            <p className="text-slate-400">Verifica tu cumplimiento semanal. Meta actual: <strong className="text-white bg-slate-800 px-2 py-0.5 rounded">{metaSemanal} pts</strong></p>
          </div>
          
          <div className="flex-1 w-full md:max-w-xl">
            <div className="flex flex-col sm:flex-row gap-2">
              <select 
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
                className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="all">Todas las columnas</option>
                <option value="nombre">Jugador</option>
                <option value="grl">GRL</option>
                <option value="uid_jugador">UID</option>
              </select>
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  type="text"
                  placeholder="Busca tu usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-slate-400 border-b border-slate-800 bg-[#0f172a]/80">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-800 border border-slate-600"></div> Sin registrar (Gris)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Cumplió (Verde)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div> No cumplió (Rojo)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Inc. Reciente</div>
      </div>

      <div className="overflow-x-auto bg-slate-900/50">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-300 text-sm select-none">
              <th className="p-5 font-semibold cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('nombre')}>
                <div className="flex items-center gap-2">Jugador {renderSortIcon('nombre')}</div>
              </th>
              <th className="p-5 font-semibold text-center cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('uid')}>
                <div className="flex items-center justify-center gap-2">UID {renderSortIcon('uid')}</div>
              </th>
              <th className="p-5 font-semibold text-center cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('grl')}>
                <div className="flex items-center justify-center gap-2">GRL {renderSortIcon('grl')}</div>
              </th>
              <th className="p-5 font-semibold text-center">S1</th>
              <th className="p-5 font-semibold text-center">S2</th>
              <th className="p-5 font-semibold text-center">S3</th>
              <th className="p-5 font-semibold text-center">S4</th>
              <th className="p-5 font-semibold text-right">Revisión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredAndSortedPlayers.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  No se encontraron jugadores que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              filteredAndSortedPlayers.map(jugador => {
                return (
                  <tr key={jugador.id} className="transition-colors hover:bg-slate-800/60 group">
                    <td className="p-5 font-semibold text-white">
                      {jugador.nombre}
                    </td>
                    <td className="p-5 text-center">
                      <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2.5 py-1 rounded-md border border-slate-700">{jugador.uid_jugador}</span>
                    </td>
                    <td className="p-5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700 text-slate-200 font-bold text-sm">
                        {jugador.grl}
                      </span>
                    </td>
                    
                    {weeks.map(week => {
                      const status = jugador.actividad?.[week as keyof typeof jugador.actividad];
                      const cellColor = getCellColor(status);
                      
                      return (
                        <td key={week} className="p-5 text-center align-middle">
                          <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${cellColor}`}>
                            {getCellIcon(status)}
                          </div>
                        </td>
                      );
                    })}
                    
                    <td className="p-5 text-right">
                      <button
                        onClick={() => handleRequestReview(jugador)}
                        className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-400 text-sm font-medium transition-colors"
                      >
                        Pedir Revisión
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
