# KYN Cost Studio 🧮

App de costos y precios de KYN Studio, conectada a Notion.

## Cómo iniciarla

Doble clic en **`Iniciar KYN Cost Studio.command`** — se abre la app en tu navegador (http://localhost:4321). Deja la ventana de Terminal abierta mientras la uses.

## Usarla desde internet / el celular (Netlify)

El sitio de Netlify también sincroniza con Notion: la función `netlify/functions/notion.mjs` hace de puente (igual que `server.js` en tu compu), leyendo el token de la variable de ambiente **`NOTION_TOKEN`** (en Netlify: *Site configuration → Environment variables*).

**Recomendado:** agrega también una variable **`KYN_PIN`** con un PIN que tú elijas (por ejemplo `2468`). Sin PIN, cualquier persona que descubra la URL del sitio puede leer y escribir tus bases de Notion. Con PIN, la app te lo pregunta una sola vez en cada dispositivo y lo recuerda. Después de agregar o cambiar variables, haz *redeploy* del sitio (Deploys → Trigger deploy) para que apliquen.

## Conectar Notion (una sola vez)

Los datos viven en Notion, en la página **KYN Studio → KYN Cost Studio** (bases *Materiales*, *Compras*, *Productos* y *Ajustes*), en la base *KYN Seeding Tracker* y —si la conectas— en *KYN Eventos* (ver [Eventos](#eventos)). Para que la app pueda leer y escribir ahí:

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

## Eventos

La sección **Eventos** sirve para planear bazares, ferias y pop-ups: te dice cuánto tienes que vender para que valga la pena y qué material te falta comprar antes.

Creas el evento con el costo del lugar, los días, el montaje (mantel, exhibidores, letrero — la primera vez sí se paga) y qué tanto vas a cobrar con terminal. Luego eliges **qué llevas**, y la app calcula:

- **Para salir tablas** — cuántas piezas de ese mismo mix tienes que vender para cubrir el costo del evento, y qué porcentaje del plan representa.
- **Si vendes todo** — lo que te queda ya pagados el lugar, los materiales, la comisión de cobro y tus horas de taller. Abajo también aparece el número **en efectivo**, sin descontarte las horas.
- **Material para producirlo** — cuánta materia prima pide el plan (expandiendo bundles hasta llegar a materiales), cuánta tienes y cuánto cuesta reponer lo que falta. Ojo: *«tengo»* es la suma de todas tus compras registradas, **sin descontar lo que ya usaste** en piezas hechas — la app no lleva consumo, así que tómalo como techo y verifica en el taller.
- **Preparación** — la lista de pendientes del evento, editable y con palomita.
- **Lo que se vendió** — al terminar registras lo que de verdad salió y ves el resultado real contra lo planeado.

Los precios que usa son los del canal que elijas en el evento (normalmente *En persona*). Si una pieza no tiene precio guardado en ese canal, usa el sugerido y lo marca. Las piezas con materiales sin costo registrado se señalan y **no** entran en los totales, para que ningún número salga inventado.

### Pedidos de compra

Dentro de un evento, debajo de "Material para producirlo", vive **Pedidos de compra**: arma los carritos reales de un proveedor externo (por ahora Buckleguy) respetando un límite en USD por pedido (configurable en "Editar datos", 50 USD por default — el umbral típico de importación sin traslape). Cada pedido muestra su liga directa al producto, la cantidad, el precio según el escalón de mayoreo que le toque *a esa línea en ese pedido* (partir una cantidad entre varios pedidos no acumula el descuento), y se avisa en amarillo cuando un pedido queda a menos de $3 del límite.

Todo es editable ahí mismo: cambia cantidades, mueve una línea de un pedido a otro con el selector, agrega materiales con "+ material" o pedidos completos con "+ Nuevo pedido" — pensado para "jugar" con distintos armados antes de comprar.

Para que un material aparezca en el catálogo de "+ material" necesita tener capturado su proveedor (liga, tamaño de paquete si se vende por bolsa, y escalones de precio en USD) — por ahora eso solo se captura editando el seed en `kyn-calc.js` (`materialId.vendor`), no hay editor en la UI todavía.

### Guardarlos en Notion

A diferencia de las demás, la base de eventos no viene precargada: se conecta desde la app.

1. En Notion, dentro de **KYN Cost Studio**, crea una base llamada *KYN Eventos* con al menos las columnas **Name** (título) y **Data** (texto). Las demás (*Clave, Fecha, Lugar, Estado, Costo del evento, Venta planeada, Piezas para salir tablas, Actualizado*) se llenan solas si las creas con ese nombre.
2. Menú `···` → **Conexiones** → agrega `KYN Cost Studio`.
3. Copia el ID de la base (los 32 caracteres de su URL) y pégalo en la app en **Ajustes → Notion**.

Mientras no hagas esto la sección funciona igual, pero los eventos se guardan solo en ese navegador y la app te lo avisa.

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
