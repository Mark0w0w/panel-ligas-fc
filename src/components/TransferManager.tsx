import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useLigas } from '../hooks/useLigas';
import { logAction } from '../utils/logger';
import type { Jugador, TransferRequest } from '../types';

export default function TransferManager() {
  const { user, role } = useAuth();
  const { ligas } = useLigas();
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [solicitudes, setSolicitudes] = useState<TransferRequest[]>([]);
  
  const [activeTab, setActiveTab] = useState<'mercado' | 'entrantes' | 'salientes'>('mercado');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');
  const [targetLigaId, setTargetLigaId] = useState<string>('');

  useEffect(() => {
    const unsubJug = onSnapshot(collection(db, 'jugadores'), (snapshot) => {
      const data: Jugador[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Jugador));
      setJugadores(data);
    });

    const unsubTrans = onSnapshot(collection(db, 'transferencias'), (snapshot) => {
      const data: TransferRequest[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as TransferRequest));
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setSolicitudes(data);
    });

    return () => {
      unsubJug();
      unsubTrans();
    };
  }, []);

  const miLigaId = role !== 'superadmin' ? ligas.find(l => `admin_${l.id}` === role)?.id : null;

  const handleRequestTransfer = async (jugador: Jugador) => {
    let destino = targetLigaId;
    
    // Si no es superadmin, forzamos que el destino sea su propia liga
    if (role !== 'superadmin') {
      if (miLigaId) {
        destino = miLigaId;
      }
    }

    if (!destino) {
      alert("Debes seleccionar una liga destino para la transferencia.");
      return;
    }

    if (jugador.liga === destino) {
      alert("El jugador ya pertenece a esta liga.");
      return;
    }

    // Verificar si ya hay una solicitud pendiente para este jugador hacia ese destino
    const pendingReq = solicitudes.find(s => s.jugadorId === jugador.id && s.destinoLigaId === destino && s.status === 'pendiente');
    if (pendingReq) {
      alert("Ya existe una solicitud de transferencia pendiente para este jugador hacia esta liga.");
      return;
    }

    const destinoObj = ligas.find(l => l.id === destino);

    if (window.confirm(`¿Enviar solicitud para transferir a ${jugador.nombre} a la ${destinoObj?.nombre}? El administrador actual deberá aceptarla.`)) {
      try {
        await addDoc(collection(db, 'transferencias'), {
          jugadorId: jugador.id,
          jugadorNombre: jugador.nombre,
          origenLigaId: jugador.liga,
          destinoLigaId: destino,
          status: 'pendiente',
          requestedBy: user?.email || 'desconocido',
          createdAt: serverTimestamp()
        });
        await logAction(user?.email, role, 'CREAR', 'Transferencia', `Solicitó transferir al jugador ${jugador.nombre} a ${destinoObj?.nombre}`);
        alert("Solicitud enviada con éxito. Esperando aprobación.");
      } catch (error) {
        console.error("Error al solicitar transferencia:", error);
        alert("Ocurrió un error al enviar la solicitud.");
      }
    }
  };

  const handleApprove = async (req: TransferRequest) => {
    if (window.confirm(`¿Aprobar la transferencia de ${req.jugadorNombre}?`)) {
      try {
        // 1. Actualizar liga del jugador
        await updateDoc(doc(db, 'jugadores', req.jugadorId), {
          liga: req.destinoLigaId
        });
        
        // 2. Actualizar estado de la solicitud
        await updateDoc(doc(db, 'transferencias', req.id), {
          status: 'aprobada'
        });

        await logAction(user?.email, role, 'EDITAR', 'Transferencia', `Aprobó la transferencia de ${req.jugadorNombre}`);
      } catch (error) {
        console.error("Error al aprobar:", error);
        alert("Error al aprobar la transferencia.");
      }
    }
  };

  const handleReject = async (req: TransferRequest) => {
    if (window.confirm(`¿Rechazar la transferencia de ${req.jugadorNombre}?`)) {
      try {
        await updateDoc(doc(db, 'transferencias', req.id), {
          status: 'rechazada'
        });
        await logAction(user?.email, role, 'EDITAR', 'Transferencia', `Rechazó la transferencia de ${req.jugadorNombre}`);
      } catch (error) {
        console.error("Error al rechazar:", error);
        alert("Error al rechazar la transferencia.");
      }
    }
  };

  const searchedPlayers = searchTerm.trim().length > 0 
    ? jugadores.filter(p => {
        const term = searchTerm.toLowerCase();
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
      })
    : [];

  const solicitudesEntrantes = solicitudes.filter(s => role === 'superadmin' || s.origenLigaId === miLigaId);
  const solicitudesSalientes = solicitudes.filter(s => role === 'superadmin' || s.destinoLigaId === miLigaId);
  const pendingEntrantesCount = solicitudesEntrantes.filter(s => s.status === 'pendiente').length;

  return (
    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-pink-500/20 rounded-lg">
          <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-slate-200">Gestión de Transferencias</h3>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-800 pb-4">
        <button 
          onClick={() => setActiveTab('mercado')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'mercado' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Mercado Global
        </button>
        <button 
          onClick={() => setActiveTab('entrantes')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'entrantes' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Bandeja de Entrada
          {pendingEntrantesCount > 0 && (
            <span className="bg-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingEntrantesCount}</span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('salientes')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'salientes' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Enviadas (Historial)
        </button>
      </div>

      {/* TAB: MERCADO GLOBAL */}
      {activeTab === 'mercado' && (
        <div className="animate-fade-in">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50 mb-8">
            <p className="text-slate-400 mb-4">Busca a cualquier jugador en el sistema global y envía una solicitud de transferencia al administrador de su liga.</p>
            
            <div className="flex flex-col md:flex-row gap-4">
              <select 
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
                className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
              >
                <option value="all">Todas las columnas</option>
                <option value="nombre">Nombre</option>
                <option value="grl">GRL</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="uid_jugador">UID Usuario</option>
              </select>
              <input 
                type="text" 
                placeholder="Buscar jugador..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
              />
              
              {role === 'superadmin' && (
                <select 
                  value={targetLigaId}
                  onChange={(e) => setTargetLigaId(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
                >
                  <option value="">-- Liga Destino --</option>
                  {ligas.map(l => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {searchTerm.trim().length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Jugador</th>
                    <th className="px-5 py-3.5 font-medium">GRL</th>
                    <th className="px-5 py-3.5 font-medium">UID</th>
                    <th className="px-5 py-3.5 font-medium">Liga Actual</th>
                    <th className="px-5 py-3.5 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 bg-slate-900/20">
                  {searchedPlayers.map(jugador => {
                    const origen = ligas.find(l => l.id === jugador.liga);
                    return (
                      <tr key={jugador.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 text-white font-medium">{jugador.nombre}</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-300 font-bold">{jugador.grl}</span>
                        </td>
                        <td className="px-5 py-4 font-mono text-slate-500">{jugador.uid_jugador}</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-slate-800/50 text-slate-300 border-slate-600">
                            {origen?.nombre || 'Desconocida'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button 
                            onClick={() => handleRequestTransfer(jugador)}
                            className="px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/30 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 ml-auto"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Solicitar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {searchedPlayers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                        No se encontraron jugadores con ese término.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: BANDEJA DE ENTRADA */}
      {activeTab === 'entrantes' && (
        <div className="animate-fade-in overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3.5 font-medium">Jugador</th>
                <th className="px-5 py-3.5 font-medium">Destino Solicitado</th>
                <th className="px-5 py-3.5 font-medium">Solicitante</th>
                <th className="px-5 py-3.5 font-medium">Estado</th>
                <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900/20">
              {solicitudesEntrantes.map(req => {
                const destinoObj = ligas.find(l => l.id === req.destinoLigaId);
                return (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 text-white font-medium">{req.jugadorNombre}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${destinoObj?.colorClass || 'text-white'}`}>
                        {destinoObj?.nombre || req.destinoLigaId}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{req.requestedBy}</td>
                    <td className="px-5 py-4">
                      {req.status === 'pendiente' && <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20">PENDIENTE</span>}
                      {req.status === 'aprobada' && <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">APROBADA</span>}
                      {req.status === 'rechazada' && <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-red-500/10 text-red-400 border-red-500/20">RECHAZADA</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {req.status === 'pendiente' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleApprove(req)} className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors text-xs font-medium">Aprobar</button>
                          <button onClick={() => handleReject(req)} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors text-xs font-medium">Rechazar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {solicitudesEntrantes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No tienes solicitudes de transferencia entrantes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: SALIENTES */}
      {activeTab === 'salientes' && (
        <div className="animate-fade-in overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3.5 font-medium">Jugador</th>
                <th className="px-5 py-3.5 font-medium">Origen</th>
                <th className="px-5 py-3.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900/20">
              {solicitudesSalientes.map(req => {
                const origenObj = ligas.find(l => l.id === req.origenLigaId);
                return (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 text-white font-medium">{req.jugadorNombre}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${origenObj?.colorClass || 'text-white'}`}>
                        {origenObj?.nombre || req.origenLigaId}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {req.status === 'pendiente' && <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20">PENDIENTE</span>}
                      {req.status === 'aprobada' && <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">APROBADA</span>}
                      {req.status === 'rechazada' && <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-red-500/10 text-red-400 border-red-500/20">RECHAZADA</span>}
                    </td>
                  </tr>
                );
              })}
              {solicitudesSalientes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                    No has enviado ninguna solicitud de transferencia.
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
