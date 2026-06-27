import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Jugador } from '../types';
import type { Liga } from '../hooks/useLigas';
import { showAlert, showConfirm } from '../utils/alerts';
import PublicWeeklyActivity from './PublicWeeklyActivity';

export default function PublicTournamentPortal() {
  const { ligaId } = useParams<{ ligaId: string }>();
  
  const [liga, setLiga] = useState<Liga | null>(null);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'torneo' | 'actividad'>('torneo');

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);

  // Solicitudes y torneo actual
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [asistencia, setAsistencia] = useState<Record<string, string>>({});
  const [requisitoGoles, setRequisitoGoles] = useState<string>('');

  const [history, setHistory] = useState<any[]>([]);
  const [histSearchTerm, setHistSearchTerm] = useState('');
  const [histSearchColumn, setHistSearchColumn] = useState<string>('all');
  const [selectedPlayerHist, setSelectedPlayerHist] = useState<string | null>(null);
  
  const [histSortConfig, setHistSortConfig] = useState<{key: 'nombre' | 'grl' | 'uid_jugador', direction: 'asc'|'desc'} | null>(null);

  const handleHistSort = (key: 'nombre' | 'grl' | 'uid_jugador') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (histSortConfig && histSortConfig.key === key && histSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setHistSortConfig({ key, direction });
  };

  const [sortConfig, setSortConfig] = useState<{key: 'nombre' | 'grl' | 'uid_jugador' | 'inscripcion', direction: 'asc'|'desc'} | null>(null);

  const handleSort = (key: 'nombre' | 'grl' | 'uid_jugador' | 'inscripcion') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const [partSearchTerm, setPartSearchTerm] = useState('');
  const [partSearchColumn, setPartSearchColumn] = useState<string>('all');
  const [partSortConfig, setPartSortConfig] = useState<{key: 'nombre' | 'grl' | 'uid_jugador' | 'estado', direction: 'asc'|'desc'} | null>(null);

  const handlePartSort = (key: 'nombre' | 'grl' | 'uid_jugador' | 'estado') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (partSortConfig && partSortConfig.key === key && partSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setPartSortConfig({ key, direction });
  };

  const [expandedTorneos, setExpandedTorneos] = useState<string[]>([]);
  
  const toggleTorneo = (fecha: string) => {
    setExpandedTorneos(prev => 
      prev.includes(fecha) ? prev.filter(f => f !== fecha) : [...prev, fecha]
    );
  };

  const [histGenSearchTerm, setHistGenSearchTerm] = useState('');
  const [histGenSearchColumn, setHistGenSearchColumn] = useState<string>('all');
  const [histGenSortConfig, setHistGenSortConfig] = useState<{key: 'nombre' | 'grl' | 'uid_jugador' | 'estado', direction: 'asc'|'desc'} | null>(null);

  const handleHistGenSort = (key: 'nombre' | 'grl' | 'uid_jugador' | 'estado') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (histGenSortConfig && histGenSortConfig.key === key && histGenSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setHistGenSortConfig({ key, direction });
  };

  useEffect(() => {
    if (!ligaId) return;

    const unsubLiga = onSnapshot(collection(db, 'ligas'), (snapshot) => {
      const data: Liga[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Liga));
      const found = data.find(l => l.id === ligaId);
      if (found) setLiga(found);
    });

    const qJugadores = query(collection(db, 'jugadores'), where('liga', '==', ligaId));
    const unsubJug = onSnapshot(qJugadores, (snapshot) => {
      const data: Jugador[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Jugador));
      setJugadores(data);
      setLoading(false);
    });

    const qSolicitudes = query(
      collection(db, 'solicitudes_torneo'), 
      where('ligaId', '==', ligaId),
      where('fecha', '==', date),
      where('status', '==', 'pendiente')
    );
    const unsubSol = onSnapshot(qSolicitudes, (snapshot) => {
      const p = new Set<string>();
      snapshot.forEach(doc => p.add(doc.data().jugadorId));
      setPendingRequests(p);
    });

    // Escuchar el torneo de la fecha
    const qTorneo = query(collection(db, 'torneos_diarios'), where('liga', '==', ligaId), where('fecha', '==', date));
    const unsubTorneo = onSnapshot(qTorneo, (snapshot) => {
      if (!snapshot.empty) {
        const d = snapshot.docs[0].data();
        setAcceptedIds(d.jugadores || []);
        
        const loadedAsistencia = d.asistencia || {};
        const normalizedAsistencia: Record<string, string> = {};
        for (const key in loadedAsistencia) {
          if (loadedAsistencia[key] === true) normalizedAsistencia[key] = 'cumplio';
          else if (loadedAsistencia[key] === false) normalizedAsistencia[key] = 'no_jugo';
          else normalizedAsistencia[key] = loadedAsistencia[key];
        }
        setAsistencia(normalizedAsistencia);
        setRequisitoGoles(d.requisitoGoles || '');
      } else {
        setAcceptedIds([]);
        setAsistencia({});
        setRequisitoGoles('');
      }
    });

    const qHist = query(collection(db, 'torneos_diarios'), where('liga', '==', ligaId));
    const unsubHist = onSnapshot(qHist, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push(doc.data()));
      data.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setHistory(data.slice(0, 14));
    });

    return () => {
      unsubLiga();
      unsubJug();
      unsubSol();
      unsubTorneo();
      unsubHist();
    };
  }, [ligaId, date]);

  const handleRequestParticipation = async (jugador: Jugador) => {
    if (acceptedIds.includes(jugador.id)) {
      showAlert('Ya inscrito', 'Ya estás inscrito en el torneo de hoy.', 'info');
      return;
    }
    if (jugadores.filter(p => acceptedIds.includes(p.id)).length >= 32) {
      showAlert('Torneo lleno', 'El torneo de hoy ya está lleno (32/32).', 'warning');
      return;
    }
    if (pendingRequests.has(jugador.id)) {
      showAlert('Solicitud pendiente', 'Ya has solicitado participar. Espera la confirmación del administrador.', 'info');
      return;
    }

    const isConfirmed = await showConfirm(
      'Solicitar Participación', 
      `Hola ${jugador.nombre}, ¿quieres solicitar tu participación en el Torneo Diario de hoy?`, 
      'Sí, solicitar'
    );

    if (isConfirmed) {
      try {
        await addDoc(collection(db, 'solicitudes_torneo'), {
          jugadorId: jugador.id,
          nombre: jugador.nombre,
          ligaId: ligaId,
          fecha: todayStr,
          status: 'pendiente',
          createdAt: serverTimestamp()
        });
        showAlert('¡Completado!', '¡Solicitud enviada exitosamente!', 'success');
      } catch (error) {
        console.error(error);
        showAlert('Error', 'Hubo un error al enviar la solicitud.', 'error');
      }
    }
  };

  const filteredPlayers = jugadores.filter(p => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    switch (searchColumn) {
      case 'nombre': return p.nombre.toLowerCase().includes(term);
      case 'grl': return p.grl.toString().includes(term);
      case 'uid_jugador': return p.uid_jugador.toLowerCase().includes(term);
      default: return p.nombre.toLowerCase().includes(term) || p.uid_jugador.toLowerCase().includes(term) || p.grl.toString().includes(term);
    }
  });

  const sortedFilteredPlayers = [...filteredPlayers].sort((a, b) => {
    if (!sortConfig) return 0;
    
    if (sortConfig.key === 'inscripcion') {
      const aVal = acceptedIds.includes(a.id) ? 2 : pendingRequests.has(a.id) ? 1 : 0;
      const bVal = acceptedIds.includes(b.id) ? 2 : pendingRequests.has(b.id) ? 1 : 0;
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  let filteredHistPlayers = jugadores.filter(p => {
    const term = histSearchTerm.toLowerCase();
    if (!term) return true;
    switch (histSearchColumn) {
      case 'nombre': return p.nombre.toLowerCase().includes(term);
      case 'grl': return p.grl.toString().includes(term);
      case 'uid_jugador': return p.uid_jugador.toLowerCase().includes(term);
      default: return p.nombre.toLowerCase().includes(term) || p.uid_jugador.toLowerCase().includes(term) || p.grl.toString().includes(term);
    }
  });

  filteredHistPlayers.sort((a, b) => {
    if (!histSortConfig) return 0;
    const aVal = a[histSortConfig.key];
    const bVal = b[histSortConfig.key];
    if (aVal < bVal) return histSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return histSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleRequestReview = async (jugador: Jugador, requestDate: string = date) => {
    if (pendingRequests.has(jugador.id)) {
      showAlert('Solicitud en proceso', 'Ya has enviado una solicitud pendiente para este día.', 'info');
      return;
    }
    const isConfirmed = await showConfirm(
      'Reclamar Asistencia', 
      `¿Deseas enviar un reclamo al administrador para que revise tu situación del día ${requestDate}?`, 
      'Sí, enviar reclamo'
    );
    if (isConfirmed) {
      try {
        await addDoc(collection(db, 'solicitudes_torneo'), {
          jugadorId: jugador.id,
          nombre: jugador.nombre,
          ligaId: ligaId,
          fecha: requestDate,
          status: 'pendiente',
          tipo: 'revision_asistencia',
          createdAt: serverTimestamp()
        });
        showAlert('¡Reclamo enviado!', 'El administrador revisará tu caso en su panel.', 'success');
      } catch (error) {
        console.error(error);
        showAlert('Error', 'Hubo un error al enviar el reclamo.', 'error');
      }
    }
  };

  let tournamentPlayers = jugadores.filter(p => acceptedIds.includes(p.id));

  tournamentPlayers = tournamentPlayers.filter(p => {
    const term = partSearchTerm.toLowerCase();
    if (!term) return true;
    switch (partSearchColumn) {
      case 'nombre': return p.nombre.toLowerCase().includes(term);
      case 'grl': return p.grl.toString().includes(term);
      case 'uid_jugador': return p.uid_jugador.toLowerCase().includes(term);
      default: return p.nombre.toLowerCase().includes(term) || p.uid_jugador.toLowerCase().includes(term) || p.grl.toString().includes(term);
    }
  });

  tournamentPlayers.sort((a, b) => {
    if (!partSortConfig) return 0;
    if (partSortConfig.key === 'estado') {
      const valA = asistencia[a.id] || 'no_jugo';
      const valB = asistencia[b.id] || 'no_jugo';
      const rank: Record<string, number> = { 'cumplio': 3, 'no_cumplio': 2, 'no_jugo': 1, 'ausente': 1 };
      const rankA = rank[valA] || 1;
      const rankB = rank[valB] || 1;
      if (rankA !== rankB) return partSortConfig.direction === 'asc' ? rankA - rankB : rankB - rankA;
      return 0;
    }
    const aVal = a[partSortConfig.key];
    const bVal = b[partSortConfig.key];
    if (aVal < bVal) return partSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return partSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">Cargando datos...</div>;
  }

  if (!liga) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Liga no encontrada</h1>
        <p className="text-slate-400">Verifica que el enlace sea correcto.</p>
        <Link to="/login" className="mt-8 text-blue-400 hover:underline">Ir al Login</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 text-center flex flex-col items-center">
          <div className="inline-flex p-3 rounded-2xl bg-slate-800/50 mb-4 shadow-lg border border-slate-700/50">
            {liga.logoUrl ? (
              <img src={liga.logoUrl} alt={liga.nombre} className="w-auto h-28 object-contain rounded-xl drop-shadow-xl" />
            ) : (
              <span className={`w-8 h-8 rounded-full ${liga.bgClass || 'bg-blue-500'}`}></span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Torneo Diario: <span className={liga.colorClass || 'text-white'}>{liga.nombre}</span>
          </h1>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 shadow-inner">
            <span className="text-slate-400 font-medium">Portal Público de Participantes</span>
            <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Fecha del Torneo:</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-blue-500 text-sm font-mono shadow-sm cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-6 flex">
             <Link to="/torneo-diario" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800/80 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-600 hover:border-slate-500 shadow-lg transition-all active:scale-95 w-full sm:w-auto">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
               Volver al lobby de ligas
             </Link>
          </div>
        </header>

        <div className="flex justify-center mb-10 overflow-x-auto pb-2">
          <div className="inline-flex bg-slate-900 rounded-xl p-1.5 border border-slate-800 shadow-inner whitespace-nowrap">
            <button
              onClick={() => setActiveTab('torneo')}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'torneo' ? 'bg-slate-800 text-blue-400 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Inscripción y Participantes
            </button>
            <button
              onClick={() => setActiveTab('historial_general')}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'historial_general' ? 'bg-slate-800 text-blue-400 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Historial General
            </button>
            <button
              onClick={() => setActiveTab('rendimiento')}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'rendimiento' ? 'bg-slate-800 text-blue-400 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Rendimiento por Jugador
            </button>
            <button
              onClick={() => setActiveTab('actividad')}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'actividad' ? 'bg-slate-800 text-blue-400 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Control de Actividad
            </button>
          </div>
        </div>

        {activeTab === 'torneo' && (
          <div className="flex flex-col gap-8 animate-fade-in">
          
          {/* COLUMNA IZQUIERDA: Búsqueda e Inscripción */}
          <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">Busca tu usuario</h2>
              <p className="text-slate-400 mb-6">Encuéntrate en la lista y solicita tu participación en el torneo de hoy.</p>
              
              <div className="flex flex-col md:flex-row gap-4">
                <select 
                  value={searchColumn}
                  onChange={(e) => setSearchColumn(e.target.value)}
                  className="px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                >
                  <option value="all">Todas las columnas</option>
                  <option value="nombre">Nombre</option>
                  <option value="grl">GRL</option>
                  <option value="uid_jugador">UID Usuario</option>
                </select>
                <input 
                  type="text" 
                  placeholder="Busca por tu Nombre o UID..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-lg"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-inner bg-slate-900/50">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                  <tr>
                    <th 
                      className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                      onClick={() => handleSort('nombre')}
                    >
                      <div className="flex items-center gap-2">
                        Usuario
                        {sortConfig?.key === 'nombre' && (
                          <span className="text-blue-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                      onClick={() => handleSort('grl')}
                    >
                      <div className="flex items-center gap-2">
                        GRL
                        {sortConfig?.key === 'grl' && (
                          <span className="text-blue-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                      onClick={() => handleSort('uid_jugador')}
                    >
                      <div className="flex items-center gap-2">
                        UID
                        {sortConfig?.key === 'uid_jugador' && (
                          <span className="text-blue-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 font-semibold text-sm text-right cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                      onClick={() => handleSort('inscripcion')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Inscripción
                        {sortConfig?.key === 'inscripcion' && (
                          <span className="text-blue-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sortedFilteredPlayers.map(p => {
                    const isPending = pendingRequests.has(p.id);
                    const isAccepted = acceptedIds.includes(p.id);

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 text-white font-medium text-base">{p.nombre}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-300 font-bold">{p.grl}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500">{p.uid_jugador}</td>
                        <td className="px-6 py-4 text-right">
                          {isAccepted ? (
                            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-sm shadow-sm">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Inscrito
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold text-sm shadow-sm">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Pendiente
                            </span>
                          ) : date !== todayStr ? (
                            <span className="text-slate-500 text-sm italic">Sin inscripción</span>
                          ) : (
                            <button 
                              onClick={() => handleRequestParticipation(p)}
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                              Solicitar Participación
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPlayers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        No se encontraron usuarios.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* COLUMNA DERECHA: Participantes Aceptados */}
          <div className="flex flex-col bg-[#1e293b] rounded-3xl border border-slate-700 overflow-hidden shadow-2xl max-h-[800px]">
            <div className={`p-6 border-b border-slate-700 flex flex-col items-center text-center transition-colors ${tournamentPlayers.length === 32 ? 'bg-amber-500/10' : 'bg-slate-800/80'}`}>
              <h3 className={`text-xl font-bold mb-2 ${tournamentPlayers.length === 32 ? 'text-amber-400' : 'text-white'}`}>Participantes del Torneo</h3>
              <div className="flex items-center justify-center gap-3 w-full">
                {tournamentPlayers.length === 32 && (
                  <span className="text-xs font-bold text-amber-400 uppercase animate-pulse tracking-wider">Lleno</span>
                )}
                <div className={`px-4 py-1.5 rounded-lg font-bold shadow-sm transition-colors ${tournamentPlayers.length === 32 ? 'bg-amber-500 text-slate-900' : 'bg-blue-500/20 text-blue-400'}`}>
                  {tournamentPlayers.length} / 32
                </div>
              </div>
            </div>

            {date === todayStr && (
              <div className="p-4 bg-slate-800/60 border-b border-slate-700/50">
                <label className="block text-sm font-semibold text-slate-300 mb-3">Requisito para cumplir el torneo:</label>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Tienen que hacer</span>
                  <span className="min-w-[4rem] px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-center text-white font-bold shadow-inner inline-block">
                    {requisitoGoles || '?'}
                  </span>
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">goles en los 3 intentos</span>
                </div>
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-left">
                  <p className="text-xs text-blue-300 font-medium leading-relaxed">
                    Recuerda jugar tus turnos con tu espejo: ejemplo<br/>
                    1 con 1 | 2 con 2 | 3 con 3<br/>
                    para así garantizar que todos puedan tener las mejores oportunidades.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-emerald-400"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div> Cumplió</span>
                  <span className="flex items-center gap-1.5 text-amber-400"><div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div> Jugó, No Cumplió</span>
                  <span className="flex items-center gap-1.5 text-red-400"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> No Jugó</span>
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-800/40 border-b border-slate-700/50">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <select 
                    value={partSearchColumn}
                    onChange={(e) => setPartSearchColumn(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  >
                    <option value="all">Todas las columnas</option>
                    <option value="nombre">Nombre</option>
                    <option value="grl">GRL</option>
                    <option value="uid_jugador">UID Usuario</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Buscar participante..." 
                    value={partSearchTerm}
                    onChange={(e) => setPartSearchTerm(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/60 border-b border-slate-700/50 p-3 flex flex-wrap justify-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-400"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div> Cumplió</span>
              <span className="flex items-center gap-1.5 text-amber-400"><div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div> Jugó, No Cumplió</span>
              <span className="flex items-center gap-1.5 text-red-400"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> No Jugó</span>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-900/30">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-sm w-16 text-center">#</th>
                    <th 
                      className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                      onClick={() => handlePartSort('nombre')}
                    >
                      <div className="flex items-center gap-2">
                        Usuario
                        {partSortConfig?.key === 'nombre' && (
                          <span className="text-blue-400">{partSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                      onClick={() => handlePartSort('grl')}
                    >
                      <div className="flex items-center gap-2">
                        GRL
                        {partSortConfig?.key === 'grl' && (
                          <span className="text-blue-400">{partSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                      onClick={() => handlePartSort('uid_jugador')}
                    >
                      <div className="flex items-center gap-2">
                        UID
                        {partSortConfig?.key === 'uid_jugador' && (
                          <span className="text-blue-400">{partSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                      onClick={() => handlePartSort('estado')}
                    >
                      <div className="flex items-center gap-2">
                        Estado
                        {partSortConfig?.key === 'estado' && (
                          <span className="text-blue-400">{partSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 font-semibold text-sm text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {tournamentPlayers.map((p, index) => {
                    const attended = asistencia[p.id];
                    const hasAttendanceRecord = date !== todayStr || attended !== undefined;
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-400 font-mono text-xs font-bold shadow-inner border border-slate-700">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white font-medium text-base">{p.nombre}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-300 font-bold">{p.grl}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500">{p.uid_jugador}</td>
                        <td className="px-6 py-4">
                          {hasAttendanceRecord ? (
                            attended === 'cumplio' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                Cumplió
                              </span>
                            ) : attended === 'no_cumplio' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                No Cumplió
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                No Jugó / Ausente
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500 italic text-sm">Pendiente</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {hasAttendanceRecord && (
                            <button 
                              onClick={() => handleRequestReview(p)} 
                              className="px-3 py-1.5 text-xs font-bold bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors shadow-sm"
                              title="Solicitar revisión de asistencia"
                            >
                              Reclamar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {tournamentPlayers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <p className="font-medium text-slate-400">Sin participantes</p>
                        <p className="text-sm mt-2">Nadie ha sido ingresado al torneo todavía.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
          )}

          {/* HISTORIAL GENERAL (Público) */}
          {activeTab === 'historial_general' && (
          <div className="flex flex-col bg-[#1e293b]/50 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-slate-700/50 bg-slate-800/30">
              <h3 className="font-bold text-slate-200 text-2xl">Historial de Torneos</h3>
              <p className="text-slate-400 text-sm mt-1">Resumen de los últimos 14 torneos registrados</p>
            </div>
            
            <div className="p-6 border-b border-slate-700/50 flex flex-col sm:flex-row gap-4">
              <select 
                value={histGenSearchColumn}
                onChange={(e) => setHistGenSearchColumn(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="all">Todas las columnas</option>
                <option value="nombre">Nombre</option>
                <option value="grl">GRL</option>
                <option value="uid_jugador">UID Usuario</option>
              </select>
              <input 
                type="text" 
                placeholder="Buscar participante en el historial..." 
                value={histGenSearchTerm}
                onChange={(e) => setHistGenSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
            
            <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
              {history.map((torneo) => {
                const totalInscritos = torneo.jugadores?.length || 0;
                let jugaron = 0;
                torneo.jugadores?.forEach((id: string) => {
                  const val = torneo.asistencia?.[id];
                  if (val === true || val === 'cumplio' || val === 'no_cumplio') jugaron++;
                });

                let tPlayers = (torneo.jugadores || []).map((id: string) => jugadores.find(x => x.id === id)).filter(Boolean) as Jugador[];
                
                tPlayers = tPlayers.filter(p => {
                  const term = histGenSearchTerm.toLowerCase();
                  if (!term) return true;
                  switch (histGenSearchColumn) {
                    case 'nombre': return p.nombre.toLowerCase().includes(term);
                    case 'grl': return p.grl.toString().includes(term);
                    case 'uid_jugador': return p.uid_jugador.toLowerCase().includes(term);
                    default: return p.nombre.toLowerCase().includes(term) || p.uid_jugador.toLowerCase().includes(term) || p.grl.toString().includes(term);
                  }
                });

                tPlayers.sort((a, b) => {
                  if (!histGenSortConfig) return 0;
                  if (histGenSortConfig.key === 'estado') {
                    const valA = torneo.asistencia?.[a.id] || 'no_jugo';
                    const valB = torneo.asistencia?.[b.id] || 'no_jugo';
                    const rank: Record<string, number> = { 'cumplio': 3, 'no_cumplio': 2, 'no_jugo': 1, 'ausente': 1 };
                    const rankA = rank[valA === true ? 'cumplio' : valA === false ? 'no_jugo' : valA] || 1;
                    const rankB = rank[valB === true ? 'cumplio' : valB === false ? 'no_jugo' : valB] || 1;
                    if (rankA !== rankB) return histGenSortConfig.direction === 'asc' ? rankA - rankB : rankB - rankA;
                    return 0;
                  }
                  const aVal = a[histGenSortConfig.key];
                  const bVal = b[histGenSortConfig.key];
                  if (aVal < bVal) return histGenSortConfig.direction === 'asc' ? -1 : 1;
                  if (aVal > bVal) return histGenSortConfig.direction === 'asc' ? 1 : -1;
                  return 0;
                });

                const isExpanded = expandedTorneos.includes(torneo.fecha);

                return (
                  <div key={torneo.fecha} className="bg-[#1e293b] rounded-3xl border border-slate-700 overflow-hidden shadow-2xl transition-all">
                    <div 
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-slate-700 bg-slate-800/80 gap-3 cursor-pointer hover:bg-slate-700/80 transition-colors select-none"
                      onClick={() => toggleTorneo(torneo.fecha)}
                    >
                      <div>
                        <h4 className="font-bold text-white text-lg flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Torneo del {torneo.fecha}
                        </h4>
                        <p className="text-sm text-slate-400 mt-1">
                          <span className="font-semibold text-emerald-400">{jugaron}</span> jugaron de <span className="font-semibold text-blue-400">{totalInscritos}</span> inscritos.
                        </p>
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="overflow-x-auto bg-slate-900/30 animate-fade-in">
                        <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                          <tr>
                            <th className="px-6 py-4 font-semibold text-sm w-16 text-center">#</th>
                            <th 
                              className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                              onClick={() => handleHistGenSort('nombre')}
                            >
                              <div className="flex items-center gap-2">
                                Usuario
                                {histGenSortConfig?.key === 'nombre' && (
                                  <span className="text-blue-400">{histGenSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                              onClick={() => handleHistGenSort('grl')}
                            >
                              <div className="flex items-center gap-2">
                                GRL
                                {histGenSortConfig?.key === 'grl' && (
                                  <span className="text-blue-400">{histGenSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                              onClick={() => handleHistGenSort('uid_jugador')}
                            >
                              <div className="flex items-center gap-2">
                                UID
                                {histGenSortConfig?.key === 'uid_jugador' && (
                                  <span className="text-blue-400">{histGenSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th 
                              className="px-6 py-4 font-semibold text-sm cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                              onClick={() => handleHistGenSort('estado')}
                            >
                              <div className="flex items-center gap-2">
                                Estado
                                {histGenSortConfig?.key === 'estado' && (
                                  <span className="text-blue-400">{histGenSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th className="px-6 py-4 font-semibold text-sm text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {tPlayers.map((p, index) => {
                            const rawEstado = torneo.asistencia?.[p.id];
                            const normalized = rawEstado === true ? 'cumplio' : rawEstado === false ? 'no_jugo' : (rawEstado || 'no_jugo');

                            return (
                              <tr key={p.id} className="hover:bg-slate-800/40 transition-colors group">
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-400 font-mono text-xs font-bold shadow-inner border border-slate-700">
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-white font-medium text-base">{p.nombre}</td>
                                <td className="px-6 py-4">
                                  <span className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-300 font-bold">{p.grl}</span>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-500">{p.uid_jugador}</td>
                                <td className="px-6 py-4">
                                  {normalized === 'cumplio' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                      Cumplió
                                    </span>
                                  ) : normalized === 'no_cumplio' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                      No Cumplió
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                      No Jugó / Ausente
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => handleRequestReview(p, torneo.fecha)} 
                                    className="px-3 py-1.5 text-xs font-bold bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors shadow-sm"
                                    title="Solicitar revisión de asistencia"
                                  >
                                    Reclamar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          
                          {tPlayers.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                <svg className="w-8 h-8 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <p className="text-sm">No hay participantes que coincidan con la búsqueda.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                );
              })}
              
              {history.length === 0 && (
                <div className="text-center p-8 text-slate-500">
                  <p>Aún no hay torneos registrados en el historial.</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* HISTORIAL INDIVIDUAL (Público) */}
          {activeTab === 'rendimiento' && (
          <div className="flex flex-col bg-[#1e293b]/50 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-slate-700/50 bg-slate-800/30">
              <h3 className="font-bold text-slate-200 text-2xl">Rendimiento por Jugador</h3>
              <p className="text-slate-400 text-sm mt-1">Revisa tu participación en torneos anteriores</p>
            </div>
            
            <div className="p-6 border-b border-slate-700/50 flex flex-col sm:flex-row gap-4">
              <select 
                value={histSearchColumn}
                onChange={(e) => setHistSearchColumn(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="all">Todas las columnas</option>
                <option value="uid_jugador">UID</option>
                <option value="nombre">Nombre</option>
                <option value="grl">GRL</option>
              </select>
              <input 
                type="text" 
                placeholder="Busca tu usuario..." 
                value={histSearchTerm}
                onChange={(e) => setHistSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
            
            <div className="bg-slate-800/40 p-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 border-b border-slate-700/50">
              <span className="mr-2">Ordenar lista por:</span>
              {(['nombre', 'grl', 'uid_jugador'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => handleHistSort(key)}
                  className={`px-3 py-1.5 rounded-md border transition-colors ${histSortConfig?.key === key ? 'bg-slate-700/80 border-slate-500 text-white' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}
                >
                  {key === 'nombre' ? 'Usuario' : key === 'grl' ? 'GRL' : 'UID'}
                  {histSortConfig?.key === key && (
                    <span className="ml-1.5 text-blue-400">{histSortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row min-h-[350px]">
              <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-700/50 h-[500px] overflow-y-auto p-4 space-y-2 bg-slate-900/30">
                {filteredHistPlayers.map((p, index) => (
                   <button 
                     key={p.id}
                     onClick={() => setSelectedPlayerHist(p.id)} 
                     className={`w-full flex justify-between items-center text-left p-3 rounded-xl border transition-all ${selectedPlayerHist === p.id ? 'bg-blue-500/20 border-blue-500/50 shadow-md shadow-blue-500/10' : 'border-transparent hover:bg-slate-800 hover:border-slate-700/50'}`}
                   >
                     <div className="flex items-center gap-3">
                       <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shadow-inner border ${selectedPlayerHist === p.id ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>
                         {index + 1}
                       </span>
                       <div>
                         <p className={`font-semibold text-sm ${selectedPlayerHist === p.id ? 'text-white' : 'text-slate-300'}`}>{p.nombre}</p>
                         <p className="text-slate-500 text-[10px] font-mono mt-0.5">UID: {p.uid_jugador} | GRL: {p.grl}</p>
                       </div>
                     </div>
                   </button>
                ))}
                {filteredHistPlayers.length === 0 && (
                  <p className="text-slate-500 text-sm text-center p-4">No se encontraron jugadores.</p>
                )}
              </div>
              
              <div className="w-full md:w-2/3 p-6 bg-[#1e293b]">
                {selectedPlayerHist ? (() => {
                  const p = jugadores.find(x => x.id === selectedPlayerHist);
                  const playerHistory = history.filter(t => t.jugadores?.includes(p?.id));

                  return (
                    <div className="animate-fade-in h-full flex flex-col">
                      <div className="mb-6 pb-6 border-b border-slate-700/70">
                        <h4 className="text-3xl font-extrabold text-white flex items-center gap-3">
                          <span className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </span>
                          {p?.nombre}
                        </h4>
                        <div className="flex gap-4 mt-4 ml-15">
                          <span className="text-sm font-mono bg-slate-800 text-slate-300 px-4 py-1.5 rounded-lg border border-slate-700 shadow-sm">UID: <span className="text-white">{p?.uid_jugador}</span></span>
                          <span className="text-sm font-bold bg-amber-500/10 text-amber-500 px-4 py-1.5 rounded-lg border border-amber-500/20 shadow-sm">GRL {p?.grl}</span>
                        </div>
                      </div>
                      
                      <h5 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Historial de Partidos (Últimos 14)
                      </h5>
                      
                      {playerHistory.length > 0 ? (
                        <div className="flex-1 overflow-x-auto bg-slate-900/50 rounded-2xl border border-slate-700/50">
                          <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700 sticky top-0">
                              <tr>
                                <th className="px-5 py-3 font-semibold text-sm">Torneo</th>
                                <th className="px-5 py-3 font-semibold text-sm">Requisito</th>
                                <th className="px-5 py-3 font-semibold text-sm">Estado</th>
                                <th className="px-5 py-3 font-semibold text-sm text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                              {playerHistory.map(t => {
                                const val = t.asistencia?.[p!.id];
                                const normalized = val === true ? 'cumplio' : val === false ? 'no_jugo' : (val || 'no_jugo');

                                return (
                                  <tr key={t.fecha} className="hover:bg-slate-800/40 transition-colors group">
                                    <td className="px-5 py-4 font-medium text-slate-300 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        {t.fecha}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4">
                                      {t.requisitoGoles ? (
                                        <span className="text-xs text-slate-400 italic">
                                          {/^\d+$/.test(t.requisitoGoles.trim()) ? `Hacer ${t.requisitoGoles.trim()} goles (3 int.)` : t.requisitoGoles}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-600">-</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                      {normalized === 'cumplio' ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                          Cumplió
                                        </span>
                                      ) : normalized === 'no_cumplio' ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                          No Cumplió
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                          No Jugó
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                      <button 
                                        onClick={() => handleRequestReview(p, t.fecha)} 
                                        className="px-3 py-1.5 text-xs font-bold bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors shadow-sm"
                                        title="Solicitar revisión de asistencia"
                                      >
                                        Reclamar
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-10 flex flex-col items-center justify-center border border-dashed border-slate-700/70 rounded-2xl bg-slate-900/30">
                          <svg className="w-12 h-12 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <p className="text-slate-400 font-medium">No hay registros de participación</p>
                          <p className="text-slate-500 text-sm mt-1">Este usuario no ha sido registrado en los últimos torneos.</p>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center h-[500px] text-slate-500 p-8 rounded-2xl bg-slate-900/20 border border-dashed border-slate-700/50">
                    <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                    <p className="text-center font-medium text-lg text-slate-400">Selecciona tu usuario de la lista</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
      
      {activeTab === 'actividad' && (
          <div className="animate-fade-in">
            <PublicWeeklyActivity 
              ligaId={liga.id} 
              ligaNombre={liga.nombre} 
              metaSemanal={liga.metaSemanal} 
              players={jugadores} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
