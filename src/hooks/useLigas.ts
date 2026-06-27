import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Liga {
  id: string;
  nombre: string;
  colorClass: string;
  bgClass: string;
  logoUrl?: string;
  metaSemanal?: number;
  createdAt?: any;
}

export const DEFAULT_LIGAS: Liga[] = [
  { id: 'liga1', nombre: 'Liga 1', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500' },
  { id: 'liga2', nombre: 'Liga 2', colorClass: 'text-sky-400', bgClass: 'bg-sky-500' },
  { id: 'liga3', nombre: 'Liga 3', colorClass: 'text-amber-400', bgClass: 'bg-amber-500' }
];

export function useLigas() {
  const [ligas, setLigas] = useState<Liga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ligas'), (snapshot) => {
      const data: Liga[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Liga));
      
      const hasMigrated = localStorage.getItem('ligas_migrated');
      if (!hasMigrated) {
        import('firebase/firestore').then(({ doc, setDoc }) => {
          DEFAULT_LIGAS.forEach(defaultLiga => {
            if (!data.some(l => l.id === defaultLiga.id)) {
              setDoc(doc(db, 'ligas', defaultLiga.id), {
                nombre: defaultLiga.nombre,
                colorClass: defaultLiga.colorClass,
                bgClass: defaultLiga.bgClass,
                createdAt: new Date()
              });
            }
          });
          localStorage.setItem('ligas_migrated', 'true');
        });
      }

      const hasLogosMigrated = localStorage.getItem('ligas_logos_migrated_v2');
      if (!hasLogosMigrated) {
        import('firebase/firestore').then(({ doc, updateDoc }) => {
          ['liga1', 'liga2', 'liga3'].forEach(ligaId => {
             if (data.some(l => l.id === ligaId)) {
                updateDoc(doc(db, 'ligas', ligaId), { logoUrl: `/logo-${ligaId}.jpeg` }).catch(() => {});
             }
          });
          localStorage.setItem('ligas_logos_migrated_v2', 'true');
        });
      }

      data.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setLigas(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { ligas, loading };
}
