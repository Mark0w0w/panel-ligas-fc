import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../utils/logger';

interface EditPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  jugador: any | null;
}

export default function EditPlayerModal({ isOpen, onClose, jugador }: EditPlayerModalProps) {
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [uidJugador, setUidJugador] = useState('');
  const [grl, setGrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, role } = useAuth();

  useEffect(() => {
    if (jugador) {
      setNombre(jugador.nombre);
      setWhatsapp(jugador.whatsapp);
      setUidJugador(jugador.uid_jugador);
      setGrl(jugador.grl.toString());
    }
  }, [jugador]);

  if (!isOpen || !jugador) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await updateDoc(doc(db, 'jugadores', jugador.id), {
        nombre,
        whatsapp,
        uid_jugador: uidJugador,
        grl: Number(grl)
      });
      await logAction(user?.email, role, 'EDITAR', 'Usuario', `Editó los datos de ${nombre}`);
      onClose();
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      alert("Hubo un error al actualizar el usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="flex justify-between items-center p-6 border-b border-slate-700/50 bg-slate-800/20">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Editar Usuario
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
            <input required type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">WhatsApp</label>
            <input required type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">UID de Usuario</label>
              <input required type="text" value={uidJugador} onChange={e => setUidJugador(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">GRL</label>
              <input required type="number" value={grl} onChange={e => setGrl(e.target.value)} min="50" max="150" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono" />
            </div>
          </div>
          
          <div className="pt-2 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors">
              Cancelar
            </button>
            <button disabled={loading} type="submit" className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-lg shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:transform-none">
              {loading ? 'Actualizando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
