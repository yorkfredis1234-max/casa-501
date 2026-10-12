// Lógica pura de 501: fechas en hora de Bogotá, rotación del aseo y basura.
// La usan la app (navegador) y el script de notificaciones (Node).
import { PERSONAS, TAREAS, ANCLA, BASURA } from './config.js';

const DIA = 86400000;
const OFFSET_BOGOTA = -5 * 3600000; // Colombia no cambia de horario

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha y hora actuales en Bogotá. */
export function ahoraBogota(ahora = new Date()) {
  const t = new Date(ahora.getTime() + OFFSET_BOGOTA);
  return {
    iso: t.toISOString().slice(0, 10),
    dow: t.getUTCDay(),
    hora: t.getUTCHours(),
    minuto: t.getUTCMinutes(),
    mes: t.toISOString().slice(0, 7),
  };
}

const aMs = (iso) => Date.parse(iso + 'T00:00:00Z');
const aIso = (ms) => new Date(ms).toISOString().slice(0, 10);

export function sumarDias(iso, n) { return aIso(aMs(iso) + n * DIA); }
export function diaSemana(iso) { return new Date(aMs(iso)).getUTCDay(); }

/** "martes 13 de octubre" */
export function fechaLarga(iso) {
  const d = new Date(aMs(iso));
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}
/** "13 oct" */
export function fechaCorta(iso) {
  const d = new Date(aMs(iso));
  return `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`;
}

/** Semanas transcurridas desde el martes ancla. */
export function semanaDe(isoMartes) {
  return Math.round((aMs(isoMartes) - aMs(ANCLA)) / (7 * DIA));
}

const mod = (a, n) => ((a % n) + n) % n;

/**
 * Quién hace qué un martes dado. Con 3 personas y 3 tareas cada uno rota
 * una tarea por semana. Si hay más personas que tareas, a los que sobran
 * les toca descansar esa semana (también rotando).
 */
export function asignacion(isoMartes, personas = PERSONAS, tareas = TAREAS) {
  const k = semanaDe(isoMartes);
  const n = personas.length;
  return tareas.map((tarea, i) => ({ tarea, persona: personas[mod(i - k, n)].nombre }));
}

/** El martes de aseo que la app muestra como "esta semana". */
export function martesActual(ahora = new Date()) {
  const { iso, dow } = ahoraBogota(ahora);
  if (dow === 2) return iso;            // hoy es martes
  if (dow === 3) return sumarDias(iso, -1); // miércoles: aún se ve el de ayer
  return sumarDias(iso, mod(2 - dow, 7));
}

/** Próxima recogida de basura: { iso, avisoIso } (el aviso es la noche anterior). */
export function proximaBasura(ahora = new Date()) {
  const { iso, dow, hora } = ahoraBogota(ahora);
  for (let i = 0; i < 8; i++) {
    const dia = mod(dow + i, 7);
    if (!BASURA.dias.includes(dia)) continue;
    if (i === 0 && hora >= 6) continue; // ya pasó el camión hoy
    const recogida = sumarDias(iso, i);
    return { iso: recogida, avisoIso: sumarDias(recogida, -1), enDias: i };
  }
  return null;
}

/** ¿Hay que marcar como "visto" el aviso de aseo al abrir la app? (lunes desde las 7 p.m. o martes) */
export function ventanaVistoAseo(ahora = new Date()) {
  const { dow, hora } = ahoraBogota(ahora);
  return dow === 2 || (dow === 1 && hora >= 19);
}

/** Saldos de gastos compartidos: positivo = le deben; negativo = debe. */
export function saldos(gastos, personas = PERSONAS) {
  const s = Object.fromEntries(personas.map((p) => [p.nombre, 0]));
  for (const g of gastos) {
    if (g.saldado) continue;
    const entre = (g.entre && g.entre.length ? g.entre : personas.map((p) => p.nombre))
      .filter((n) => n in s);
    if (!(g.pago in s) || !entre.length) continue;
    const parte = g.valor / entre.length;
    s[g.pago] += g.valor;
    for (const n of entre) s[n] -= parte;
  }
  return s;
}

/** Convierte saldos en una lista corta de pagos: [{de, a, valor}] */
export function deudas(saldosPorPersona) {
  const deudores = [], acreedores = [];
  for (const [nombre, v] of Object.entries(saldosPorPersona)) {
    const r = Math.round(v);
    if (r < 0) deudores.push({ nombre, v: -r });
    else if (r > 0) acreedores.push({ nombre, v: r });
  }
  deudores.sort((a, b) => b.v - a.v);
  acreedores.sort((a, b) => b.v - a.v);
  const pagos = [];
  let i = 0, j = 0;
  while (i < deudores.length && j < acreedores.length) {
    const m = Math.min(deudores[i].v, acreedores[j].v);
    if (m >= 1) pagos.push({ de: deudores[i].nombre, a: acreedores[j].nombre, valor: m });
    deudores[i].v -= m; acreedores[j].v -= m;
    if (deudores[i].v < 1) i++;
    if (acreedores[j].v < 1) j++;
  }
  return pagos;
}
