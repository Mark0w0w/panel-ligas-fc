import React, { useState, useMemo, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Jugador } from '../types';
import { showAlert, showActivityStateSelector, showConfirm } from '../utils/alerts';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

interface WeeklyActivityManagerProps {
  ligaId: string;
  ligaNombre: string;
  metaSemanal?: number;
  players: Jugador[];
}

type StatusType = 'logrado' | 'no_logrado' | 'reciente';
type SortField = 'nombre' | 'grl' | 'uid';
type SortDirection = 'asc' | 'desc';

export default function WeeklyActivityManager({ ligaId, ligaNombre, metaSemanal = 0, players }: WeeklyActivityManagerProps) {
  const [editingMeta, setEditingMeta] = useState(false);
  const [tempMeta, setTempMeta] = useState(metaSemanal.toString());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [activeTab, setActiveTab] = useState<'tabla' | 'revisiones'>('tabla');
  const [revisiones, setRevisiones] = useState<any[]>([]);

  useEffect(() => {
    const qRev = query(
      collection(db, 'revisiones_actividad'),
      where('ligaId', '==', ligaId),
      where('status', '==', 'pendiente')
    );
    const unsub = onSnapshot(qRev, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setRevisiones(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    });
    return () => unsub();
  }, [ligaId]);

  const handleRejectReview = async (revId: string, nombre: string) => {
    const isConfirmed = await showConfirm(
      'Descartar solicitud',
      `¿Estás seguro de descartar la solicitud de revisión de ${nombre}?`,
      'Sí, descartar',
      true
    );
    if (isConfirmed) {
      try {
        await deleteDoc(doc(db, 'revisiones_actividad', revId));
        showAlert('Descartado', 'La solicitud ha sido eliminada.', 'info');
      } catch (error) {
        console.error('Error resolving review:', error);
        showAlert('Error', 'No se pudo descartar la solicitud', 'error');
      }
    }
  };

  const handleAcceptReview = async (rev: any) => {
    // Attempt to extract week from message: "Revisión para la Semana X"
    let targetWeek = 'Semana 1';
    let dbWeek = 'semana1';
    
    if (rev.mensaje?.includes('Semana 1')) { targetWeek = 'Semana 1'; dbWeek = 'semana1'; }
    else if (rev.mensaje?.includes('Semana 2')) { targetWeek = 'Semana 2'; dbWeek = 'semana2'; }
    else if (rev.mensaje?.includes('Semana 3')) { targetWeek = 'Semana 3'; dbWeek = 'semana3'; }
    else if (rev.mensaje?.includes('Semana 4')) { targetWeek = 'Semana 4'; dbWeek = 'semana4'; }

    const state = await showActivityStateSelector(rev.nombre, targetWeek);
    
    if (state) {
      try {
        const playerRef = doc(db, 'jugadores', rev.jugadorId);
        await updateDoc(playerRef, {
          [`actividad.${dbWeek}`]: state
        });
        await deleteDoc(doc(db, 'revisiones_actividad', rev.id));
        showAlert('Actualizado', `La ${targetWeek} de ${rev.nombre} ha sido actualizada.`, 'success');
      } catch (error) {
        console.error('Error:', error);
        showAlert('Error', 'No se pudo actualizar el estado', 'error');
      }
    }
  };

  const handleUpdateMeta = async () => {
    const metaNum = parseInt(tempMeta, 10);
    if (!isNaN(metaNum) && metaNum >= 0) {
      try {
        await updateDoc(doc(db, 'ligas', ligaId), {
          metaSemanal: metaNum
        });
        setEditingMeta(false);
      } catch (error) {
        console.error('Error updating meta:', error);
      }
    }
  };

  const handleToggleCellStatus = async (jugadorId: string, week: string, currentStatus: any) => {
    // Ciclo: vacío -> logrado -> no_logrado -> reciente -> logrado
    const nextStatus: StatusType = currentStatus === 'logrado' ? 'no_logrado' : currentStatus === 'no_logrado' ? 'reciente' : 'logrado';

    try {
      const playerRef = doc(db, 'jugadores', jugadorId);
      await updateDoc(playerRef, {
        [`actividad.${week}`]: nextStatus
      });
    } catch (error) {
      console.error('Error updating activity status:', error);
    }
  };

  const getCellColor = (status: any) => {
    if (status === 'logrado') return 'bg-emerald-500 text-white'; // Verde
    if (status === 'no_logrado') return 'bg-rose-500 text-white'; // Rojo
    if (status === 'reciente') return 'bg-purple-500 text-white'; // Morado
    return 'bg-slate-700/50 hover:bg-slate-600'; // Gris
  };

  const getCellIcon = (status: any) => {
    if (status === 'logrado') return <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>;
    if (status === 'no_logrado') return <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>;
    if (status === 'reciente') return <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    return <span className="text-transparent">-</span>;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtrado y ordenamiento local
  const filteredAndSortedPlayers = useMemo(() => {
    let result = [...players];

    // Filtrar
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(p => {
        switch (searchColumn) {
          case 'nombre':
            return p.nombre.toLowerCase().includes(lowerTerm);
          case 'grl':
            return p.grl.toString().includes(lowerTerm);
          case 'uid_jugador':
            return p.uid_jugador.toLowerCase().includes(lowerTerm);
          default:
            return p.nombre.toLowerCase().includes(lowerTerm) || 
                   p.uid_jugador.toLowerCase().includes(lowerTerm) ||
                   p.grl.toString().includes(lowerTerm);
        }
      });
    }

    // Ordenar
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'nombre') {
        comparison = a.nombre.localeCompare(b.nombre);
      } else if (sortField === 'grl') {
        comparison = a.grl - b.grl;
      } else if (sortField === 'uid') {
        comparison = a.uid_jugador.localeCompare(b.uid_jugador);
      }
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

  // Analytics Calculations
  const stats = useMemo(() => {
    let logrado = 0, no_logrado = 0, reciente = 0, pendiente = 0;
    const sCounts = { s1: 0, s2: 0, s3: 0, s4: 0 };
    
    const playerScores = players.map(p => {
      let score = 0;
      ['semana1', 'semana2', 'semana3', 'semana4'].forEach((w, i) => {
        const status = (p.actividad as any)?.[w];
        if (status === 'logrado') { 
          logrado++; 
          score++; 
          if (i===0) sCounts.s1++; if (i===1) sCounts.s2++; if (i===2) sCounts.s3++; if (i===3) sCounts.s4++; 
        }
        else if (status === 'no_logrado') no_logrado++;
        else if (status === 'reciente') reciente++;
        else pendiente++;
      });
      return { ...p, score };
    });

    const mvps = playerScores.filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    
    const pieData = [
      { name: 'Cumplió', value: logrado, color: '#10b981' },
      { name: 'No Cumplió', value: no_logrado, color: '#f43f5e' },
      { name: 'Reciente', value: reciente, color: '#a855f7' },
      { name: 'Pendiente', value: pendiente, color: '#334155' }
    ].filter(d => d.value > 0);

    const barData = [
      { name: 'S1', Cumplió: sCounts.s1 },
      { name: 'S2', Cumplió: sCounts.s2 },
      { name: 'S3', Cumplió: sCounts.s3 },
      { name: 'S4', Cumplió: sCounts.s4 }
    ];

    return { pieData, barData, mvps };
  }, [players]);

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-800 bg-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Control de Actividad Semanal
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-slate-400">Meta Semanal (Informativa):</span>
            {editingMeta ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={tempMeta}
                  onChange={(e) => setTempMeta(e.target.value)}
                  className="w-16 bg-slate-800 border border-blue-500/50 rounded text-white text-xs px-1 py-0.5 focus:outline-none"
                />
                <button onClick={handleUpdateMeta} className="text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
                <button onClick={() => setEditingMeta(false)} className="text-rose-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white bg-slate-800 px-2 py-0.5 rounded">{metaSemanal} pts</span>
                <button onClick={() => { setTempMeta(metaSemanal.toString()); setEditingMeta(true); }} className="text-slate-500 hover:text-blue-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-6 pt-4 border-b border-slate-800 bg-slate-800/20">
        <button 
          onClick={() => setActiveTab('tabla')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === 'tabla' ? 'bg-[#1e293b] text-blue-400 border-t border-l border-r border-slate-700' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Tabla de Actividad
        </button>
        <button 
          onClick={() => setActiveTab('revisiones')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'revisiones' ? 'bg-[#1e293b] text-amber-400 border-t border-l border-r border-slate-700' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Revisiones Solicitadas
          {revisiones.length > 0 && (
            <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">{revisiones.length}</span>
          )}
        </button>
      </div>
      
      {activeTab === 'tabla' && (
        <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
          
          {/* Analytics Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border-b border-slate-800 bg-slate-900/30">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-sm font-bold text-slate-300 mb-2">Estado General (Mes)</h3>
              <div className="h-[120px] w-full">
                {stats.pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.pieData} innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                        {stats.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">Sin datos</div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-sm font-bold text-slate-300 mb-2">Cumplimientos por Semana</h3>
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.barData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    />
                    <Bar dataKey="Cumplió" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                Top Jugadores (MVP)
              </h3>
              <div className="space-y-2">
                {stats.mvps.length > 0 ? stats.mvps.map((mvp, i) => (
                  <div key={mvp.id} className="flex justify-between items-center text-sm bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                    <span className="text-white font-medium truncate pr-2"><span className="text-slate-500 mr-2">{i+1}.</span>{mvp.nombre}</span>
                    <span className="text-emerald-400 font-bold whitespace-nowrap">{mvp.score} pts</span>
                  </div>
                )) : (
                  <div className="text-xs text-slate-500 text-center py-4">Aún no hay puntos registrados</div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-2 md:items-center">
            <select 
              value={searchColumn}
              onChange={(e) => setSearchColumn(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              <option value="all">Todas las columnas</option>
              <option value="nombre">Jugador</option>
              <option value="grl">GRL</option>
              <option value="uid_jugador">UID</option>
            </select>
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-medium text-slate-400 border-b border-slate-800 bg-[#0f172a]/50">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Cumplió (Verde)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div> No cumplió (Rojo)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Inc. Reciente</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-800 bg-[#1e293b] text-slate-400 text-sm select-none">
              <th 
                className="p-4 font-medium cursor-pointer hover:bg-slate-800 transition-colors group"
                onClick={() => handleSort('nombre')}
              >
                <div className="flex items-center gap-2">Jugador {renderSortIcon('nombre')}</div>
              </th>
              <th 
                className="p-4 font-medium text-center cursor-pointer hover:bg-slate-800 transition-colors group"
                onClick={() => handleSort('uid')}
              >
                <div className="flex items-center justify-center gap-2">UID {renderSortIcon('uid')}</div>
              </th>
              <th 
                className="p-4 font-medium text-center cursor-pointer hover:bg-slate-800 transition-colors group"
                onClick={() => handleSort('grl')}
              >
                <div className="flex items-center justify-center gap-2">GRL {renderSortIcon('grl')}</div>
              </th>
              <th className="p-4 font-medium text-center">Semana 1</th>
              <th className="p-4 font-medium text-center">Semana 2</th>
              <th className="p-4 font-medium text-center">Semana 3</th>
              <th className="p-4 font-medium text-center">Semana 4</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredAndSortedPlayers.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">No se encontraron jugadores que coincidan con la búsqueda.</td>
              </tr>
            ) : (
              filteredAndSortedPlayers.map(jugador => {
                return (
                  <tr key={jugador.id} className="transition-colors hover:bg-slate-800/30">
                    <td className="p-4 font-semibold text-slate-200">
                      <span>{jugador.nombre}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded">{jugador.uid_jugador}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-slate-300 font-bold text-sm">
                        {jugador.grl}
                      </span>
                    </td>
                    
                    {weeks.map(week => {
                      const status = jugador.actividad?.[week as keyof typeof jugador.actividad];
                      const cellColor = getCellColor(status);
                      
                      return (
                        <td key={week} className="p-4 text-center align-middle">
                          <button 
                            onClick={() => handleToggleCellStatus(jugador.id, week, status)}
                            className={`w-10 h-10 rounded-xl transition-all shadow-sm border border-transparent ${cellColor} focus:outline-none focus:ring-2 focus:ring-blue-500/50 active:scale-95`}
                            title="Clic para cambiar estado"
                          >
                            {getCellIcon(status)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>
      )}

      {activeTab === 'revisiones' && (
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left text-sm text-slate-400 min-w-[500px]">
            <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700 sticky top-0">
              <tr>
                <th className="px-5 py-3.5 font-medium">Jugador</th>
                <th className="px-5 py-3.5 font-medium">Fecha</th>
                <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900/20">
              {revisiones.map(rev => {
                const playerDetails = players.find(p => p.id === rev.jugadorId);
                return (
                  <tr key={rev.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium">{rev.nombre}</p>
                      {playerDetails && <p className="text-xs text-slate-500 font-mono">UID: {playerDetails.uid_jugador} | GRL: {playerDetails.grl}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-slate-400 block">{rev.createdAt?.toDate().toLocaleString() || 'Reciente'}</span>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold rounded-md">
                        {rev.mensaje && rev.mensaje.includes('Semana') ? rev.mensaje.toUpperCase() : 'RECLAMO ACTIVIDAD'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleAcceptReview(rev)} 
                          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Aceptar
                        </button>
                        <button 
                          onClick={() => handleRejectReview(rev.id, rev.nombre)} 
                          className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          Descartar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {revisiones.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    No hay solicitudes pendientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
