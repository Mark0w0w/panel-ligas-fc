import { useState, useEffect } from 'react';
import { collection, doc, getDocs, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';
import { showAlert, showConfirm, showAttendanceResolution } from '../utils/alerts';
import type { Jugador, TournamentRequest } from '../types';

export interface DailyTournamentManagerProps {
  ligaId: string;
  ligaNombre: string;
  colorClass: string;
  bgClass: string;
  players: Jugador[];
}

export default function DailyTournamentManager({ ligaId, ligaNombre, colorClass, bgClass, players }: DailyTournamentManagerProps) {
  const { user, role } = useAuth();
  
  const getTodayStr = () => {
    const d = new Date();
    // YYYY-MM-DD local
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [date, setDate] = useState(getTodayStr());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');
  const [sortField, setSortField] = useState<'nombre' | 'grl' | 'uid'>('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [asistencia, setAsistencia] = useState<Record<string, string>>({});
  const [requisitoGoles, setRequisitoGoles] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  
  // Estados para búsqueda en el Historial Individual
  const [histSearchTerm, setHistSearchTerm] = useState('');
  const [histSearchColumn, setHistSearchColumn] = useState<string>('all');
  const [selectedPlayerHist, setSelectedPlayerHist] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'formacion' | 'solicitudes'>('formacion');
  const [solicitudes, setSolicitudes] = useState<TournamentRequest[]>([]);

  useEffect(() => {
    const loadTournament = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'torneos_diarios'), where('liga', '==', ligaId), where('fecha', '==', date));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setSelectedIds(data.jugadores || []);
          
          const loadedAsistencia = data.asistencia || {};
          const normalizedAsistencia: Record<string, string> = {};
          for (const key in loadedAsistencia) {
            if (loadedAsistencia[key] === true) normalizedAsistencia[key] = 'cumplio';
            else if (loadedAsistencia[key] === false) normalizedAsistencia[key] = 'no_jugo';
            else normalizedAsistencia[key] = loadedAsistencia[key];
          }
          setAsistencia(normalizedAsistencia);
          setRequisitoGoles(data.requisitoGoles || '');
        } else {
          setSelectedIds([]);
          setAsistencia({});
          setRequisitoGoles('');
        }
      } catch (error) {
        console.error("Error loading tournament:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTournament();

    const qSol = query(
      collection(db, 'solicitudes_torneo'), 
      where('ligaId', '==', ligaId),
      where('status', '==', 'pendiente')
    );
    
    const unsubSol = onSnapshot(qSol, (snapshot) => {
      const data: TournamentRequest[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as TournamentRequest));
      setSolicitudes(data);
    });

    // Cargar historial de los últimos torneos (sin límite compuesto para no requerir índices en Firebase)
    const qHist = query(collection(db, 'torneos_diarios'), where('liga', '==', ligaId));
    const unsubHist = onSnapshot(qHist, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push(doc.data()));
      // Ordenar por fecha descendente
      data.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setHistory(data.slice(0, 14)); // Solo los últimos 14
    });

    return () => {
      unsubSol();
      unsubHist();
    };
  }, [ligaId, date]);

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
    } else {
      if (selectedPlayers.length >= 32) {
        showAlert('Torneo lleno', 'Se ha alcanzado el límite de 32 participantes.', 'warning');
        return;
      }
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const docId = `${ligaId}_${date}`;
      await setDoc(doc(db, 'torneos_diarios', docId), {
        liga: ligaId,
        fecha: date,
        jugadores: selectedIds.filter(id => players.some(p => p.id === id)),
        asistencia: asistencia,
        requisitoGoles: requisitoGoles,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email
      });

      await logAction(user?.email, role, 'CREAR', 'Liga', `Actualizó la formación del Torneo Diario (${date}) para ${ligaNombre} con ${selectedPlayers.length} jugadores`);
      showAlert('¡Éxito!', `¡Torneo guardado exitosamente para la fecha ${date}!`, 'success');
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Error al guardar el torneo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (req: TournamentRequest) => {
    if (req.tipo === 'revision_asistencia') {
      const selectedStatus = await showAttendanceResolution(req.nombre, req.fecha);
      if (selectedStatus) {
        try {
          const docId = `${ligaId}_${req.fecha}`;
          await setDoc(doc(db, 'torneos_diarios', docId), {
            asistencia: {
              [req.jugadorId]: selectedStatus
            }
          }, { merge: true });
          await updateDoc(doc(db, 'solicitudes_torneo', req.id), { status: 'aprobada' });
          if (req.fecha === date) {
            setAsistencia(prev => ({ ...prev, [req.jugadorId]: selectedStatus }));
          }
          showAlert('Corregido', 'La asistencia ha sido corregida exitosamente.', 'success');
        } catch (error) {
          console.error(error);
          showAlert('Error', 'Error al corregir asistencia.', 'error');
        }
      }
      return;
    }

    if (req.fecha !== date) {
      showAlert('Fecha incorrecta', `Esta inscripción es para el ${req.fecha}. Por favor cambia la fecha de tu panel para aprobarla.`, 'warning');
      return;
    }

    if (selectedPlayers.length >= 32) {
      showAlert('Límite alcanzado', 'El torneo ya alcanzó el límite de 32 participantes. Debes eliminar a alguien antes de aceptar a este usuario.', 'warning');
      return;
    }
    if (selectedIds.includes(req.jugadorId)) {
      showAlert('Ya existe', 'El jugador ya está en el torneo.', 'info');
      await updateDoc(doc(db, 'solicitudes_torneo', req.id), { status: 'aprobada' });
      return;
    }

    const isConfirmed = await showConfirm('Aprobar ingreso', `¿Aprobar e ingresar a ${req.nombre} al torneo del ${date}?`, 'Sí, aprobar');
    if (isConfirmed) {
      try {
        const newSelected = [...selectedIds, req.jugadorId];
        setSelectedIds(newSelected);
        
        const docId = `${ligaId}_${date}`;
        await setDoc(doc(db, 'torneos_diarios', docId), {
          liga: ligaId,
          fecha: date,
          jugadores: newSelected,
          asistencia: asistencia,
          requisitoGoles: requisitoGoles,
          updatedAt: serverTimestamp(),
          updatedBy: user?.email
        });

        await updateDoc(doc(db, 'solicitudes_torneo', req.id), { status: 'aprobada' });
      } catch (error) {
        console.error(error);
        showAlert('Error', 'Error al aprobar la solicitud.', 'error');
      }
    }
  };

  const handleReject = async (req: TournamentRequest) => {
    const isConfirmed = await showConfirm('Rechazar ingreso', `¿Estás seguro de rechazar la participación de ${req.nombre}?`, 'Sí, rechazar', true);
    if (isConfirmed) {
      try {
        await updateDoc(doc(db, 'solicitudes_torneo', req.id), { status: 'rechazada' });
      } catch (error) {
        console.error(error);
        showAlert('Error', 'Error al rechazar la solicitud.', 'error');
      }
    }
  };

  const handleDeleteTournament = async (fecha: string) => {
    const isConfirmed = await showConfirm(
      'Eliminar Torneo',
      `¿Estás seguro de que deseas eliminar permanentemente el torneo del ${fecha}? Esto desaparecerá del historial para todos los usuarios.`,
      'Sí, eliminar',
      true
    );

    if (isConfirmed) {
      try {
        const docId = `${ligaId}_${fecha}`;
        await deleteDoc(doc(db, 'torneos_diarios', docId));
        await logAction(user?.email, role, 'ELIMINAR', 'Torneo', `Eliminó el torneo del ${fecha} de la liga ${ligaId}`);
        showAlert('Eliminado', 'El torneo ha sido eliminado del historial.', 'success');
        
        if (date === fecha) {
            setSelectedIds([]);
            setAsistencia({});
            setRequisitoGoles('');
        }
      } catch (error) {
        console.error("Error al eliminar torneo:", error);
        showAlert('Error', 'Hubo un error al eliminar el torneo.', 'error');
      }
    }
  };

  const handleSort = (field: 'nombre' | 'grl' | 'uid') => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const toggleAsistencia = (id: string) => {
    setAsistencia(prev => {
      const current = prev[id] || 'no_jugo';
      if (current === 'no_jugo') return { ...prev, [id]: 'cumplio' };
      if (current === 'cumplio') return { ...prev, [id]: 'no_cumplio' };
      return { ...prev, [id]: 'no_jugo' };
    });
  };

  const unselectedPlayers = players.filter(p => !selectedIds.includes(p.id));
  const selectedPlayers = players.filter(p => selectedIds.includes(p.id));

  const filteredUnselected = unselectedPlayers
    .filter(p => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      switch (searchColumn) {
        case 'nombre': return p.nombre.toLowerCase().includes(term);
        case 'grl': return p.grl.toString().includes(term);
        case 'uid_jugador': return p.uid_jugador.toLowerCase().includes(term);
        default: return p.nombre.toLowerCase().includes(term) || p.uid_jugador.toLowerCase().includes(term) || p.grl.toString().includes(term);
      }
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'nombre') comparison = a.nombre.localeCompare(b.nombre);
      else if (sortField === 'grl') comparison = a.grl - b.grl;
      else if (sortField === 'uid') comparison = a.uid_jugador.localeCompare(b.uid_jugador);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const filteredHistPlayers = players.filter(p => {
    const term = histSearchTerm.toLowerCase();
    if (!term) return true;
    switch (histSearchColumn) {
      case 'nombre': return p.nombre.toLowerCase().includes(term);
      case 'grl': return p.grl.toString().includes(term);
      case 'uid_jugador': return p.uid_jugador.toLowerCase().includes(term);
      default: return p.nombre.toLowerCase().includes(term) || p.uid_jugador.toLowerCase().includes(term) || p.grl.toString().includes(term);
    }
  });

  return (
    <section className="bg-[#1e293b]/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm flex flex-col min-h-[600px]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className={`text-2xl font-semibold flex items-center gap-3 ${colorClass}`}>
            <span className={`w-2 h-8 rounded-full ${bgClass}`}></span>
            Torneo Diario - {ligaNombre}
          </h2>
          <p className="text-slate-400 text-sm mt-1">Configura el torneo o revisa las solicitudes del portal público.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-700">
          <label className="text-sm text-slate-400 font-medium">Fecha:</label>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
        <button 
          onClick={() => setActiveTab('formacion')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'formacion' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Formación y Roster
        </button>
        <button 
          onClick={() => setActiveTab('solicitudes')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'solicitudes' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Solicitudes Pendientes
          {solicitudes.length > 0 && (
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{solicitudes.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'formacion' && (
        <div className="flex flex-col gap-8 flex-1 animate-fade-in">
          {/* PANEL A: Roster */}
          <div className="flex flex-col bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden shadow-inner">
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center">
              <h3 className="font-bold text-slate-300">Integrantes de la liga ({players.length})</h3>
              <span className="text-xs bg-slate-700 px-2 py-1 rounded-md text-slate-300">{unselectedPlayers.length} Disponibles</span>
            </div>
            
            <div className="p-3 border-b border-slate-700/50 flex flex-col xl:flex-row gap-2">
              <select 
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todas</option>
                <option value="uid_jugador">UID</option>
                <option value="nombre">Nombre</option>
                <option value="grl">GRL</option>
              </select>
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[400px]">
              <table className="w-full text-left text-sm text-slate-400 min-w-[350px]">
                <thead className="bg-slate-800/80 text-slate-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 cursor-pointer hover:bg-slate-700" onClick={() => handleSort('uid')}>UID {sortField === 'uid' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
                    <th className="px-3 py-2 cursor-pointer hover:bg-slate-700" onClick={() => handleSort('nombre')}>Nombre {sortField === 'nombre' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
                    <th className="px-3 py-2 cursor-pointer hover:bg-slate-700 text-center" onClick={() => handleSort('grl')}>GRL {sortField === 'grl' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
                    <th className="px-3 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredUnselected.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-3 py-2 font-mono text-xs">{p.uid_jugador}</td>
                      <td className="px-3 py-2 text-white font-medium">{p.nombre}</td>
                      <td className="px-3 py-2 text-center font-bold">{p.grl}</td>
                      <td className="px-3 py-2 text-right">
                        <button 
                          onClick={() => handleToggle(p.id)}
                          className="w-7 h-7 inline-flex items-center justify-center rounded bg-slate-700 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Añadir al Torneo"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUnselected.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 text-sm">No se encontraron jugadores disponibles.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PANEL B: Torneo Diario */}
          <div className="flex flex-col bg-[#1e293b] rounded-xl border-2 border-slate-700 overflow-hidden shadow-xl">
            <div className={`p-4 border-b border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-colors ${selectedPlayers.length === 32 ? 'bg-amber-500/10' : 'bg-slate-800/80'}`}>
              <div>
                <h3 className={`font-bold ${selectedPlayers.length === 32 ? 'text-amber-400' : 'text-white'}`}>Participantes del Torneo ({selectedPlayers.length})</h3>
                <p className="text-sm text-blue-400 font-medium">Torneo del día: {date}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedPlayers.length === 32 && (
                  <span className="text-xs font-bold text-amber-400 uppercase animate-pulse">Torneo Lleno</span>
                )}
                <span className={`text-xs px-2 py-1 rounded-md font-bold transition-colors ${selectedPlayers.length === 32 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {selectedPlayers.length} / 32
                </span>
              </div>
            </div>

            <div className="p-4 border-b border-slate-700/50 bg-slate-800/40">
              <label className="block text-sm font-semibold text-slate-300 mb-3">Requisito para cumplir el torneo:</label>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Tienen que hacer</span>
                <input 
                  type="text"
                  value={requisitoGoles}
                  onChange={(e) => setRequisitoGoles(e.target.value)}
                  placeholder="X"
                  className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-center text-white font-bold focus:outline-none focus:border-blue-500 shadow-inner"
                />
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">goles en los 3 intentos</span>
              </div>
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-300 font-medium whitespace-pre-line leading-relaxed">
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

            <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-2">
              {selectedPlayers.map((p, index) => (
                <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/60 transition-colors gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono text-xs w-5">{index + 1}.</span>
                    <div>
                      <p className="text-white font-medium text-sm">{p.nombre}</p>
                      <p className="text-slate-500 text-xs font-mono">UID: {p.uid_jugador} | GRL: {p.grl}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => toggleAsistencia(p.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm border ${
                        asistencia[p.id] === 'cumplio' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' :
                        asistencia[p.id] === 'no_cumplio' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' :
                        'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                      }`}
                    >
                      {asistencia[p.id] === 'cumplio' ? 'Cumplió' : asistencia[p.id] === 'no_cumplio' ? 'No Cumplió' : 'No Jugó'}
                    </button>
                    <button 
                      onClick={() => handleToggle(p.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                      title="Quitar del Torneo"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))}
              {selectedPlayers.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                  <svg className="w-12 h-12 mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  <p className="text-sm">No hay jugadores seleccionados aún.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-700/50 bg-slate-900">
              <button 
                onClick={handleSave}
                disabled={loading || selectedPlayers.length === 0}
                className={`w-full py-3 rounded-xl font-bold shadow-lg transition-all ${loading || selectedPlayers.length === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-500/25 hover:-translate-y-0.5'}`}
              >
                {loading ? 'Guardando...' : `Guardar Formación del ${date}`}
              </button>
            </div>
          </div>

          {/* PANEL C: Historial de Torneos */}
          <div className="flex flex-col bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden shadow-inner mt-4">
            <div className="p-5 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-200 text-lg">Historial de Torneos</h3>
                <p className="text-slate-400 text-sm">Últimos 14 torneos registrados</p>
              </div>
              <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            
            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              {history.map((torneo) => {
                const totalInscritos = torneo.jugadores?.length || 0;
                let jugaron = 0;
                torneo.jugadores?.forEach((id: string) => {
                  const val = torneo.asistencia?.[id];
                  if (val === true || val === 'cumplio' || val === 'no_cumplio') jugaron++;
                });

                return (
                  <div key={torneo.fecha} className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/70 shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-700 pb-3 gap-3">
                      <div>
                        <h4 className="font-bold text-white text-lg flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Torneo del {torneo.fecha}
                        </h4>
                        <p className="text-sm text-slate-400 mt-1">
                          <span className="font-semibold text-emerald-400">{jugaron}</span> jugaron de <span className="font-semibold text-blue-400">{totalInscritos}</span> inscritos.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setDate(torneo.fecha);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} 
                          className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                        >
                          Ver / Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteTournament(torneo.fecha)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                          title="Eliminar Torneo"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {torneo.jugadores?.map((id: string) => {
                         const p = players.find(x => x.id === id);
                         const estado = torneo.asistencia?.[id];
                         const normalized = estado === true ? 'cumplio' : estado === false ? 'no_jugo' : (estado || 'no_jugo');

                         let colorClass = 'bg-red-500/10 text-red-400 border-red-500/20';
                         let dotClass = 'bg-red-500';
                         if (normalized === 'cumplio') { colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'; dotClass = 'bg-emerald-400'; }
                         else if (normalized === 'no_cumplio') { colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20'; dotClass = 'bg-amber-400'; }

                         return (
                           <span 
                             key={id} 
                             className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 ${colorClass}`}
                             title={normalized === 'cumplio' ? 'Cumplió' : normalized === 'no_cumplio' ? 'No Cumplió' : 'No Jugó'}
                           >
                             <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></div>
                             {p?.nombre || 'Desconocido'}
                           </span>
                         );
                      })}
                      
                      {!torneo.jugadores || torneo.jugadores.length === 0 && (
                        <span className="text-sm text-slate-500 italic">No hubo participantes este día.</span>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {history.length === 0 && (
                <div className="text-center p-8 text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p>Aún no hay torneos registrados en el historial.</p>
                </div>
              )}
            </div>
          </div>

          {/* PANEL D: Historial Individual (Búsqueda) */}
          <div className="flex flex-col bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden shadow-inner mt-4">
            <div className="p-5 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-200 text-lg">Rendimiento por Jugador</h3>
                <p className="text-slate-400 text-sm">Busca un usuario para ver en cuáles torneos participó</p>
              </div>
              <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" /></svg>
            </div>
            
            <div className="p-4 border-b border-slate-700/50 flex flex-col sm:flex-row gap-3">
              <select 
                value={histSearchColumn}
                onChange={(e) => setHistSearchColumn(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todas las columnas</option>
                <option value="uid_jugador">UID</option>
                <option value="nombre">Nombre</option>
                <option value="grl">GRL</option>
              </select>
              <input 
                type="text" 
                placeholder="Buscar jugador..." 
                value={histSearchTerm}
                onChange={(e) => setHistSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-col md:flex-row min-h-[350px]">
              {/* Lista de Usuarios */}
              <div className="w-full md:w-5/12 border-b md:border-b-0 md:border-r border-slate-700/50 max-h-[350px] overflow-y-auto p-3 space-y-1 bg-slate-800/20">
                {filteredHistPlayers.map(p => (
                   <button 
                     key={p.id}
                     onClick={() => setSelectedPlayerHist(p.id)} 
                     className={`w-full flex justify-between items-center text-left p-3 rounded-lg border transition-all ${selectedPlayerHist === p.id ? 'bg-blue-500/20 border-blue-500/50 shadow-md shadow-blue-500/10' : 'border-transparent hover:bg-slate-800 hover:border-slate-700'}`}
                   >
                     <div>
                       <p className={`font-semibold text-sm ${selectedPlayerHist === p.id ? 'text-blue-400' : 'text-white'}`}>{p.nombre}</p>
                       <p className="text-slate-500 text-xs font-mono mt-0.5">UID: {p.uid_jugador}</p>
                     </div>
                     <span className="px-2 py-1 bg-slate-900 rounded-md text-xs font-bold text-slate-300 border border-slate-700">GRL {p.grl}</span>
                   </button>
                ))}
                {filteredHistPlayers.length === 0 && (
                  <p className="text-slate-500 text-sm text-center p-4">No se encontraron jugadores.</p>
                )}
              </div>
              
              {/* Detalles del Usuario */}
              <div className="w-full md:w-7/12 p-5 bg-slate-900/30">
                {selectedPlayerHist ? (() => {
                  const p = players.find(x => x.id === selectedPlayerHist);
                  const playerHistory = history.filter(t => t.jugadores?.includes(p?.id));

                  return (
                    <div className="animate-fade-in">
                      <div className="mb-6 pb-4 border-b border-slate-700/50">
                        <h4 className="text-xl font-bold text-white flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </span>
                          {p?.nombre}
                        </h4>
                        <div className="flex gap-4 mt-3">
                          <span className="text-xs font-mono bg-slate-800 text-slate-400 px-3 py-1 rounded border border-slate-700">UID: {p?.uid_jugador}</span>
                          <span className="text-xs font-bold bg-amber-500/10 text-amber-500 px-3 py-1 rounded border border-amber-500/20">GRL {p?.grl}</span>
                        </div>
                      </div>
                      
                      <h5 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Historial de Partidos (Últimos 14)</h5>
                      
                      {playerHistory.length > 0 ? (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                          {playerHistory.map(t => {
                            const val = t.asistencia?.[p!.id];
                            const normalized = val === true ? 'cumplio' : val === false ? 'no_jugo' : (val || 'no_jugo');

                            return (
                              <div key={t.fecha} className="flex justify-between items-center p-3.5 rounded-xl bg-[#1e293b] border border-slate-700 shadow-sm hover:border-slate-600 transition-colors">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="text-slate-300 font-medium">{t.fecha}</span>
                                  </div>
                                  {t.requisitoGoles && (
                                    <span className="text-xs text-slate-500 mt-1 ml-8 italic flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
                                      {/^\d+$/.test(t.requisitoGoles.trim()) ? `Tienen que hacer ${t.requisitoGoles.trim()} goles en los 3 intentos` : t.requisitoGoles}
                                    </span>
                                  )}
                                </div>
                                
                                {normalized === 'cumplio' ? (
                                  <span className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></div> Cumplió
                                  </span>
                                ) : normalized === 'no_cumplio' ? (
                                  <span className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)]"></div> No Cumplió
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 text-xs font-bold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div> No Jugó
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 text-center border border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                          <p className="text-slate-500 text-sm">Este jugador no ha sido inscrito en ninguno de los torneos recientes.</p>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                    <p className="text-center font-medium">Selecciona un jugador de la lista<br/><span className="text-sm font-normal opacity-70">para ver su rendimiento detallado</span></p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'solicitudes' && (
        <div className="animate-fade-in bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3.5 font-medium">Jugador</th>
                <th className="px-5 py-3.5 font-medium">Fecha</th>
                <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900/20">
              {solicitudes.map(req => {
                const playerDetails = players.find(p => p.id === req.jugadorId);
                return (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium">{req.nombre}</p>
                      {playerDetails && <p className="text-xs text-slate-500 font-mono">UID: {playerDetails.uid_jugador} | GRL: {playerDetails.grl}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-slate-400 block">{req.fecha}</span>
                      {req.tipo === 'revision_asistencia' && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold rounded-md">
                          RECLAMO ASISTENCIA
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleApprove(req)} 
                          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Aceptar
                        </button>
                        <button 
                          onClick={() => handleReject(req)} 
                          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {solicitudes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    No hay solicitudes pendientes para esta fecha.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
