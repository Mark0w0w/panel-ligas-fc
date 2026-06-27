import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Liga } from '../hooks/useLigas';

export default function PublicTournamentLobby() {
  const [ligas, setLigas] = useState<Liga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ligas'), (snapshot) => {
      const data: Liga[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Liga));
      setLigas(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">
        <svg className="w-10 h-10 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full text-center mt-12 mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          Torneos Diarios
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
          Selecciona tu liga para ingresar al portal público, buscar tu usuario y solicitar tu inscripción al torneo de hoy.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {ligas.map(liga => (
          <Link 
            key={liga.id} 
            to={`/torneo-diario/${liga.id}`}
            className="group flex flex-col items-center bg-[#1e293b] p-8 rounded-3xl border border-slate-800 shadow-xl hover:bg-slate-800/80 hover:border-slate-600 transition-all transform hover:-translate-y-1"
          >
            {liga.logoUrl ? (
              <img src={liga.logoUrl} alt={liga.nombre} className="w-full h-36 object-contain rounded-xl mb-6 drop-shadow-2xl transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className={`w-16 h-16 rounded-2xl mb-6 shadow-lg flex items-center justify-center ${liga.bgClass || 'bg-blue-500'}`}>
                <svg className="w-8 h-8 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
            )}
            <h2 className={`text-2xl font-bold mb-2 ${liga.colorClass || 'text-white'}`}>
              {liga.nombre}
            </h2>
            <p className="text-slate-500 text-sm group-hover:text-slate-300 transition-colors">
              Ingresar al portal &rarr;
            </p>
          </Link>
        ))}
        {ligas.length === 0 && (
          <div className="col-span-full text-center text-slate-500 py-12">
            No hay ligas registradas en el sistema.
          </div>
        )}
      </div>
    </div>
  );
}
