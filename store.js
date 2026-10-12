// Acceso a los datos de la casa. Usa Firestore (en vivo para todos) si hay
// configuración de Firebase; si no, un modo demo que guarda en este dispositivo.
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export const hayFirebase = () => Boolean(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

export async function crearStore(casa) {
  return hayFirebase() ? crearStoreFirebase(casa) : crearStoreLocal(casa);
}

async function crearStoreFirebase(casa) {
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const fs = await import(`${SDK}/firebase-firestore.js`);
  const app = initializeApp(FIREBASE_CONFIG);
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
  const base = `casas/${casa}`;
  const ref = (p) => fs.doc(db, `${base}/${p}`);
  return {
    modo: 'firebase',
    escucharDoc(path, cb) {
      return fs.onSnapshot(ref(path), (s) => cb(s.exists() ? s.data() : null), (e) => console.error(e));
    },
    escucharCol(col, cb) {
      return fs.onSnapshot(fs.collection(db, `${base}/${col}`),
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(e));
    },
    fusionar(path, data) { return fs.setDoc(ref(path), data, { merge: true }); },
    agregar(col, data) { return fs.addDoc(fs.collection(db, `${base}/${col}`), data); },
    borrar(path) { return fs.deleteDoc(ref(path)); },
    async quitarCampo(path, campo) {
      return fs.setDoc(ref(path), { [campo.split('.')[0]]: { [campo.split('.')[1]]: fs.deleteField() } }, { merge: true });
    },
  };
}

// ---------- Modo demo (sin Firebase) ----------
function crearStoreLocal(casa) {
  const CLAVE = `501-demo-${casa}`;
  let datos = {};
  try { datos = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { datos = {}; }
  const oyentes = new Set();
  const guardar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
    queueMicrotask(() => oyentes.forEach((f) => f()));
  };
  const fusionarProfundo = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) a[k] = fusionarProfundo(a[k] && typeof a[k] === 'object' ? a[k] : {}, v);
      else a[k] = v;
    }
    return a;
  };
  const id = () => Math.random().toString(36).slice(2, 12);
  const suscribir = (f) => { oyentes.add(f); queueMicrotask(f); return () => oyentes.delete(f); };
  return {
    modo: 'demo',
    escucharDoc(path, cb) { return suscribir(() => cb(datos[path] ? structuredClone(datos[path]) : null)); },
    escucharCol(col, cb) {
      return suscribir(() => cb(Object.entries(datos)
        .filter(([p]) => p.startsWith(col + '/') && p.split('/').length === 2)
        .map(([p, d]) => ({ id: p.split('/')[1], ...structuredClone(d) }))));
    },
    async fusionar(path, data) { datos[path] = fusionarProfundo(datos[path] || {}, structuredClone(data)); guardar(); },
    async agregar(col, data) { const k = `${col}/${id()}`; datos[k] = structuredClone(data); guardar(); return { id: k }; },
    async borrar(path) { delete datos[path]; guardar(); },
    async quitarCampo(path, campo) {
      const [a, b] = campo.split('.');
      if (datos[path] && datos[path][a]) delete datos[path][a][b];
      guardar();
    },
  };
}
