# 501 · la app de la casa

Aseo de los martes con rotación, aviso de la basura, avisos con notificación y cuentas compartidas para York, Angeles y Juanchy. Todo gratis: Firebase guarda los datos en vivo, GitHub Pages aloja la app y GitHub Actions envía las notificaciones.

**Notificaciones que manda 501** (hora de Colombia):

| Cuándo | A quién | Qué dice |
|---|---|---|
| Lunes ~8:00 p.m. | A cada uno | Lo que le toca el martes |
| Martes ~12:00 m. | Solo a quien no ha visto el aviso ni ha terminado | Recordatorio |
| Martes y viernes ~7:00 p.m. | A todos | Sacar la basura (el camión pasa miércoles y sábado a las 6:00 a.m.) |
| Cuando alguien publica un aviso | A los demás | El aviso (llega en unos 5 a 15 minutos) |

La instalación la hace una sola persona (unos 30 minutos, mejor desde un computador). Los demás solo instalan la app en su iPhone (paso 7).

---

## 1. Crear la base de datos en Firebase

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) con tu cuenta de Google y toca **Crear un proyecto**. Nombre: `casa-501`. Puedes desactivar Google Analytics.
2. En el menú de la izquierda: **Compilación › Firestore Database › Crear base de datos**. Elige la ubicación `southamerica-east1` (São Paulo) y el **modo de producción**.
3. En Firestore, abre la pestaña **Reglas**, borra lo que hay, pega el contenido del archivo `firestore.rules` y toca **Publicar**.
4. Toca el engranaje ⚙️ › **Configuración del proyecto**. Abajo, en "Tus apps", toca el ícono **`</>`** (Web), ponle de nombre `501` y toca **Registrar app**. Firebase te muestra un bloque `firebaseConfig = { apiKey: "...", ... }`. Copia esos valores en el archivo **`firebase-config.js`**, en las comillas que correspondan.
5. En la misma Configuración del proyecto, pestaña **Cuentas de servicio**, toca **Generar nueva clave privada**. Se descarga un archivo `.json`. Guárdalo, lo vas a usar en el paso 5. **No lo subas a GitHub ni lo compartas.**

## 2. Publicar la app en GitHub Pages

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Toca **+ › New repository**. Nombre: `casa-501`. Déjalo **Public** (es necesario para que GitHub Pages y las notificaciones sean gratis). Toca **Create repository**.
3. Toca **uploading an existing file** y arrastra **todo el contenido** de la carpeta `501` (no la carpeta, lo que hay adentro). Toca **Commit changes**.
   - ⚠️ La carpeta `.github` está oculta. En Mac, en Finder, presiona `Cmd + Shift + .` para verla. En Windows: Explorador › Vista › Mostrar › Elementos ocultos. Revisa que en GitHub aparezca `.github/workflows/notificaciones.yml`.
4. En el repositorio: **Settings › Pages**. En "Branch" elige `main` y `/ (root)` y toca **Save**. En un par de minutos la app queda en:
   **`https://TU-USUARIO.github.io/casa-501/`**

## 3. Crear las claves de notificaciones

1. Abre **`https://TU-USUARIO.github.io/casa-501/claves.html`** y toca **Generar claves**. Deja esa pestaña abierta.
2. En GitHub abre `firebase-config.js`, toca el lápiz ✏️, pega la **clave pública** en `VAPID_PUBLIC_KEY = ''` y toca **Commit changes**.

## 4. Crear la casa desde tu iPhone

1. En el iPhone abre la dirección de la app **en Safari** (no en Chrome).
2. Toca **Compartir** (el cuadrito con flecha) › **Agregar a inicio**. Aparece el ícono verde de 501.
3. Abre 501 **desde el ícono**, toca **Es la primera vez: crear la casa**, elige **York** y luego toca **Activar notificaciones** y **Permitir**.
4. Toca tus iniciales (arriba a la derecha) y copia el **código de la casa**.

> Necesitas iOS 16.4 o más reciente (Ajustes › General › Información).

## 5. Darle a GitHub las claves para enviar notificaciones

En el repositorio: **Settings › Secrets and variables › Actions › New repository secret**. Crea estos cuatro:

| Nombre | Valor |
|---|---|
| `CASA_CODIGO` | El código de la casa del paso 4 |
| `FIREBASE_SERVICE_ACCOUNT` | Todo el contenido del archivo `.json` del paso 1.5 (ábrelo con el Bloc de notas o TextEdit, copia y pega todo) |
| `VAPID_PUBLIC_KEY` | La clave pública del paso 3 |
| `VAPID_PRIVATE_KEY` | La clave privada del paso 3 |

Los secretos no los ve nadie más, aunque el repositorio sea público.

## 6. Probar

En el repositorio: pestaña **Actions** › **Notificaciones 501** › **Run workflow** › modo `prueba` › **Run workflow**. En menos de un minuto te debe llegar "501 funciona". Si sale una ✗ roja, entra al intento y lee el mensaje: dice qué secreto falta.

(Si GitHub pide activar los workflows en la pestaña Actions, toca el botón verde para habilitarlos.)

## 7. Invitar a Angeles y Juanchy

En 501 toca tus iniciales › **Invitar por WhatsApp**. Les llega el link y el código. Cada uno:

1. Abre el link en **Safari** › Compartir › **Agregar a inicio**.
2. Abre 501 desde el ícono, pega el código y toca **Entrar**.
3. Elige su nombre y toca **Activar notificaciones**.

En la hoja de Personas ves quién ya tiene las notificaciones activas.

---

## Cómo funciona "visto"

- Cuando alguien toca la notificación o abre 501 el lunes en la noche o el martes, queda como **vio el aviso** y los demás lo ven en la pantalla de Aseo.
- Si solo la lee en la pantalla bloqueada sin tocarla, el iPhone no le avisa a la app. Por eso el recordatorio de las 12 m. le llega a esa persona, y lo definitivo es el botón **Marcar hecho**.
- En Avisos, un aviso queda "visto" cuando la persona abre la pestaña Avisos.

## Cambios comunes

Todo se edita en GitHub con el lápiz ✏️ en el archivo **`config.js`**:

- **Llega un roomie nuevo:** agrega una línea en `PERSONAS`. Con 4 personas y 3 tareas, cada semana uno descansa (rotando). Si prefieres que todos hagan algo, agrega una tarea en `TAREAS` (por ejemplo, baños).
- **Cambiar o agregar tareas:** edita `TAREAS`.
- **Cambian los días de la basura:** edita `BASURA` en `config.js` y los horarios en `.github/workflows/notificaciones.yml` (vienen explicados ahí).

## Bueno saberlo

- **Las horas son aproximadas.** GitHub a veces arranca los envíos con unos minutos de retraso, por eso están programados 10 minutos antes.
- **Si el repositorio pasa 60 días sin cambios**, GitHub pausa las notificaciones automáticas y te envía un correo. Entra a la pestaña Actions y toca **Enable workflow**. Cualquier cambio pequeño en un archivo también lo evita.
- **El código de la casa es la llave.** Quien lo tenga puede ver y editar todo, así que compártelo solo con los roomies.
- **Sin Firebase configurado**, la app funciona en "modo demo" y guarda todo solo en ese celular. Sirve para probarla.
- **WhatsApp:** WhatsApp no permite que una app escriba sola en un grupo. En la pantalla de Aseo hay un botón **Enviar por WhatsApp** que deja el mensaje listo para mandarlo al grupo.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html`, `app.js`, `styles.css` | La app |
| `config.js` | Personas, tareas, días de basura |
| `logica.js` | Rotación del aseo, fechas, división de gastos |
| `store.js` | Conexión con Firebase |
| `firebase-config.js` | Tus datos de Firebase y la clave pública |
| `sw.js`, `manifest.webmanifest`, `icons/` | Para instalarla en el iPhone y recibir notificaciones |
| `claves.html` | Genera las claves de notificaciones (paso 3) |
| `firestore.rules` | Seguridad de la base de datos |
| `scripts/notificar.mjs`, `.github/workflows/notificaciones.yml` | Envío programado de notificaciones |
