// Configuración de la casa 501.
// Si llega un roomie nuevo, agrégalo a PERSONAS y la rotación se recalcula sola.

export const PERSONAS = [
  { nombre: 'York',    color: 'azul' },
  { nombre: 'Angeles', color: 'naranja' },
  { nombre: 'Juanchy', color: 'verde' },
  { nombre: 'Ani',     color: 'rosado' },
];

// Tareas de aseo de los martes, en orden.
export const TAREAS = [
  { id: 'barrer',  nombre: 'Barrer',          detalle: 'Toda la casa' },
  { id: 'trapear', nombre: 'Trapear',         detalle: 'Después de barrer' },
  { id: 'nevera',  nombre: 'Nevera y cocina', detalle: 'Limpiar y botar lo vencido' },
];

// Primer martes de la rotación: ese día a la persona 1 le toca la tarea 1,
// a la persona 2 la tarea 2, etc. Cada semana todo se corre un puesto.
export const ANCLA = '2026-10-13';

// Turnos de lavadora (0 = domingo … 6 = sábado). La ropa se recoge DIAS_RECOGER días después.
export const LAVADO = {
  turnos: [
    { persona: 'York',    dia: 3 }, // miércoles → recoge el viernes
    { persona: 'Ani',    dia: 3 }, // miércoles → recoge el viernes
    { persona: 'Angeles', dia: 6 }, // sábado → recoge el lunes
    { persona: 'Juanchy', dia: 6 }, // sábado → recoge el lunes
  ],
  diasRecoger: 2,
  // Horas de los avisos (el horario real está en .github/workflows/notificaciones.yml)
  horaLavar: '7:00 a.m.',
  horaRecoger: '5:00 p.m.',
};

// Días en que pasa el camión de la basura (0 = domingo … 6 = sábado) y hora.
export const BASURA = { dias: [3, 6], hora: '6:00 a.m.' };
