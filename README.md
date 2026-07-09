# KYN Cost Studio 🧮

App de costos y precios de KYN Studio, conectada a Notion.

## Cómo iniciarla

Doble clic en **`Iniciar KYN Cost Studio.command`** — se abre la app en tu navegador (http://localhost:4321). Deja la ventana de Terminal abierta mientras la uses.

## Usarla desde internet / el celular (Netlify)

El sitio de Netlify también sincroniza con Notion: la función `netlify/functions/notion.mjs` hace de puente (igual que `server.js` en tu compu), leyendo el token de la variable de ambiente **`NOTION_TOKEN`** (en Netlify: *Site configuration → Environment variables*).

**Recomendado:** agrega también una variable **`KYN_PIN`** con un PIN que tú elijas (por ejemplo `2468`). Sin PIN, cualquier persona que descubra la URL del sitio puede leer y escribir tus bases de Notion. Con PIN, la app te lo pregunta una sola vez en cada dispositivo y lo recuerda. Después de agregar o cambiar variables, haz *redeploy* del sitio (Deploys → Trigger deploy) para que apliquen.

## Conectar Notion (una sola vez)

Los datos viven en Notion, en la página **KYN Studio → KYN Cost Studio** (bases *Materiales*, *Compras*, *Productos* y *Ajustes*) y en la base *KYN Seeding Tracker*. Para que la app pueda leer y escribir ahí:

1. Entra a https://www.notion.so/profile/integrations y crea una integración interna (nombre sugerido: `KYN Cost Studio`). Copia el **Internal Integration Secret** (empieza con `ntn_` o `secret_`).
2. En Notion, abre la página **KYN Cost Studio**, menú `···` → **Conexiones / Connections** → agrega tu integración `KYN Cost Studio`. Haz lo mismo en la base **KYN Seeding Tracker** (menú `···` → **Conexiones**) para que la sección *Seeding* también sincronice.
3. Abre `notion-config.json` (en esta carpeta) y pega el token en `"notionToken"`. Guarda.
4. Recarga la app.

En la esquina inferior izquierda verás el estado: 🟢 *Sincronizado con Notion*.

## Cómo funciona la sincronización

- Al abrir, la app **carga todo desde Notion** (materiales, compras, productos, precios y ajustes).
- Cada cambio se guarda **automáticamente** (unos segundos después) en Notion y en el navegador como respaldo.
- Si no hay internet o falta el token, la app sigue funcionando con la copia local del navegador y lo indica en amarillo. El botón del estado fuerza una sincronización manual.
- Lo que borras en la app se **archiva** en Notion (recuperable desde la papelera de Notion).
- Puedes *ver* los precios desde el celular en Notion; para *editar*, usa la app (así los costos se recalculan bien).

## Lista de precios

En la sección **Lista de precios** hay dos vistas:
- **Tabla** — costos, márgenes y recalcular por canal, con exportación CSV / copiar / PDF.
- **Tarjetas** — las tarjetas bonitas por canal (en línea / en persona / familia & amigos), listas para imprimir o compartir.

## Bundles

Un **bundle** es un producto armado con *otros productos* (por ejemplo, collar + correa). Se crea como cualquier producto (categoría *Bundles*) y en su **receta** eliges la pestañita **Productos** para agregar los componentes. Su costo es la suma del costo real de cada componente (más empaque u otros extras que le pongas), se recalcula solo si cambia el costo de un componente, y aparece en la lista de precios y la calculadora como cualquier producto. También puedes mezclar: productos + materiales sueltos en la misma receta (la merma solo aplica a los materiales).

## Crecimiento

La sección **Crecimiento** mide los seguidores de **@kynstudio** y **@soykenna** (Instagram y TikTok) con fecha, guardados en la base *KYN Crecimiento* de Notion (vive debajo de la página KYN Cost Studio, así que hereda la conexión de la integración).

- **+ Registrar medición** abre un modal con la fecha y las 4 cuentas: llenas las que quieras (las vacías no se registran) y si repites cuenta+fecha se actualiza en vez de duplicarse.
- Cada tarjeta muestra el número actual, cuánto cambió desde la medición anterior, el cambio de ~30 días y la mini-gráfica de tendencia.
- Los números los capturas tú (Instagram/TikTok no permiten leerlos automáticamente); el historial completo se puede editar o borrar fila por fila.

## En tu iPhone (pantalla de inicio)

La app tiene ícono propio (el corazón KYN 💗) y es instalable: en Safari abre el sitio → botón compartir → **Agregar a pantalla de inicio**. Se abre a pantalla completa, como app.

## Seeding

La sección **Seeding** lleva el control de las cuentas para colaboración (la base *KYN Seeding Tracker* de Notion). Cada cuenta avanza por sus pasos con el estatus: **Por contactar → Contactada → Respondió → Enviado → Publicó** (o *Descartada*).

- El resumen de arriba muestra cuántas cuentas hay en cada paso; toca un chip para filtrar.
- Cambia el estatus directo desde la tabla (la pastilla de color) o desde el detalle.
- **+ Nueva cuenta** abre un modal para agregar o editar: cuenta, Instagram, ciudad, perro/nicho, seguidores, fecha de contacto, colaboración/producto enviado y notas.
- A diferencia de las otras bases, esta usa columnas nativas de Notion (no un bloque JSON), así que puedes verla y editarla igual de bien desde Notion en el celular.

## Archivos

- `index.html` — la app (UI + lógica).
- `kyn-calc.js` — motor de cálculo (costos, distribución de extras, precios).
- `kyn-notion.js` — sincronización con Notion.
- `server.js` — servidor local + puente al API de Notion.
- `notion-config.json` — tu token (no lo compartas).
- `_ds/`, `support.js` — sistema de diseño KYN y runtime.
