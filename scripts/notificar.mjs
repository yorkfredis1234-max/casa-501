// Envía las notificaciones de 501. Lo ejecuta GitHub Actions según el horario
// de .github/workflows/notificaciones.yml (hora de Bogotá):
//   aseo          lunes 7:50 p.m.   a cada uno, lo que le toca el martes
//   recordatorio  martes 11:50 a.m. solo a quien no ha visto el aviso ni terminó
//   basura        martes y viernes 6:50 p.m.  a todos
//   avisos        cada 5 minutos    avisos nuevos marcados "Notificar a todos"
//   prueba        manual            una notificación de prueba a todos
//
// Uso: node scripts/notificar.mjs <modo>
// Prueba sin Firebase: DRY_RUN=1 DATOS_PRUEBA=datos.json AHORA=2026-10-13T00:50:00Z node scripts/notificar.mjs aseo
import { readFileSync } from 'node:fs';
import { PERSONAS, BASURA } from '../config.js';
import { asignacion, martesActual, proximaBasura, diaSemana, fechaLarga, DIAS } from '../logica.js';

const HORARIOS = {
  '50 0 * * 2': 'aseo',
  '50 16 * * 2': 'recordatorio',
  '50 23 * * 2,5': 'basura',
  '*/5 * * * *': 'avisos',
};
const modo = (process.argv[2] || '').trim() || HORARIOS[(process.argv[3] || '').trim()];
const AHORA = process.env.AHORA ? new Date(process.env.AHORA) : new Date();
const DRY = process.env.DRY_RUN === '1';
const enviados = [];

// ---------- datos ----------
async function abrirDatos() {
  if (DRY) {
    const datos = process.env.DATOS_PRUEBA ? JSON.parse(readFileSync(process.env.DATOS_PRUEBA, 'utf8')) : {};
    return {
      async doc(path) { return datos[path] || null; },
      async avisosPendientes() {
        return Object.entries(datos).filter(([p, d]) => p.startsWith('avisos/') && d.notificar && !d.notificado)
          .map(([p, d]) => ({ id: p.split('/')[1], ...d }));
      },
      async fusionar(path, d) { datos[path] = { ...(datos[path] || {}), ...d }; console.log(`  [datos] ${path} ←`, JSON.stringify(d)); },
      async quitarDispositivo(nombre, clave) { console.log(`  [datos] quitar dispositivo ${clave} de ${nombre}`); },
    };
  }
  const casa = process.env.CASA_CODIGO;
  if (!casa) throw new Error('Falta el secreto CASA_CODIGO en GitHub.');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT en GitHub.');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = getFirestore();
  const base = `casas/${casa}`;
  return {
    async doc(path) { const s = await db.doc(`${base}/${path}`).get(); return s.exists ? s.data() : null; },
    async avisosPendientes() {
      const s = await db.collection(`${base}/avisos`).where('notificar', '==', true).where('notificado', '==', false).get();
      return s.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async fusionar(path, d) { await db.doc(`${base}/${path}`).set(d, { merge: true }); },
    async quitarDispositivo(nombre, clave) {
      await db.doc(`${base}/subs/${nombre}`).update({ [`dispositivos.${clave}`]: FieldValue.delete() });
    },
  };
}

// ---------- envío ----------
let webpush = null;
async function prepararEnvio() {
  if (DRY) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CONTACTO } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('Faltan los secretos VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en GitHub.');
  webpush = (await import('web-push')).default;
  webpush.setVapidDetails(CONTACTO || 'mailto:casa501@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function enviarA(datos, nombre, mensaje) {
  const subs = await datos.doc(`subs/${nombre}`);
  const dispositivos = Object.entries((subs && subs.dispositivos) || {});
  if (!dispositivos.length) { console.log(`- ${nombre}: no ha activado notificaciones`); return 0; }
  let ok = 0;
  for (const [clave, sub] of dispositivos) {
    if (DRY) { enviados.push({ nombre, ...mensaje }); console.log(`→ ${nombre}: «${mensaje.title}» ${mensaje.body}`); ok++; continue; }
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(mensaje), { TTL: 6 * 3600, urgency: 'high' });
      ok++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        console.log(`- ${nombre}: un celular ya no recibe notificaciones, se quita de la lista`);
        await datos.quitarDispositivo(nombre, clave);
      } else {
        console.error(`! ${nombre}: error ${e.statusCode || ''} ${e.body || e.message}`);
      }
    }
  }
  if (!DRY) console.log(`→ ${nombre}: enviada a ${ok} de ${dispositivos.length} celular(es)`);
  return ok;
}

// ---------- modos ----------
const modos = {
  async aseo(datos) {
    const martes = martesActual(AHORA);
    console.log(`Aseo del ${fechaLarga(martes)}`);
    for (const { tarea, persona } of asignacion(martes)) {
      await enviarA(datos, persona, {
        title: 'Mañana toca aseo',
        body: `${persona}, te toca: ${tarea.nombre} (${tarea.detalle.toLowerCase()}). Márcalo en 501 cuando termines.`,
        tag: `aseo-${martes}`,
        url: './?abrir=aseo',
      });
    }
  },
  async recordatorio(datos) {
    const martes = martesActual(AHORA);
    const doc = (await datos.doc(`aseo/${martes}`)) || {};
    console.log(`Recordatorio del ${fechaLarga(martes)}`);
    for (const { tarea, persona } of asignacion(martes)) {
      if (doc.hecho && doc.hecho[persona]) { console.log(`- ${persona}: ya terminó`); continue; }
      if (doc.visto && doc.visto[persona]) { console.log(`- ${persona}: ya vio el aviso`); continue; }
      await enviarA(datos, persona, {
        title: 'Recordatorio: hoy toca aseo',
        body: `${persona}, hoy te toca: ${tarea.nombre}. Márcalo en 501 cuando termines.`,
        tag: `aseo-${martes}`,
        url: './?abrir=aseo',
      });
    }
  },
  async basura(datos) {
    // Corre la noche antes de que pase el camión.
    const manana = new Date(AHORA.getTime() + 6 * 3600000);
    const b = proximaBasura(manana);
    const dia = DIAS[diaSemana(b.iso)];
    console.log(`Basura: pasa el ${dia} ${b.iso}`);
    for (const p of PERSONAS) {
      await enviarA(datos, p.nombre, {
        title: 'Saquen la basura esta noche',
        body: `El camión pasa mañana ${dia} a las ${BASURA.hora}`,
        tag: `basura-${b.iso}`,
        url: './',
      });
    }
  },
  async avisos(datos) {
    const pendientes = await datos.avisosPendientes();
    if (!pendientes.length) { console.log('No hay avisos nuevos.'); return; }
    for (const a of pendientes) {
      // Avisos de hace más de un día (por ejemplo, si GitHub estuvo caído) ya no se notifican.
      if (AHORA.getTime() - (a.creado || 0) < 24 * 3600000) {
        const texto = a.texto.length > 180 ? a.texto.slice(0, 177) + '…' : a.texto;
        for (const p of PERSONAS) {
          if (p.nombre === a.autor) continue;
          await enviarA(datos, p.nombre, { title: `Aviso de ${a.autor}`, body: texto, tag: `aviso-${a.id}`, url: './?abrir=avisos' });
        }
      }
      await datos.fusionar(`avisos/${a.id}`, { notificado: true });
    }
  },
  async prueba(datos) {
    for (const p of PERSONAS) {
      await enviarA(datos, p.nombre, { title: '501 funciona', body: `Hola ${p.nombre}, así te van a llegar los avisos de la casa.`, tag: 'prueba', url: './' });
    }
  },
};

if (!modos[modo]) {
  console.error(`Modo desconocido: "${modo}". Usa: ${Object.keys(modos).join(', ')}`);
  process.exit(1);
}
const datos = await abrirDatos();
await prepararEnvio();
await modos[modo](datos);
if (DRY) console.log(`(simulación: ${enviados.length} notificaciones)`);
process.exit(0);
