export interface Jugador {
  id: string;
  nombre: string;
  whatsapp: string;
  uid_jugador: string;
  grl: number;
  liga: string;
  actividad?: {
    semana1?: 'logrado' | 'no_logrado' | 'reciente';
    semana2?: 'logrado' | 'no_logrado' | 'reciente';
    semana3?: 'logrado' | 'no_logrado' | 'reciente';
    semana4?: 'logrado' | 'no_logrado' | 'reciente';
  };
}

export interface TransferRequest {
  id: string;
  jugadorId: string;
  jugadorNombre: string;
  origenLigaId: string;
  destinoLigaId: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  tipo?: string;
  requestedBy: string;
  createdAt: any;
}

export interface TournamentRequest {
  id: string;
  jugadorId: string;
  nombre: string;
  ligaId: string;
  fecha: string; // YYYY-MM-DD
  status: 'pendiente' | 'aprobada' | 'rechazada';
  tipo?: string;
  createdAt: any;
}
