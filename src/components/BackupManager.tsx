import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, addDoc, serverTimestamp, writeBatch, deleteDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';
import type { Jugador } from '../types';
import type { Liga } from '../hooks/useLigas';

interface BackupManagerProps {
  ligas: Liga[];
  jugadores: Jugador[];
}

interface BackupDoc {
  id: string;
  ligaId: string;
  ligaNombre: string;
  fecha: any;
  creadoPor: string;
  data: {
    liga: Liga;
    jugadores: Jugador[];
  };
}

export default function BackupManager({ ligas, jugadores }: BackupManagerProps) {
  const { user, role } = useAuth();
  const [backups, setBackups] = useState<BackupDoc[]>([]);
  const [selectedLigaId, setSelectedLigaId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (role !== 'superadmin') return;

    const q = query(collection(db, 'backups'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: BackupDoc[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as BackupDoc);
      });
      // Sort newest first
      data.sort((a, b) => (b.fecha?.toMillis() || 0) - (a.fecha?.toMillis() || 0));
      setBackups(data);
    });
    return () => unsub();
  }, [role]);

  const handleCreateBackup = async () => {
    if (!selectedLigaId) {
      alert('Selecciona una liga primero.');
      return;
    }
    const liga = ligas.find(l => l.id === selectedLigaId);
    if (!liga) return;

    const ligaJugadores = jugadores.filter(j => j.liga === selectedLigaId);
    
    if (window.confirm(`¿Crear una copia de seguridad para la liga "${liga.nombre}" con ${ligaJugadores.length} jugadores?`)) {
      setIsProcessing(true);
      try {
        await addDoc(collection(db, 'backups'), {
          ligaId: liga.id,
          ligaNombre: liga.nombre,
          fecha: serverTimestamp(),
          creadoPor: user?.email || 'desconocido',
          data: {
            liga: liga,
            jugadores: ligaJugadores
          }
        });
        
        await logAction(user?.email, role, 'CREAR', 'Backup', `Creó respaldo para la liga ${liga.nombre} (${ligaJugadores.length} jugadores)`);
        alert('Respaldo creado exitosamente.');
      } catch (error) {
        console.error('Error creating backup:', error);
        alert('Hubo un error al crear el respaldo.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleRestoreBackup = async (backup: BackupDoc) => {
    if (!window.confirm(`⚠️ ADVERTENCIA CRITICA ⚠️\n\n¿Estás absolutamente seguro de querer restaurar el respaldo de "${backup.ligaNombre}" del ${backup.fecha?.toDate().toLocaleString()}?\n\nEsto sobrescribirá los datos actuales de esos jugadores y la configuración de la liga con los datos del respaldo. Los jugadores actuales serán eliminados y reemplazados.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Restore League configuration
      await setDoc(doc(db, 'ligas', backup.ligaId), backup.data.liga);

      // 2. Wipe existing players for this league to ensure a clean restoration
      const qExisting = query(collection(db, 'jugadores'), where('liga', '==', backup.ligaId));
      const existingSnapshot = await getDocs(qExisting);
      
      const wipeChunks: string[][] = [];
      let currentWipeChunk: string[] = [];
      existingSnapshot.forEach(docSnap => {
        currentWipeChunk.push(docSnap.id);
        if (currentWipeChunk.length === 450) {
          wipeChunks.push(currentWipeChunk);
          currentWipeChunk = [];
        }
      });
      if (currentWipeChunk.length > 0) wipeChunks.push(currentWipeChunk);

      for (const chunk of wipeChunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'jugadores', id));
        });
        await batch.commit();
      }

      // 3. Restore all players using a Batch (Firestore batches support up to 500 writes)
      const chunks = [];
      const chunkSize = 450;
      for (let i = 0; i < backup.data.jugadores.length; i += chunkSize) {
        chunks.push(backup.data.jugadores.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(jugador => {
          const playerRef = doc(db, 'jugadores', jugador.id);
          batch.set(playerRef, jugador);
        });
        await batch.commit();
      }

      await logAction(user?.email, role, 'MODIFICAR', 'Backup', `Restauró respaldo para la liga ${backup.ligaNombre} (${backup.data.jugadores.length} jugadores)`);
      alert('¡Respaldo restaurado con éxito! La liga y los jugadores han vuelto al estado guardado.');
    } catch (error) {
      console.error('Error restoring backup:', error);
      alert('Error crítico al restaurar el respaldo. Revisa la consola.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBackup = async (backupId: string, nombre: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar este respaldo de ${nombre} permanentemente?`)) {
      try {
        await deleteDoc(doc(db, 'backups', backupId));
      } catch (error) {
        console.error('Error deleting backup:', error);
        alert('Hubo un error al eliminar el respaldo.');
      }
    }
  };

  if (role !== 'superadmin') {
    return <div className="text-red-500">Acceso denegado. Solo superadmins.</div>;
  }

  const filteredBackups = selectedLigaId ? backups.filter(b => b.ligaId === selectedLigaId) : backups;

  // Agrupar respaldos por liga
  const groupedBackups = filteredBackups.reduce((acc, backup) => {
    if (!acc[backup.ligaNombre]) acc[backup.ligaNombre] = [];
    acc[backup.ligaNombre].push(backup);
    return acc;
  }, {} as Record<string, BackupDoc[]>);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-8">Gestión de Respaldos (Backups)</h2>
      
      <div className="bg-[#1e293b] p-6 rounded-2xl border border-emerald-500/30 shadow-xl">
        <h3 className="text-xl font-bold text-emerald-400 mb-2">Crear Nuevo Respaldo</h3>
        <p className="text-slate-400 text-sm mb-6">Selecciona una liga para guardar una instantánea completa de su configuración, sus jugadores y su actividad semanal. Ideal para prevenir pérdidas de datos.</p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <select 
            value={selectedLigaId}
            onChange={(e) => setSelectedLigaId(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            <option value="">-- Selecciona una Liga --</option>
            {ligas.map(l => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
          <button 
            onClick={handleCreateBackup}
            disabled={!selectedLigaId || isProcessing}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? 'Procesando...' : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                Crear Respaldo
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {Object.keys(groupedBackups).length === 0 ? (
          <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-12 text-center text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            No se encontraron respaldos disponibles.
          </div>
        ) : (
          Object.entries(groupedBackups).map(([ligaNombre, ligabackups]) => (
            <div key={ligaNombre} className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-800/80 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white">Respaldos de {ligaNombre}</h3>
                <span className="ml-auto text-xs font-bold bg-slate-700 px-2 py-1 rounded-md text-slate-300">{ligabackups.length} respaldos</span>
              </div>
              
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400 min-w-[600px]">
                  <thead className="bg-slate-900/50 border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-slate-300">Fecha del Respaldo</th>
                      <th className="px-6 py-4 font-semibold text-slate-300">Jugadores</th>
                      <th className="px-6 py-4 font-semibold text-slate-300">Creado Por</th>
                      <th className="px-6 py-4 font-semibold text-right text-slate-300">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {ligabackups.map(backup => (
                      <tr key={backup.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {backup.fecha?.toDate().toLocaleString() || 'Desconocida'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-800 px-3 py-1 rounded-lg text-slate-300 font-mono text-xs border border-slate-700">
                            {backup.data.jugadores.length} usuarios
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{backup.creadoPor}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleRestoreBackup(backup)}
                              disabled={isProcessing}
                              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
                              title="Restaurar este respaldo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              Restaurar
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(backup.id, backup.ligaNombre)}
                              disabled={isProcessing}
                              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                              title="Eliminar permanentemente"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
