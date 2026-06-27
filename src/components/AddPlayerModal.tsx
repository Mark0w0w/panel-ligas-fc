import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  liga: string; // Ej: 'liga1', 'liga2'
}

export default function AddPlayerModal({ isOpen, onClose, liga }: AddPlayerModalProps) {
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [uidJugador, setUidJugador] = useState('');
  const [grl, setGrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, role } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await addDoc(collection(db, 'jugadores'), {
        nombre,
        whatsapp,
        uid_jugador: uidJugador,
        grl: Number(grl),
        liga, // Aquí se asigna la liga automáticamente
        createdAt: serverTimestamp()
      });
      
      await logAction(user?.email, role, 'CREAR', 'Usuario', `Añadió al usuario ${nombre} a ${liga}`);
      
      // Limpiar formulario y cerrar el modal
      setNombre('');
      setWhatsapp('');
      setUidJugador('');
      setGrl('');
      onClose();
    } catch (error) {
      console.error("Error al agregar usuario:", error);
      alert("Hubo un error al guardar el usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="flex justify-between items-center p-6 border-b border-slate-700/50 bg-slate-800/20">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Agregar Usuario
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre del Usuario</label>
            <input required type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Ej: markilocurasfc" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">WhatsApp <span className="text-xs text-slate-400 font-normal">(Debes incluir el prefijo del país)</span></label>
            <input required type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="+51 999111222" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">UID de Usuario</label>
              <input required type="text" value={uidJugador} onChange={e => setUidJugador(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="375785172735602688" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">GRL</label>
              <input required type="number" value={grl} onChange={e => setGrl(e.target.value)} min="50" max="150" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono" placeholder="Ej: 95" />
            </div>
          </div>
          
          <div className="pt-2 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors">
              Cancelar
            </button>
            <button disabled={loading} type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:transform-none">
              {loading ? 'Guardando...' : 'Guardar Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
