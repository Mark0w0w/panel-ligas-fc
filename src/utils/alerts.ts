import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// Configuración base para que coincida con el tema NeuroBank
const NeuroSwal = MySwal.mixin({
  background: '#111628', // bg-card
  color: '#FFFFFF', // text-primary
  customClass: {
    popup: 'rounded-[16px] border border-[rgba(255,255,255,0.06)] shadow-2xl',
    title: 'text-[20px] font-semibold text-white tracking-tight',
    htmlContainer: 'text-[14px] text-[#8892AA]', // text-secondary
    confirmButton: 'bg-[#5B6CF5] hover:bg-[#6B7CF8] text-white font-medium px-5 py-2.5 rounded-xl transition-all border-none outline-none',
    cancelButton: 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] text-[#8892AA] hover:text-white font-medium px-5 py-2.5 rounded-xl transition-all border border-[rgba(255,255,255,0.1)] outline-none',
  },
  buttonsStyling: false,
});

export const showAlert = (title: string, text?: string, icon: 'success' | 'error' | 'warning' | 'info' | 'question' = 'success') => {
  return NeuroSwal.fire({
    title,
    text,
    icon,
    iconColor: icon === 'success' ? '#34D399' : icon === 'error' ? '#F87171' : icon === 'warning' ? '#FBBF24' : '#60A5FA',
    confirmButtonText: 'Aceptar'
  });
};

export const showConfirm = async (title: string, text?: string, confirmText: string = 'Sí, continuar', isDanger: boolean = false) => {
  const result = await NeuroSwal.fire({
    title,
    text,
    icon: 'warning',
    iconColor: isDanger ? '#F87171' : '#FBBF24',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancelar',
    customClass: {
      popup: 'rounded-[16px] border border-[rgba(255,255,255,0.06)] shadow-2xl',
      title: 'text-[20px] font-semibold text-white tracking-tight',
      htmlContainer: 'text-[14px] text-[#8892AA]',
      confirmButton: isDanger 
        ? 'bg-[#F87171] hover:bg-red-500 text-white font-medium px-5 py-2.5 rounded-xl transition-all border-none outline-none mr-3'
        : 'bg-[#5B6CF5] hover:bg-[#6B7CF8] text-white font-medium px-5 py-2.5 rounded-xl transition-all border-none outline-none mr-3',
      cancelButton: 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] text-[#8892AA] hover:text-white font-medium px-5 py-2.5 rounded-xl transition-all border border-[rgba(255,255,255,0.1)] outline-none',
    },
  });
  return result.isConfirmed;
};

// Toast tipo notificación pequeña en la esquina
export const showToast = (title: string, icon: 'success' | 'error' | 'info' = 'success') => {
  const Toast = MySwal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#111628',
    color: '#FFFFFF',
    iconColor: icon === 'success' ? '#34D399' : icon === 'error' ? '#F87171' : '#60A5FA',
    customClass: {
      popup: 'rounded-[12px] border border-[rgba(255,255,255,0.06)]',
    },
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
  });

  return Toast.fire({
    icon,
    title
  });
};

export const showAttendanceResolution = async (playerName: string, date: string) => {
  const result = await NeuroSwal.fire({
    title: 'Actualizar Estado',
    html: `
      <style>
        .swal2-radio {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 0.5rem !important;
          background: transparent !important;
          margin-top: 1.5rem !important;
        }
        .swal2-radio label {
          color: #e2e8f0 !important;
          justify-content: flex-start !important;
          width: 100% !important;
          background: rgba(30, 41, 59, 0.5) !important;
          padding: 0.75rem 1rem !important;
          border-radius: 0.75rem !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          margin: 0 !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        .swal2-radio label:hover {
          background: rgba(30, 41, 59, 0.8) !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        .swal2-radio input {
          margin-right: 0.75rem !important;
          accent-color: #5B6CF5 !important;
          width: 1.2rem !important;
          height: 1.2rem !important;
        }
      </style>
      ¿Cuál es el nuevo estado para <b class="text-white">${playerName}</b> del día <b class="text-white">${date}</b>?
    `,
    input: 'radio',
    inputOptions: {
      'cumplio': '🟢 Jugó y cumplió',
      'no_cumplio': '🟠 Jugó y no cumplió',
      'no_jugo': '🔴 No jugó / Ausente'
    },
    inputValidator: (value) => {
      if (!value) {
        return 'Debes seleccionar un estado';
      }
    },
    showCancelButton: true,
    confirmButtonText: 'Actualizar Estado',
    cancelButtonText: 'Cancelar',
    customClass: {
      popup: 'rounded-[16px] border border-[rgba(255,255,255,0.06)] shadow-2xl',
      title: 'text-[20px] font-semibold text-white tracking-tight',
      htmlContainer: 'text-[14px] text-[#8892AA] mb-4',
      confirmButton: 'bg-[#5B6CF5] hover:bg-[#6B7CF8] text-white font-medium px-5 py-2.5 rounded-xl transition-all border-none outline-none mr-3',
      cancelButton: 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] text-[#8892AA] hover:text-white font-medium px-5 py-2.5 rounded-xl transition-all border border-[rgba(255,255,255,0.1)] outline-none',
    },
  });

  return result.isConfirmed ? result.value : null;
};
export const showWeekSelector = async (playerName: string, statusName: string) => {
  const result = await NeuroSwal.fire({
    title: 'Seleccionar Semana',
    html: `
      <style>
        .swal2-radio {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 0.5rem !important;
          background: transparent !important;
          margin-top: 1.5rem !important;
        }
        .swal2-radio label {
          color: #e2e8f0 !important;
          justify-content: flex-start !important;
          width: 100% !important;
          background: rgba(30, 41, 59, 0.5) !important;
          padding: 0.75rem 1rem !important;
          border-radius: 0.75rem !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          margin: 0 !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        .swal2-radio label:hover {
          background: rgba(30, 41, 59, 0.8) !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        .swal2-radio input {
          margin-right: 0.75rem !important;
          accent-color: #5B6CF5 !important;
          width: 1.2rem !important;
          height: 1.2rem !important;
        }
      </style>
      ¿A qué semana deseas aplicarle el estado <b>${statusName}</b> a <b class="text-white">${playerName}</b>?
    `,
    input: 'radio',
    inputOptions: {
      'S1': 'Semana 1',
      'S2': 'Semana 2',
      'S3': 'Semana 3',
      'S4': 'Semana 4'
    },
    inputValidator: (value) => {
      if (!value) {
        return 'Debes seleccionar una semana';
      }
    },
    showCancelButton: true,
    confirmButtonText: 'Aplicar',
    cancelButtonText: 'Cancelar',
    customClass: {
      popup: 'rounded-[16px] border border-[rgba(255,255,255,0.06)] shadow-2xl',
      title: 'text-[20px] font-semibold text-white tracking-tight',
      htmlContainer: 'text-[14px] text-[#8892AA] mb-4',
      confirmButton: 'bg-[#5B6CF5] hover:bg-[#6B7CF8] text-white font-medium px-5 py-2.5 rounded-xl transition-all border-none outline-none mr-3',
      cancelButton: 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] text-[#8892AA] hover:text-white font-medium px-5 py-2.5 rounded-xl transition-all border border-[rgba(255,255,255,0.1)] outline-none',
    }
  });
  return result.isConfirmed ? result.value : null;
};
export const showPublicWeekSelector = async () => {
  const result = await NeuroSwal.fire({
    title: 'Reclamar Asistencia',
    html: `
      <style>
        .swal2-radio {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 0.5rem !important;
          background: transparent !important;
          margin-top: 1.5rem !important;
        }
        .swal2-radio label {
          color: #e2e8f0 !important;
          justify-content: flex-start !important;
          width: 100% !important;
          background: rgba(30, 41, 59, 0.5) !important;
          padding: 0.75rem 1rem !important;
          border-radius: 0.75rem !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          margin: 0 !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        .swal2-radio label:hover {
          background: rgba(30, 41, 59, 0.8) !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        .swal2-radio input {
          margin-right: 0.75rem !important;
          accent-color: #5B6CF5 !important;
          width: 1.2rem !important;
          height: 1.2rem !important;
        }
      </style>
      ¿Deseas enviar un reclamo a la administración para que revise tu situación? <br><br><b>Elige la semana que deseas revisar:</b>
    `,
    input: 'radio',
    inputOptions: {
      'Semana 1': 'Semana 1',
      'Semana 2': 'Semana 2',
      'Semana 3': 'Semana 3',
      'Semana 4': 'Semana 4'
    },
    inputValidator: (value) => {
      if (!value) {
        return 'Debes seleccionar una semana';
      }
    },
    showCancelButton: true,
    confirmButtonText: 'Sí, enviar reclamo',
    cancelButtonText: 'Cancelar',
    customClass: {
      popup: 'rounded-[16px] border border-[rgba(255,255,255,0.06)] shadow-2xl',
      title: 'text-[20px] font-semibold text-white tracking-tight',
      htmlContainer: 'text-[14px] text-[#8892AA] mb-4',
      confirmButton: 'bg-[#5B6CF5] hover:bg-[#6B7CF8] text-white font-medium px-5 py-2.5 rounded-xl transition-all border-none outline-none mr-3',
      cancelButton: 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] text-[#8892AA] hover:text-white font-medium px-5 py-2.5 rounded-xl transition-all border border-[rgba(255,255,255,0.1)] outline-none',
    }
  });
  return result.isConfirmed ? result.value : null;
};
export const showActivityStateSelector = async (playerName: string, weekName: string) => {
  const result = await NeuroSwal.fire({
    title: 'Actualizar Estado',
    html: `
      <style>
        .swal2-radio {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 0.5rem !important;
          background: transparent !important;
          margin-top: 1.5rem !important;
        }
        .swal2-radio label {
          color: #e2e8f0 !important;
          justify-content: flex-start !important;
          width: 100% !important;
          background: rgba(30, 41, 59, 0.5) !important;
          padding: 0.75rem 1rem !important;
          border-radius: 0.75rem !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          margin: 0 !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        .swal2-radio label:hover {
          background: rgba(30, 41, 59, 0.8) !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        .swal2-radio input {
          margin-right: 0.75rem !important;
          accent-color: #5B6CF5 !important;
          width: 1.2rem !important;
          height: 1.2rem !important;
        }
      </style>
      ¿Cuál es el nuevo estado para <b class="text-white">${playerName}</b> en la <b class="text-white">${weekName}</b>?
    `,
    input: 'radio',
    inputOptions: {
      'logrado': '🟢 Cumplió (Verde)',
      'no_logrado': '🔴 No Cumplió (Rojo)',
      'reciente': '🟣 Ingreso Reciente (Morado)'
    },
    inputValidator: (value) => {
      if (!value) {
        return 'Debes seleccionar un estado';
      }
    },
    showCancelButton: true,
    confirmButtonText: 'Actualizar',
    cancelButtonText: 'Cancelar',
    customClass: {
      popup: 'rounded-[16px] border border-[rgba(255,255,255,0.06)] shadow-2xl',
      title: 'text-[20px] font-semibold text-white tracking-tight',
      htmlContainer: 'text-[14px] text-[#8892AA] mb-4',
      confirmButton: 'bg-[#5B6CF5] hover:bg-[#6B7CF8] text-white font-medium px-5 py-2.5 rounded-xl transition-all border-none outline-none mr-3',
      cancelButton: 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] text-[#8892AA] hover:text-white font-medium px-5 py-2.5 rounded-xl transition-all border border-[rgba(255,255,255,0.1)] outline-none',
    }
  });
  return result.isConfirmed ? result.value : null;
};
