# KYN Cost Studio 🧮

App de costos y precios de KYN Studio, conectada a Notion.

## Cómo iniciarla

Doble clic en **`Iniciar KYN Cost Studio.command`** — se abre la app en tu navegador (http://localhost:4321). Deja la ventana de Terminal abierta mientras la uses.

## Conectar Notion (una sola vez)

Los datos viven en Notion, en la página **KYN Studio → KYN Cost Studio** (bases *Materiales*, *Compras*, *Productos* y *Ajustes*). Para que la app pueda leer y escribir ahí:

1. Entra a https://www.notion.so/profile/integrations y crea una integración interna (nombre sugerido: `KYN Cost Studio`). Copia el **Internal Integration Secret** (empieza con `ntn_` o `secret_`).
2. En Notion, abre la página **KYN Cost Studio**, menú `···` → **Conexiones / Connections** → agrega tu integración `KYN Cost Studio`.
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

## Archivos

- `index.html` — la app (UI + lógica).
- `kyn-calc.js` — motor de cálculo (costos, distribución de extras, precios).
- `kyn-notion.js` — sincronización con Notion.
- `server.js` — servidor local + puente al API de Notion.
- `notion-config.json` — tu token (no lo compartas).
- `_ds/`, `support.js` — sistema de diseño KYN y runtime.
