import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const logAction = async (
  adminEmail: string | null | undefined,
  adminRole: string | null | undefined,
  action: 'CREAR' | 'EDITAR' | 'ELIMINAR' | 'LOGIN' | 'MODIFICAR',
  target: 'Usuario' | 'Administrador' | 'Liga' | 'Transferencia' | 'Sistema' | 'Backup' | 'Torneo',
  details: string
) => {
  if (!adminEmail) return;
  try {
    await addDoc(collection(db, 'historial'), {
      adminEmail,
      adminRole: adminRole || 'Desconocido',
      action,
      target,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging action:", error);
  }
};
