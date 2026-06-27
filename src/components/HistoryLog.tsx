import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

interface Log {
  id: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  target: string;
  details: string;
  timestamp: any;
}

export default function HistoryLog() {
  const { user, role } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (!user) return;
    
    // Consulta simple ordenada por fecha para evitar problemas de índices compuestos en Firestore
    const q = query(collection(db, 'historial'), orderBy('timestamp', 'desc'), limit(200));
    
    const unsub = onSnapshot(q, (snapshot) => {
      let data: Log[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Log);
      });
      
      // Filtrado local para administradores normales
      if (role !== 'superadmin') {
        data = data.filter(log => log.adminEmail === user.email);
      }
      
      setLogs(data);
    });
    
    return () => unsub();
  }, [user, role]);

  return (
    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl mt-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-200">
          Historial de Movimientos {role === 'superadmin' ? '(Todos)' : '(Mis Movimientos)'}
        </h3>
      </div>
      
      <div className="overflow-x-auto rounded-xl border border-slate-700 max-h-[500px]">
        <table className="w-full text-left text-sm text-slate-400 relative">
          <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700 sticky top-0 z-10 backdrop-blur-md">
            <tr>
              <th className="px-5 py-3.5 font-medium">Fecha y Hora</th>
              {role === 'superadmin' && <th className="px-5 py-3.5 font-medium">Administrador</th>}
              <th className="px-5 py-3.5 font-medium">Acción</th>
              <th className="px-5 py-3.5 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 bg-slate-900/20">
            {logs.map(log => {
              const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
              const formattedDate = date.toLocaleString('es-ES', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute:'2-digit' 
              });
              
              let badgeColor = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
              if (log.action === 'CREAR') badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
              if (log.action === 'EDITAR') badgeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
              if (log.action === 'ELIMINAR') badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';

              return (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">{formattedDate}</td>
                  {role === 'superadmin' && (
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{log.adminEmail}</span>
                        <span className="text-xs text-slate-500">{log.adminRole}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${badgeColor}`}>
                      {log.action} {log.target}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{log.details}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={role === 'superadmin' ? 4 : 3} className="px-5 py-8 text-center text-slate-500">
                  No hay movimientos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
