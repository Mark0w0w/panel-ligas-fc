import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, deleteDoc, doc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { useAuth } from './context/AuthContext';
import { useLigas } from './hooks/useLigas';
import { logAction } from './utils/logger';
import { showAlert, showConfirm } from './utils/alerts';
import type { Jugador } from './types';

// Componentes
import AdminManager from './components/AdminManager';
import AdminList from './components/AdminList';
import AddPlayerModal from './components/AddPlayerModal';
import EditPlayerModal from './components/EditPlayerModal';
import HistoryLog from './components/HistoryLog';
import DeletedUsers from './components/DeletedUsers';
import LeagueSection from './components/LeagueSection';
import CreateLeague from './components/CreateLeague';
import TransferManager from './components/TransferManager';
import DailyTournamentManager from './components/DailyTournamentManager';
import WeeklyActivityManager from './components/WeeklyActivityManager';
import BackupManager from './components/BackupManager';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { ligas, loading: ligasLoading } = useLigas();
  
  const [activeTab, setActiveTab] = useState('general');
  const [activeLigaId, setActiveLigaId] = useState<string | null>(null);
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeLeague, setActiveLeague] = useState('');
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [playerToEdit, setPlayerToEdit] = useState<Jugador | null>(null);
  
  const [solicitudesTorneo, setSolicitudesTorneo] = useState<any[]>([]);
  const [revisionesActividad, setRevisionesActividad] = useState<any[]>([]);

  useEffect(() => {
    const q = collection(db, 'jugadores');
    const unsub = onSnapshot(q, (snapshot) => {
      const playersData: Jugador[] = [];
      snapshot.forEach(doc => {
        playersData.push({ id: doc.id, ...doc.data() } as Jugador);
      });
      playersData.sort((a, b) => {
        const timeA = (a as any).createdAt?.toMillis() || 0;
        const timeB = (b as any).createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setJugadores(playersData);
    });

    const qTorneo = query(collection(db, 'solicitudes_torneo'), where('status', '==', 'pendiente'));
    const unsubTorneo = onSnapshot(qTorneo, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setSolicitudesTorneo(data);
    });

    const qActividad = query(collection(db, 'revisiones_actividad'), where('status', '==', 'pendiente'));
    const unsubActividad = onSnapshot(qActividad, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setRevisionesActividad(data);
    });

    return () => {
      unsub();
      unsubTorneo();
      unsubActividad();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const getRoleDisplayName = (r: string | null) => {
    if (r === 'superadmin') return 'Super Administrador';
    const liga = ligas.find(l => `admin_${l.id}` === r);
    if (liga) return `Admin ${liga.nombre}`;
    return 'Sin rol asignado';
  };

  const handleAddPlayer = (liga: string) => {
    setActiveLeague(liga);
    setIsAddModalOpen(true);
  };

  const handleEditPlayer = (jugador: Jugador) => {
    setPlayerToEdit(jugador);
    setIsEditModalOpen(true);
  };

  const handleDeletePlayer = async (jugador: Jugador) => {
    const isConfirmed = await showConfirm('Eliminar Jugador', `¿Estás seguro de que deseas eliminar a ${jugador.nombre}? Se enviará a la papelera.`, 'Sí, eliminar', true);
    if (isConfirmed) {
      try {
        await addDoc(collection(db, 'jugadores_eliminados'), {
          nombre: jugador.nombre,
          whatsapp: jugador.whatsapp,
          uid_jugador: jugador.uid_jugador,
          grl: jugador.grl,
          liga: jugador.liga,
          deletedAt: serverTimestamp()
        });
        await deleteDoc(doc(db, 'jugadores', jugador.id));
        await logAction(user?.email, role, 'ELIMINAR', 'Usuario', `Envió al usuario ${jugador.nombre} a la papelera`);
        showAlert('Eliminado', 'Jugador enviado a la papelera correctamente.', 'success');
      } catch (error) {
        console.error("Error al eliminar jugador:", error);
        showAlert('Error', 'Hubo un error al eliminar el jugador', 'error');
      }
    }
  };

  if (ligasLoading) {
    return <div className="min-h-screen bg-[#0a0c15] flex items-center justify-center text-white">Cargando...</div>;
  }

  const accessibleLigas = ligas.filter(l => role === 'superadmin' || role === `admin_${l.id}`);
  const validLigaIds = accessibleLigas.map(l => l.id);
  const accessibleJugadores = jugadores.filter(j => validLigaIds.includes(j.liga));

  const notificaciones = accessibleLigas.length > 0 ? (function() {
    const validTorneos = solicitudesTorneo.filter(s => validLigaIds.includes(s.ligaId)).map(s => ({
       id: s.id,
       type: 'torneo',
       ligaId: s.ligaId,
       nombre: s.nombre,
       mensaje: `Solicitud de torneo`
    }));
    const validActividad = revisionesActividad.filter(s => validLigaIds.includes(s.ligaId)).map(s => ({
       id: s.id,
       type: 'actividad',
       ligaId: s.ligaId,
       nombre: s.nombre,
       mensaje: `Revisión de actividad`
    }));
    return [...validTorneos, ...validActividad];
  })() : [];

  const activeLigaObj = ligas.find(l => l.id === activeLigaId);
  const displayLogoLiga = activeLigaObj || (accessibleLigas.length === 1 ? accessibleLigas[0] : null);

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          {displayLogoLiga?.logoUrl ? (
            <img src={displayLogoLiga.logoUrl} alt={displayLogoLiga.nombre} className="w-10 h-10 object-contain rounded-lg" />
          ) : (
            <div className="sidebar-logo-icon">
              {displayLogoLiga ? displayLogoLiga.nombre.substring(0, 2).toUpperCase() : 'FC'}
            </div>
          )}
          <span className="sidebar-logo-name">{displayLogoLiga ? displayLogoLiga.nombre : 'Admin Panel'}</span>
        </div>
        
        <div className="sidebar-user">
          <div className="sidebar-user-top">
            <div className="sidebar-user-avatar">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="sidebar-user-actions">
              <button title="Cerrar sesión" onClick={handleLogout}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
          <div className="sidebar-user-date">Sesión Activa</div>
          <div className="sidebar-user-name">{user?.email}</div>
          <div className={`role-badge ${role === 'superadmin' ? 'superadmin' : 'admin'}`}>
            {getRoleDisplayName(role)}
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-nav-section">
            <div className="sidebar-nav-label">General</div>
            
            <button 
              onClick={() => setActiveTab('general')}
              className={`sidebar-nav-item ${activeTab === 'general' ? 'active' : ''}`}
            >
              <span className="nav-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg></span>
              <span>Panel General</span>
            </button>

            <button 
              onClick={() => setActiveTab('transferencias')}
              className={`sidebar-nav-item ${activeTab === 'transferencias' ? 'active' : ''}`}
            >
              <span className="nav-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></span>
              <span>Transferencias</span>
            </button>
          </div>

          {notificaciones.length > 0 && (
            <div className="sidebar-nav-section">
              <div className="sidebar-nav-label flex items-center gap-2">
                Notificaciones 
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full ml-1" style={{ fontSize: '9px', fontWeight: 'bold' }}>{notificaciones.length}</span>
              </div>
              {notificaciones.map(notif => (
                <button 
                  key={notif.id}
                  onClick={() => {
                    setExpandedLeague(notif.ligaId);
                    setActiveLigaId(notif.ligaId);
                    setActiveTab(notif.type === 'torneo' ? 'torneos' : 'actividad');
                  }}
                  className="sidebar-nav-item"
                  style={{ padding: '6px 12px', alignItems: 'flex-start' }}
                >
                  <span className="nav-icon text-amber-400 mt-1">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-xs font-semibold text-slate-200 truncate w-36">{notif.nombre}</span>
                    <span className="text-[10px] text-slate-400 truncate w-36">{notif.mensaje}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="sidebar-nav-section">
            <div className="sidebar-nav-label">Ligas</div>
            
            {accessibleLigas.map(liga => (
              <div key={liga.id}>
                <button 
                  onClick={() => setExpandedLeague(expandedLeague === liga.id ? null : liga.id)}
                  className={`sidebar-nav-item ${expandedLeague === liga.id ? 'active' : ''}`}
                >
                  <span className="nav-icon" style={{ opacity: 1 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white opacity-50 block m-auto"></span>
                  </span>
                  <span className="flex-1">{liga.nombre}</span>
                  <svg className={`w-3.5 h-3.5 opacity-50 transition-transform ${expandedLeague === liga.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {expandedLeague === liga.id && (
                  <div className="pl-7 pr-2 py-1 space-y-0.5 mt-1 border-l border-white/10 ml-4 mb-2">
                    <button 
                      onClick={() => { setActiveTab('gestion'); setActiveLigaId(liga.id); }}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${activeTab === 'gestion' && activeLigaId === liga.id ? 'bg-[var(--bg-hover)] text-white font-medium' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'}`}
                    >
                      Gestión de Jugadores
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveLigaId(liga.id); setActiveTab('historial'); }}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${activeTab === 'historial' && activeLigaId === liga.id ? 'bg-[var(--bg-hover)] text-white font-medium' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'}`}
                    >
                      Historial de Movimientos
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveLigaId(liga.id); setActiveTab('torneos'); }}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${activeTab === 'torneos' && activeLigaId === liga.id ? 'bg-[var(--bg-hover)] text-white font-medium' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'}`}
                    >
                      Torneos Diarios
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveLigaId(liga.id); setActiveTab('actividad'); }}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${activeTab === 'actividad' && activeLigaId === liga.id ? 'bg-[var(--bg-hover)] text-white font-medium' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'}`}
                    >
                      Actividad Semanal
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {role === 'superadmin' && (
            <div className="sidebar-nav-section">
              <div className="sidebar-nav-label">Avanzado</div>
              <button 
                onClick={() => setActiveTab('superadmin')}
                className={`sidebar-nav-item ${activeTab === 'superadmin' ? 'active' : ''}`}
              >
                <span className="nav-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></span>
                <span>Gestión Admins</span>
              </button>
              <button 
                onClick={() => setActiveTab('nueva_liga')}
                className={`sidebar-nav-item ${activeTab === 'nueva_liga' ? 'active' : ''}`}
              >
                <span className="nav-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></span>
                <span>Gestión Ligas</span>
              </button>
              <button 
                onClick={() => setActiveTab('papelera')}
                className={`sidebar-nav-item ${activeTab === 'papelera' ? 'active' : ''}`}
              >
                <span className="nav-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></span>
                <span>Papelera</span>
              </button>
              <button 
                onClick={() => setActiveTab('respaldos')}
                className={`sidebar-nav-item ${activeTab === 'respaldos' ? 'active' : ''}`}
              >
                <span className="nav-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg></span>
                <span>Respaldos</span>
              </button>
            </div>
          )}
        </nav>
      </aside>

      {/* MAIN WRAPPER */}
      <div className="main-wrapper">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-period">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Este mes
          </div>
          <div className="topbar-actions">
            <div className="topbar-notif">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {notificaciones.length > 0 && <div className="notif-dot"></div>}
            </div>
            <button 
              className="topbar-btn-secondary flex items-center gap-2 !bg-indigo-500/10 hover:!bg-indigo-500/20 !text-indigo-400 !border-indigo-500/30 whitespace-nowrap" 
              onClick={() => window.open('/torneo-diario', '_blank')}
              title="Abre la página pública para que copies el link y lo envíes a tu grupo de WhatsApp"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              URL para Usuarios (WhatsApp)
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="main-content">
          <div className="max-w-6xl mx-auto space-y-8 pb-12">
            
            {/* TAB: GENERAL */}
            {activeTab === 'general' && (
              <div className="animate-fade-in">
                
                {/* Stats Grid */}
                <div className="stats-grid">
                   <div className="stat-card">
                     <div className="stat-label">Ligas Activas</div>
                     <div className="stat-value">{accessibleLigas.length}</div>
                   </div>
                   <div className="stat-card">
                     <div className="stat-label">Total Jugadores</div>
                     <div className="stat-value">{accessibleJugadores.length}</div>
                   </div>
                   <div className="stat-card">
                     <div className="stat-label">Nuevos (Mes)</div>
                     <div className="stat-value">
                        {accessibleJugadores.filter(j => {
                          const date = (j as any).createdAt?.toDate();
                          if(!date) return false;
                          const now = new Date();
                          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                        }).length}
                     </div>
                   </div>
                </div>

                <div className="cards-grid-3">

                   {accessibleLigas.map(liga => (
                     <div key={liga.id} className="feature-card card" style={{cursor: 'pointer'}} onClick={() => {
                        setExpandedLeague(liga.id);
                        setActiveTab('gestion');
                        setActiveLigaId(liga.id);
                     }}>
                       <div className="icon" style={{background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                         <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       </div>
                       <div>
                         <h3 className="card-title">{liga.nombre}</h3>
                         <p className="card-subtitle">Gestiona usuarios y movimientos.</p>
                       </div>
                       <button className="card-expand-btn"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button>
                     </div>
                   ))}

                   <div className="feature-card card" style={{cursor: 'pointer'}} onClick={() => setActiveTab('transferencias')}>
                      <div className="icon" style={{background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      </div>
                      <div>
                        <h3 className="card-title">Transferencias</h3>
                        <p className="card-subtitle">Transfiere jugadores globalmente.</p>
                      </div>
                      <button className="card-expand-btn"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button>
                   </div>
                   
                   {/* Tarjeta Gigante del Logo de la Liga */}
                   {displayLogoLiga?.logoUrl && (
                     <div className="card flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900/80 to-[#1e293b]/80 border border-slate-700/50 shadow-2xl rounded-2xl group hover:border-blue-500/50 transition-all overflow-hidden relative">
                       <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <img 
                         src={displayLogoLiga.logoUrl} 
                         alt={displayLogoLiga.nombre} 
                         className="h-24 md:h-28 object-contain rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300 relative z-10" 
                       />
                       <h3 className="mt-4 text-sm font-extrabold tracking-widest text-slate-300 uppercase relative z-10">{displayLogoLiga.nombre}</h3>
                     </div>
                   )}
                </div>

                <div className="mt-8">
                  <div className="table-card">
                    <div className="table-card-header">
                      <h3 className="table-card-title">Historial de Actividad Reciente</h3>
                    </div>
                    <div className="p-0">
                      <HistoryLog hideHeader={true} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: TRANSFERENCIAS */}
            {activeTab === 'transferencias' && (
              <div className="animate-fade-in card">
                <TransferManager />
              </div>
            )}

            {/* TAB: LIGAS */}
            {(activeTab === 'gestion' || activeTab === 'historial' || activeTab === 'torneos' || activeTab === 'actividad') && activeLigaId && (() => {
              const ligaObj = ligas.find(l => l.id === activeLigaId);
              if (!ligaObj) return null;
              const leaguePlayers = jugadores.filter(j => j.liga === activeLigaId);
              
              if (activeTab === 'actividad') {
                return (
                  <div className="animate-fade-in card min-h-[500px]">
                    <WeeklyActivityManager 
                      ligaId={activeLigaId}
                      ligaNombre={ligaObj.nombre}
                      metaSemanal={ligaObj.metaSemanal}
                      players={leaguePlayers}
                    />
                  </div>
                );
              }
              
              if (activeTab === 'torneos') {
                return (
                  <div className="animate-fade-in card min-h-[500px]">
                    <DailyTournamentManager 
                      ligaId={activeLigaId}
                      ligaNombre={ligaObj.nombre}
                      colorClass={ligaObj.colorClass}
                      bgClass={ligaObj.bgClass}
                      players={leaguePlayers}
                    />
                  </div>
                );
              }

              return (
                <div className="animate-fade-in space-y-6">
                  {activeTab === 'gestion' && (
                    <div className="card">
                      <LeagueSection 
                        ligaId={ligaObj.id} 
                        titulo={`Gestión - ${ligaObj.nombre}`} 
                        colorClass={ligaObj.colorClass} 
                        bgClass={ligaObj.bgClass} 
                        players={jugadores.filter(j => j.liga === ligaObj.id)} 
                        onAddPlayer={handleAddPlayer} 
                        onEditPlayer={handleEditPlayer} 
                        onDeletePlayer={handleDeletePlayer} 
                      />
                    </div>
                  )}
                  {activeTab === 'historial' && (
                    <div className="card p-0">
                      <div className="p-6 pb-0 border-b border-[var(--border)]"><h3 className="card-title">Historial de la Liga</h3></div>
                      <HistoryLog hideHeader={true} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB: SUPERADMIN */}
            {activeTab === 'superadmin' && role === 'superadmin' && (
              <div className="animate-fade-in space-y-6">
                <div className="card">
                  <AdminManager />
                </div>
                <div className="card">
                  <AdminList />
                </div>
              </div>
            )}

            {/* TAB: NUEVA LIGA */}
            {activeTab === 'nueva_liga' && role === 'superadmin' && (
              <div className="animate-fade-in card">
                <CreateLeague />
              </div>
            )}

            {/* TAB: PAPELERA */}
            {activeTab === 'papelera' && role === 'superadmin' && (
              <div className="animate-fade-in card">
                <DeletedUsers />
              </div>
            )}

            {/* TAB: RESPALDOS */}
            {activeTab === 'respaldos' && role === 'superadmin' && (
              <div className="animate-fade-in card">
                <BackupManager ligas={ligas} jugadores={jugadores} />
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modales Compartidos */}
      <AddPlayerModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        liga={activeLeague} 
      />
      <EditPlayerModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setPlayerToEdit(null);
        }}
        jugador={playerToEdit}
      />
    </div>
  );
}
