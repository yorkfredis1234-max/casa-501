// 501 · app de la casa
import { PERSONAS, TAREAS, BASURA } from './config.js';
import {
  ahoraBogota, asignacion, martesActual, proximaBasura, sumarDias, diaSemana, fechaLarga,
  fechaCorta, ventanaVistoAseo, saldos, deudas, DIAS,
} from './logica.js';
import { crearStore, hayFirebase } from './store.js';
import { VAPID_PUBLIC_KEY } from './firebase-config.js';

// ---------- utilidades ----------
const guardado = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* nada */ } },
  quitar(k) { try { localStorage.removeItem(k); } catch { /* nada */ } },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const persona = (nombre) => PERSONAS.find((p) => p.nombre === nombre) || { nombre: nombre || '?', color: 'azul' };
const avatar = (nombre, tam = '') => {
  const p = persona(nombre);
  return `<span class="avatar ${tam} c-${p.color}" aria-hidden="true">${esc(p.nombre[0])}</span>`;
};
const pesos = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
const hora = (ms) => new Date(ms).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
function hace(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
const listaNombres = (ns) => ns.length <= 1 ? ns.join('') : `${ns.slice(0, -1).join(', ')} y ${ns[ns.length - 1]}`;
const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const I = {
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  izq: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  der: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  basura: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F2C14E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  wa: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7FD6A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.5-4A8 8 0 1 1 8 19z"/></svg>',
  casa: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  escoba: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3l-3 8"/><path d="M7 11h9l2 10H5z"/><path d="M10 15v6M14 15v6"/></svg>',
  campana: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  billete: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>',
  circulo: '<span aria-hidden="true" style="width:26px;height:26px;border-radius:50%;border:2px solid var(--borde);flex-shrink:0"></span>',
  circuloOk: '<span aria-hidden="true" style="width:26px;height:26px;border-radius:50%;background:var(--ok-fondo);color:var(--ok-tinta);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span>',
};

// ---------- estado ----------
const estado = {
  casa: guardado.get('501-casa'),
  yo: guardado.get('501-yo'),
  pestana: 'hoy',
  offset: 0,
  aseo: {}, avisos: [], servicios: [], gastos: [], subs: {},
  hoja: null, confirmar: null, cargado: false,
};
let store = null;
let pendiente = false;
const params = new URLSearchParams(location.search);
if (['hoy', 'aseo', 'avisos', 'cuentas'].includes(params.get('abrir'))) estado.pestana = params.get('abrir');
if (params.get('casa') && !estado.casa) estado.casa = params.get('casa');

// ---------- arranque ----------
async function iniciar() {
  if (estado.casa) await conectar();
  render();
}

async function conectar() {
  store = await crearStore(estado.casa);
  store.escucharCol('aseo', (docs) => { estado.aseo = Object.fromEntries(docs.map((d) => [d.id, d])); estado.cargado = true; alCambiar(); });
  store.escucharCol('avisos', (docs) => { estado.avisos = docs; alCambiar(); });
  store.escucharCol('servicios', (docs) => { estado.servicios = docs; alCambiar(); });
  store.escucharCol('gastos', (docs) => { estado.gastos = docs; alCambiar(); });
  store.escucharCol('subs', (docs) => { estado.subs = Object.fromEntries(docs.map((d) => [d.id, d])); alCambiar(); });
}

function alCambiar() {
  marcarVistos();
  render();
}

// Al abrir la app cuenta como "visto": el aviso del aseo (lunes noche o martes) y los avisos en pantalla.
function marcarVistos() {
  if (!store || !estado.yo || document.visibilityState !== 'visible') return;
  const martes = martesActual();
  const a = estado.aseo[martes];
  const meToca = asignacion(martes).some((x) => x.persona === estado.yo);
  if (meToca && ventanaVistoAseo() && !(a && a.visto && a.visto[estado.yo])) {
    store.fusionar(`aseo/${martes}`, { visto: { [estado.yo]: Date.now() } });
  }
  if (estado.pestana === 'avisos') {
    for (const av of estado.avisos) {
      if (av.autor !== estado.yo && !(av.visto && av.visto[estado.yo])) {
        store.fusionar(`avisos/${av.id}`, { visto: { [estado.yo]: Date.now() } });
      }
    }
  }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') alCambiar(); });

// ---------- render ----------
const raiz = document.getElementById('raiz');
const barra = document.getElementById('barra');
const capa = document.getElementById('capa');

function editando() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.type !== 'checkbox';
}
document.addEventListener('focusout', () => setTimeout(() => { if (pendiente && !editando()) render(); }, 0));

function render() {
  if (editando()) { pendiente = true; return; }
  pendiente = false;
  if (!estado.casa || !store) { barra.hidden = true; raiz.innerHTML = vistaCodigo(); capa.innerHTML = ''; return; }
  if (!estado.yo) { barra.hidden = true; raiz.innerHTML = vistaElegir(); capa.innerHTML = ''; return; }
  const vistas = { hoy: vistaHoy, aseo: vistaAseo, avisos: vistaAvisos, cuentas: vistaCuentas };
  raiz.innerHTML = vistas[estado.pestana]();
  barra.hidden = false;
  barra.innerHTML = vistaBarra();
  capa.innerHTML = estado.hoja ? `<div class="hoja-fondo" data-accion="cerrar-hoja"><div class="hoja" role="dialog" aria-modal="true">${hojas[estado.hoja]()}</div></div>` : '';
}

function vistaBarra() {
  const sinLeer = avisosSinLeer().length;
  const tabs = [
    ['hoy', 'Hoy', I.casa], ['aseo', 'Aseo', I.escoba],
    ['avisos', 'Avisos', I.campana], ['cuentas', 'Cuentas', I.billete],
  ];
  return `<div class="pestanas">${tabs.map(([id, txt, ic]) => `
    <button data-accion="pestana" data-id="${id}" ${estado.pestana === id ? 'aria-current="page"' : ''}>
      ${ic}${txt}${id === 'avisos' && sinLeer ? `<span class="punto" aria-label="${sinLeer} sin leer">${sinLeer}</span>` : ''}
    </button>`).join('')}</div>`;
}

const avisosSinLeer = () => estado.avisos.filter((a) => a.autor !== estado.yo && !(a.visto && a.visto[estado.yo]));
const avisosOrdenados = () => [...estado.avisos].sort((a, b) => (b.fijado ? 1 : 0) - (a.fijado ? 1 : 0) || (b.creado || 0) - (a.creado || 0));

function cabecera(eyebrow, titulo, marca = false) {
  return `<header class="cabecera">
    <div class="cabecera-texto"><div class="eyebrow">${esc(eyebrow)}</div><h1 class="${marca ? 'marca' : ''}">${esc(titulo)}</h1></div>
    <button class="avatares" data-accion="hoja" data-id="personas" aria-label="Personas y ajustes">
      ${PERSONAS.map((p) => `<span class="avatar c-${p.color}${p.nombre === estado.yo ? ' yo' : ''}">${esc(p.nombre[0])}</span>`).join('')}
    </button>
  </header>`;
}

function bannerNotificaciones() {
  if (!estado.yo || estado.subs[estado.yo]?.dispositivos && guardado.get('501-notif') === 'si') return '';
  if (esIOS() && !instalada()) {
    return `<div class="banner"><b>Instala 501 para recibir notificaciones</b>
      <p>En Safari toca el botón Compartir y luego "Agregar a inicio". Después abre 501 desde el ícono.</p></div>`;
  }
  if (!('Notification' in window)) return '';
  if (Notification.permission === 'denied') {
    return `<div class="banner"><b>Las notificaciones están bloqueadas</b><p>Actívalas en Ajustes › Notificaciones › 501.</p></div>`;
  }
  return `<div class="banner"><b>Activa las notificaciones</b>
    <p>Te avisamos qué te toca el martes, cuándo sacar la basura y los avisos de la casa.</p>
    <button class="btn lleno" data-accion="activar-notif">Activar notificaciones</button></div>`;
}

// ---------- Hoy ----------
function vistaHoy() {
  const ahora = ahoraBogota();
  const martes = martesActual();
  const asig = asignacion(martes);
  const doc = estado.aseo[martes] || {};
  const hechos = asig.filter((x) => doc.hecho && doc.hecho[x.persona]).length;
  const tituloAseo = martes === ahora.iso ? 'Hoy toca aseo' : sumarDias(ahora.iso, 1) === martes ? 'Mañana toca aseo' : diaSemana(ahora.iso) === 3 ? 'Aseo de ayer' : 'Próximo aseo';
  const b = proximaBasura();
  const tituloBasura = b.enDias === 0 ? `Hoy pasa la basura, ${BASURA.hora}` : b.enDias === 1 ? `Basura: mañana ${BASURA.hora}` : `Basura: ${DIAS[diaSemana(b.iso)]} ${BASURA.hora}`;
  const avisoBasura = b.avisoIso === ahora.iso ? 'Aviso hoy\n7:00 p.m.' : `Aviso ${DIAS[diaSemana(b.avisoIso)].slice(0, 3)}\n7:00 p.m.`;
  const pagar = serviciosPorPagar().length;
  const ultimo = avisosOrdenados().filter((a) => !a.fijado)[0];
  const sinLeer = avisosSinLeer().length;
  return `
    ${cabecera(fechaLarga(ahora.iso), '501', true)}
    ${bannerNotificaciones()}
    <button class="tarjeta mini" style="gap:14px;padding:18px" data-accion="pestana" data-id="aseo">
      <div class="tarjeta-cab" style="width:100%">
        <div><h2>${tituloAseo}</h2><span class="sub">${esc(fechaLarga(martes))}</span></div>
        <span class="pill ${hechos === asig.length ? 'ok' : 'pend'}">${hechos} de ${asig.length}</span>
      </div>
      <div class="lista" style="width:100%">
        ${asig.map((x) => `<div class="fila">${avatar(x.persona, 'p')}
          <div class="fila-texto"><b>${esc(x.tarea.nombre)}</b><span class="sub">${esc(x.persona)}${x.persona === estado.yo ? ' · tú' : ''}</span></div>
          ${doc.hecho && doc.hecho[x.persona] ? I.circuloOk : I.circulo}</div>`).join('')}
      </div>
    </button>
    <div class="tarjeta oscura" style="flex-direction:row;align-items:center">
      <div class="icono-caja">${I.basura}</div>
      <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0">
        <b style="font-size:16px">${esc(tituloBasura)}</b>
        <span class="tenue-oscuro">Pasa miércoles y sábado · sacarla la noche antes</span>
      </div>
      <div class="amarillo" style="white-space:pre-line">${avisoBasura}</div>
    </div>
    <div class="rejilla-2">
      <button class="tarjeta mini" data-accion="pestana" data-id="avisos">
        <span class="etiqueta">Avisos</span><span class="num">${sinLeer}</span>
        <span class="sub">${sinLeer === 1 ? 'aviso sin leer' : 'avisos sin leer'}</span>
      </button>
      <button class="tarjeta mini" data-accion="pestana" data-id="cuentas">
        <span class="etiqueta">Cuentas</span><span class="num">${pagar}</span>
        <span class="sub">${pagar === 1 ? 'servicio por pagar este mes' : 'servicios por pagar este mes'}</span>
      </button>
    </div>
    ${ultimo ? `<button class="tarjeta mini nota" data-accion="pestana" data-id="avisos">
      <div class="aviso-meta" style="width:100%"><span>Último aviso</span><span>${esc(ultimo.autor)} · ${hace(ultimo.creado)}</span></div>
      <span class="aviso-texto">${esc(ultimo.texto)}</span></button>` : ''}
    ${store.modo === 'demo' ? '<p class="sub" style="text-align:center">Modo demo: los datos se guardan solo en este dispositivo hasta que conectes Firebase.</p>' : ''}
  `;
}

// ---------- Aseo ----------
function vistaAseo() {
  const base = martesActual();
  const martes = sumarDias(base, estado.offset * 7);
  const asig = asignacion(martes);
  const doc = estado.aseo[martes] || {};
  const etiquetaSemana = estado.offset === 0 ? 'Esta semana · se ve en vivo' : estado.offset < 0 ? 'Semana pasada' + (estado.offset < -1 ? 's' : '') : 'Próximamente';
  const futuras = [1, 2, 3].map((i) => sumarDias(martes, i * 7));
  const mensaje = `Aseo del ${fechaLarga(martes)}:\n${asig.map((x) => `${x.tarea.nombre}: ${x.persona}`).join('\n')}\nMarquen en 501 cuando terminen.`;
  return `
    ${cabecera('Cada martes · rota cada semana', 'Aseo')}
    <div class="semana">
      <button class="circulo" data-accion="semana" data-d="-1" aria-label="Semana anterior">${I.izq}</button>
      <div><b>${esc(fechaLarga(martes).replace(/^./, (c) => c.toUpperCase()))}</b><span class="sub">${etiquetaSemana}</span></div>
      <button class="circulo" data-accion="semana" data-d="1" aria-label="Semana siguiente">${I.der}</button>
    </div>
    <div class="lista">
      ${asig.map((x) => {
        const hecho = doc.hecho && doc.hecho[x.persona];
        const visto = doc.visto && doc.visto[x.persona];
        const mia = x.persona === estado.yo;
        let estadoTxt = `<span class="sub">${esc(x.persona)} · ${esc(x.tarea.detalle)}</span>`;
        if (hecho) estadoTxt = `<span class="sub">${esc(x.persona)} · terminó ${hora(hecho)}</span>`;
        else if (estado.offset === 0 && visto) estadoTxt = `<span class="sub estado-ok">${esc(x.persona)} · vio el aviso ${hora(visto)}</span>`;
        else if (estado.offset === 0 && ventanaVistoAseo()) estadoTxt = `<span class="sub estado-pend">${esc(x.persona)} · sin ver${ahoraBogota().dow === 2 && ahoraBogota().hora < 12 ? ' · recordatorio a las 12 m.' : ''}</span>`;
        let boton;
        if (hecho) boton = `<button class="btn hecho chico" data-accion="hecho" data-fecha="${martes}" data-p="${esc(x.persona)}" ${mia ? '' : 'disabled'} aria-label="${mia ? 'Hecho. Toca para desmarcar' : 'Hecho'}">${I.check}Hecho</button>`;
        else if (mia) boton = `<button class="btn chico" data-accion="hecho" data-fecha="${martes}" data-p="${esc(x.persona)}">Marcar hecho</button>`;
        else boton = `<span class="pill gris">Pendiente</span>`;
        return `<div class="item fila ${mia ? 'mia' : ''}">${avatar(x.persona, 'g')}
          <div class="fila-texto"><b style="font-size:16px">${esc(x.tarea.nombre)}</b>${estadoTxt}</div>${boton}</div>`;
      }).join('')}
    </div>
    <div class="tarjeta">
      <span class="etiqueta">Próximas semanas</span>
      <div class="tabla-rot" style="--cols:${TAREAS.length}">
        <span></span>${TAREAS.map((t) => `<span class="cab">${esc(t.nombre.split(' ')[0])}</span>`).join('')}
        ${futuras.map((f) => `<b>${fechaCorta(f)}</b>${asignacion(f).map((x) => `<span class="t-${persona(x.persona).color}">${esc(x.persona)}</span>`).join('')}`).join('')}
      </div>
    </div>
    <div class="tarjeta oscura">
      <div class="tarjeta-cab"><b style="display:flex;align-items:center;gap:8px">${I.wa}Mensaje para el grupo</b></div>
      <div class="burbuja">${esc(mensaje)}</div>
      <a class="btn lleno" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="https://wa.me/?text=${encodeURIComponent(mensaje)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
    </div>`;
}

// ---------- Avisos ----------
function vistaAvisos() {
  const otros = PERSONAS.filter((p) => p.nombre !== estado.yo).map((p) => p.nombre);
  const lista = avisosOrdenados();
  return `
    ${cabecera('Les llega a todos al celular', 'Avisos')}
    <form class="tarjeta" data-form="aviso">
      <div class="campo"><label for="aviso-texto">Nuevo aviso</label>
        <textarea id="aviso-texto" name="texto" class="entrada" rows="2" maxlength="500" required placeholder="Ej: Mañana cortan el agua de 8 a 12."></textarea></div>
      <label class="interruptor"><span class="fila-texto"><b>Notificar a todos</b><span class="sub">${esc(listaNombres(otros))} reciben una notificación</span></span>
        <input type="checkbox" id="aviso-notificar" name="notificar" checked><span class="riel"></span></label>
      <label class="interruptor"><span class="fila-texto"><b>Fijar arriba</b><span class="sub">Para cosas que siempre se consultan, como la clave del wifi</span></span>
        <input type="checkbox" id="aviso-fijar" name="fijado"><span class="riel"></span></label>
      <button class="btn lleno" type="submit">Publicar aviso</button>
    </form>
    <div class="lista">
      ${lista.length ? lista.map((a) => {
        const vistos = Object.keys(a.visto || {}).filter((n) => n !== a.autor);
        const faltan = PERSONAS.map((p) => p.nombre).filter((n) => n !== a.autor && !vistos.includes(n));
        let estadoTxt = a.notificar ? (faltan.length === 0 ? 'Todos lo vieron' : vistos.length ? `Visto por ${listaNombres(vistos)}` : (a.notificado ? 'Notificación enviada' : 'Enviando notificación…')) : 'Sin notificación';
        const mio = a.autor === estado.yo;
        const confirmando = estado.confirmar === `aviso-${a.id}`;
        return `<article class="tarjeta aviso ${a.fijado ? 'fijado' : 'nota'}" style="gap:8px;padding:14px">
          <div class="aviso-meta"><span>${esc(a.autor)} · ${a.fijado ? 'fijado' : hace(a.creado)}</span><span>${esc(estadoTxt)}</span></div>
          <div class="aviso-texto">${esc(a.texto)}</div>
          ${mio ? `<div class="acciones">
            <button class="btn chico suave" data-accion="fijar" data-id="${a.id}">${a.fijado ? 'Desfijar' : 'Fijar'}</button>
            <button class="btn chico ${confirmando ? 'peligro' : 'suave'}" data-accion="borrar-aviso" data-id="${a.id}">${confirmando ? '¿Borrar? Toca otra vez' : 'Borrar'}</button>
          </div>` : ''}
        </article>`;
      }).join('') : '<p class="vacio">Todavía no hay avisos. El primero que publiques le llega a todos.</p>'}
    </div>`;
}

// ---------- Cuentas ----------
function serviciosPorPagar() {
  const mes = ahoraBogota().mes;
  return estado.servicios.filter((s) => !(s.pagado && s.pagado[mes]));
}
function vistaCuentas() {
  const mes = ahoraBogota().mes;
  const mesNombre = new Date(mes + '-15').toLocaleDateString('es-CO', { month: 'long' });
  const pend = estado.gastos.filter((g) => !g.saldado).sort((a, b) => (b.creado || 0) - (a.creado || 0));
  const pagos = deudas(saldos(pend));
  const servicios = [...estado.servicios].sort((a, b) => (a.dia || 99) - (b.dia || 99));
  const conf = estado.confirmar;
  return `
    ${cabecera(`${mesNombre.replace(/^./, (c) => c.toUpperCase())} · dividido entre ${PERSONAS.length}`, 'Cuentas')}
    <div class="tarjeta oscura" style="gap:10px">
      <span class="etiqueta" style="color:var(--sobre-oscuro-tenue)">Quién le debe a quién</span>
      ${pagos.length ? pagos.map((p) => `<div class="deuda"><span class="t-${persona(p.de).color}" style="filter:brightness(1.6)">${esc(p.de)}</span><span class="tenue-oscuro">le debe a</span><span class="t-${persona(p.a).color}" style="filter:brightness(1.6)">${esc(p.a)}</span><span class="valor">${pesos(p.valor)}</span></div>`).join('')
        : '<span>Están a paz y salvo.</span>'}
    </div>
    <div class="tarjeta lista-servicios">
      ${servicios.length ? servicios.map((s) => {
        const pago = s.pagado && s.pagado[mes];
        const c = conf === `serv-${s.id}`;
        return `<div class="servicio">
          <div class="fila-texto"><b>${esc(s.nombre)}</b>
            <span class="sub">${s.dia ? `Vence el ${s.dia}` : 'Sin fecha'}${pago ? ` · pagó ${esc(pago.por)}` : s.responsable ? ` · le toca a ${esc(s.responsable)}` : ''}</span></div>
          <button class="pill ${pago ? 'ok' : 'pend'}" style="border:none;min-height:36px" data-accion="pagar" data-id="${s.id}" aria-label="${esc(s.nombre)}: ${pago ? 'pagado, toca para desmarcar' : 'por pagar, toca para marcar pagado'}">${pago ? 'Pagado' : 'Por pagar'}</button>
          <button class="btn chico ${c ? 'peligro' : 'suave'}" style="padding:0 10px" data-accion="borrar-serv" data-id="${s.id}" aria-label="Quitar ${esc(s.nombre)}">${c ? '¿Quitar?' : '×'}</button>
        </div>`;
      }).join('') : '<p class="vacio">Agrega el arriendo y los servicios para llevar la cuenta de qué falta pagar.</p>'}
    </div>
    <div class="rejilla-2">
      <button class="btn suave" data-accion="hoja" data-id="servicio">Agregar servicio</button>
      <button class="btn oscuro" data-accion="hoja" data-id="gasto">Registrar gasto</button>
    </div>
    <div class="tarjeta" style="gap:10px">
      <div class="tarjeta-cab"><div><h2>Gastos compartidos</h2><span class="sub">Se dividen en partes iguales</span></div></div>
      ${pend.length ? pend.map((g) => {
        const c = conf === `gasto-${g.id}`;
        return `<div class="fila" style="min-height:52px">${avatar(g.pago, 'p')}
          <div class="fila-texto"><b>${esc(g.desc)}</b><span class="sub">Pagó ${esc(g.pago)} · ${hace(g.creado)}</span></div>
          <b style="font-variant-numeric:tabular-nums">${pesos(g.valor)}</b>
          <button class="btn chico ${c ? 'peligro' : 'suave'}" style="padding:0 10px" data-accion="borrar-gasto" data-id="${g.id}" aria-label="Borrar ${esc(g.desc)}">${c ? '¿Borrar?' : '×'}</button>
        </div>`;
      }).join('') : '<p class="vacio" style="padding:8px">No hay gastos pendientes.</p>'}
      ${pend.length ? `<button class="btn ${conf === 'saldar' ? 'peligro' : 'suave'} ancho" data-accion="saldar">${conf === 'saldar' ? 'Ya se pagaron todos. ¿Confirmar?' : 'Saldar cuentas (ya nos pagamos)'}</button>` : ''}
    </div>`;
}

// ---------- hojas ----------
const opcionesPersonas = (sel) => PERSONAS.map((p) => `<option ${p.nombre === sel ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('');
const hojas = {
  personas() {
    const urlApp = location.origin + location.pathname;
    const invitacion = `Únete a la app de la casa 501: ${urlApp}\nCódigo de la casa: ${estado.casa}\nEn iPhone ábrela en Safari, toca Compartir › Agregar a inicio, y abre 501 desde el ícono.`;
    return `
      <div class="tarjeta-cab"><h2>Personas</h2><button class="btn chico suave" data-accion="cerrar-hoja">Cerrar</button></div>
      <div class="tarjeta lista-servicios">
        ${PERSONAS.map((p) => {
          const tiene = estado.subs[p.nombre] && Object.keys(estado.subs[p.nombre].dispositivos || {}).length;
          return `<div class="servicio">${avatar(p.nombre)}
            <div class="fila-texto"><b>${esc(p.nombre)}${p.nombre === estado.yo ? ' (tú)' : ''}</b>
            <span class="sub ${tiene ? 'estado-ok' : ''}">${tiene ? 'Notificaciones activas' : 'Sin notificaciones'}</span></div></div>`;
        }).join('')}
      </div>
      ${bannerNotificaciones() || '<button class="btn suave" data-accion="activar-notif">Volver a activar notificaciones en este celular</button>'}
      <div class="tarjeta" style="gap:10px">
        <span class="etiqueta">Código de la casa</span>
        <div class="codigo">${esc(estado.casa)}</div>
        <div class="rejilla-2">
          <button class="btn suave" data-accion="copiar" data-texto="${esc(estado.casa)}">Copiar código</button>
          <a class="btn lleno" style="display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:14px" href="https://wa.me/?text=${encodeURIComponent(invitacion)}" target="_blank" rel="noopener">Invitar por WhatsApp</a>
        </div>
        <span class="sub">Quien tenga este código puede ver y editar la casa. Compártelo solo con los roomies.</span>
      </div>
      <button class="btn suave" data-accion="cambiar-yo">No soy ${esc(estado.yo)}, cambiar de persona</button>
      ${store.modo === 'demo' ? '<p class="sub">Modo demo: falta pegar la configuración de Firebase (paso 1 de la guía).</p>' : ''}`;
  },
  servicio() {
    return `<form class="lista" data-form="servicio">
      <div class="tarjeta-cab"><h2>Agregar servicio</h2><button type="button" class="btn chico suave" data-accion="cerrar-hoja">Cerrar</button></div>
      <div class="campo"><label for="serv-nombre">Nombre</label><input id="serv-nombre" name="nombre" class="entrada" required maxlength="40" placeholder="Ej: Internet"></div>
      <div class="fila-campos">
        <div class="campo"><label for="serv-dia">Día que vence</label><input id="serv-dia" name="dia" class="entrada" type="number" inputmode="numeric" min="1" max="31" placeholder="Ej: 15"></div>
        <div class="campo"><label for="serv-resp">Quién paga</label><select id="serv-resp" name="responsable" class="entrada"><option value="">Cualquiera</option>${opcionesPersonas('')}</select></div>
      </div>
      <button class="btn lleno" type="submit">Guardar</button>
    </form>`;
  },
  gasto() {
    return `<form class="lista" data-form="gasto">
      <div class="tarjeta-cab"><h2>Gasto compartido</h2><button type="button" class="btn chico suave" data-accion="cerrar-hoja">Cerrar</button></div>
      <div class="campo"><label for="gasto-desc">¿Qué se compró o pagó?</label><input id="gasto-desc" name="desc" class="entrada" required maxlength="60" placeholder="Ej: Recibo de la luz"></div>
      <div class="fila-campos">
        <div class="campo"><label for="gasto-valor">Valor (COP)</label><input id="gasto-valor" name="valor" class="entrada" required inputmode="numeric" placeholder="Ej: 120000"></div>
        <div class="campo"><label for="gasto-pago">Quién pagó</label><select id="gasto-pago" name="pago" class="entrada">${opcionesPersonas(estado.yo)}</select></div>
      </div>
      <span class="sub">Se divide en partes iguales entre ${esc(listaNombres(PERSONAS.map((p) => p.nombre)))}.</span>
      <button class="btn lleno" type="submit">Guardar gasto</button>
    </form>`;
  },
};

// ---------- pantallas de inicio ----------
function vistaCodigo() {
  return `<section class="inicio">
    <div class="cabecera-texto"><div class="eyebrow">Bienvenido a</div><h1 class="marca">501</h1>
    <p class="sub" style="font-size:15px">La app de la casa: aseo de los martes, basura, avisos y cuentas.</p></div>
    <form class="tarjeta" data-form="codigo">
      <div class="campo"><label for="codigo">Código de la casa</label>
      <input id="codigo" name="codigo" class="entrada" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Te lo pasa quien creó la casa"></div>
      <button class="btn lleno" type="submit">Entrar</button>
    </form>
    <button class="btn suave" data-accion="crear-casa">Es la primera vez: crear la casa</button>
    ${hayFirebase() ? '' : '<p class="sub">Modo demo: sin Firebase los datos se guardan solo en este dispositivo.</p>'}
  </section>`;
}
function vistaElegir() {
  return `<section class="inicio">
    <div class="cabecera-texto"><div class="eyebrow">501</div><h1>¿Quién eres?</h1>
    <p class="sub" style="font-size:15px">Así sabemos qué notificaciones mandarte.</p></div>
    <div class="elegir-persona">${PERSONAS.map((p) => `<button data-accion="soy" data-p="${esc(p.nombre)}">${avatar(p.nombre, 'g')}${esc(p.nombre)}</button>`).join('')}</div>
  </section>`;
}

// ---------- acciones ----------
let toastTimer;
function toast(txt) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = txt;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}
const fallo = (e) => { console.error(e); toast('No se pudo guardar. Revisa tu conexión e intenta de nuevo.'); };

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion]');
  if (!el) return;
  const acc = el.dataset.accion;
  if (acc === 'cerrar-hoja' && ev.target !== el && !el.matches('button')) return; // clic dentro de la hoja
  const antes = estado.confirmar;
  if (!['borrar-aviso', 'borrar-serv', 'borrar-gasto', 'saldar'].includes(acc)) estado.confirmar = null;
  try {
    switch (acc) {
      case 'pestana': estado.pestana = el.dataset.id; estado.offset = 0; estado.hoja = null; window.scrollTo(0, 0); marcarVistos(); break;
      case 'semana': estado.offset += Number(el.dataset.d); break;
      case 'hoja': estado.hoja = el.dataset.id; break;
      case 'cerrar-hoja': estado.hoja = null; break;
      case 'soy': estado.yo = el.dataset.p; guardado.set('501-yo', estado.yo); marcarVistos(); break;
      case 'cambiar-yo': estado.yo = null; estado.hoja = null; guardado.quitar('501-yo'); guardado.quitar('501-notif'); break;
      case 'crear-casa': {
        const bytes = crypto.getRandomValues(new Uint8Array(20));
        estado.casa = Array.from(bytes, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('').replace(/(.{5})(?!$)/g, '$1-');
        guardado.set('501-casa', estado.casa);
        await conectar();
        for (const nombre of ['Arriendo', 'Agua', 'Luz', 'Internet', 'Gas']) store.agregar('servicios', { nombre, dia: null, responsable: '' });
        break;
      }
      case 'hecho': {
        const { fecha, p } = el.dataset;
        if (p !== estado.yo) break;
        const doc = estado.aseo[fecha];
        if (doc && doc.hecho && doc.hecho[p]) await store.quitarCampo(`aseo/${fecha}`, `hecho.${p}`);
        else { await store.fusionar(`aseo/${fecha}`, { hecho: { [p]: Date.now() }, visto: { [p]: (doc && doc.visto && doc.visto[p]) || Date.now() } }); toast('¡Listo! Quedó marcado para todos.'); }
        break;
      }
      case 'fijar': {
        const a = estado.avisos.find((x) => x.id === el.dataset.id);
        if (a) await store.fusionar(`avisos/${a.id}`, { fijado: !a.fijado });
        break;
      }
      case 'borrar-aviso': case 'borrar-serv': case 'borrar-gasto': {
        const pref = { 'borrar-aviso': 'aviso', 'borrar-serv': 'serv', 'borrar-gasto': 'gasto' }[acc];
        const col = { aviso: 'avisos', serv: 'servicios', gasto: 'gastos' }[pref];
        const clave = `${pref}-${el.dataset.id}`;
        if (antes === clave) { estado.confirmar = null; await store.borrar(`${col}/${el.dataset.id}`); }
        else estado.confirmar = clave;
        break;
      }
      case 'saldar': {
        if (antes === 'saldar') {
          estado.confirmar = null;
          await Promise.all(estado.gastos.filter((g) => !g.saldado).map((g) => store.fusionar(`gastos/${g.id}`, { saldado: true, saldadoEn: Date.now() })));
          toast('Cuentas saldadas.');
        } else estado.confirmar = 'saldar';
        break;
      }
      case 'pagar': {
        const s = estado.servicios.find((x) => x.id === el.dataset.id);
        const mes = ahoraBogota().mes;
        if (!s) break;
        if (s.pagado && s.pagado[mes]) await store.quitarCampo(`servicios/${s.id}`, `pagado.${mes}`);
        else await store.fusionar(`servicios/${s.id}`, { pagado: { [mes]: { por: estado.yo, ts: Date.now() } } });
        break;
      }
      case 'copiar': {
        try { await navigator.clipboard.writeText(el.dataset.texto); toast('Código copiado.'); }
        catch { toast('Mantén presionado el código para copiarlo.'); }
        return;
      }
      case 'activar-notif': await activarNotificaciones(); break;
      default: return;
    }
  } catch (e) { fallo(e); }
  render();
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  if (document.activeElement) document.activeElement.blur();
  const f = new FormData(form);
  try {
    switch (form.dataset.form) {
      case 'codigo': {
        const c = String(f.get('codigo') || '').trim().toLowerCase();
        if (c.length < 20) { toast('Ese código está incompleto. Cópialo completo, con los guiones.'); return; }
        estado.casa = c; guardado.set('501-casa', c);
        await conectar();
        break;
      }
      case 'aviso': {
        const texto = String(f.get('texto') || '').trim();
        if (!texto) return;
        const notificar = f.get('notificar') === 'on';
        await store.agregar('avisos', { texto, autor: estado.yo, creado: Date.now(), fijado: f.get('fijado') === 'on', notificar, notificado: false, visto: {} });
        form.reset();
        toast(notificar ? 'Aviso publicado. Les llega en unos minutos.' : 'Aviso publicado.');
        break;
      }
      case 'servicio': {
        const dia = Number(f.get('dia')) || null;
        await store.agregar('servicios', { nombre: String(f.get('nombre')).trim(), dia, responsable: String(f.get('responsable') || '') });
        estado.hoja = null;
        break;
      }
      case 'gasto': {
        const valor = Number(String(f.get('valor')).replace(/[^\d]/g, ''));
        if (!valor) { toast('Escribe el valor en pesos, solo números.'); return; }
        await store.agregar('gastos', { desc: String(f.get('desc')).trim(), valor, pago: String(f.get('pago')), creado: Date.now(), saldado: false });
        estado.hoja = null;
        toast('Gasto guardado.');
        break;
      }
    }
  } catch (e) { fallo(e); }
  render();
});

// ---------- notificaciones ----------
function claveAUint8(b64) {
  const p = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function activarNotificaciones() {
  if (esIOS() && !instalada()) { toast('Primero agrega 501 a la pantalla de inicio y ábrela desde el ícono.'); return; }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast('Este navegador no recibe notificaciones. En iPhone necesitas iOS 16.4 o más reciente.'); return; }
  if (!VAPID_PUBLIC_KEY) { toast('Falta la clave de notificaciones (paso 3 de la guía).'); return; }
  if (store.modo === 'demo') { toast('Conecta Firebase primero (paso 1 de la guía).'); return; }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') { toast('No diste permiso. Puedes activarlo en Ajustes › Notificaciones › 501.'); return; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveAUint8(VAPID_PUBLIC_KEY) });
  const json = sub.toJSON();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json.endpoint));
  const clave = Array.from(new Uint8Array(hash).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
  await store.fusionar(`subs/${estado.yo}`, { dispositivos: { [clave]: { endpoint: json.endpoint, keys: json.keys, creado: Date.now() } } });
  guardado.set('501-notif', 'si');
  toast('Notificaciones activadas en este celular.');
}

// ---------- arrancar (al final, cuando todo está definido) ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
iniciar();
