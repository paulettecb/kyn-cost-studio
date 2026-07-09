// ============================================================
// KYN Cost Studio · Adaptador de Notion
// Lee y escribe las bases de datos de Notion a través del
// proxy local /api/notion (ver server.js).
// ============================================================

export const NOTION_DBS = {
  materials: '01dc6be2-6644-4853-866b-cf40c316f969',
  purchases: 'b99a257f-649d-4e75-9b1a-32474c2ca4ab',
  products: 'c0554c5c-f4ec-4461-af6c-c609e462bc9e',
  settings: '6b4fcaea-82a5-46a0-b10c-6bf95f46d69f',
  // Seeding Tracker — a diferencia de las otras, esta base usa columnas
  // nativas de Notion (no un blob JSON) para que se vea y edite bien desde
  // el celular en Notion. Ver seedProps / parseSeedRow más abajo.
  seeding: '8a8aa4d7-6054-434c-9632-6ee1683ef392',
  // KYN Crecimiento — mediciones de seguidores. También columnas nativas.
  // Vive debajo de la página KYN Cost Studio, así que hereda la conexión.
  growth: 'd8cd7267-b81b-4c30-b591-75014f417cc1',
};

const r2 = (n) => (n == null || isNaN(n) ? null : Math.round(n * 100) / 100);

// Si el sitio público (Netlify) tiene KYN_PIN configurado, el puente responde
// 401 need_pin hasta recibir el PIN correcto. Reglas para no hacer spam:
//  - un solo prompt aunque haya varias peticiones fallando en paralelo
//    (las demás reutilizan el PIN recién tecleado sin volver a preguntar);
//  - el reintento usa el PIN tecleado directamente, así funciona aunque el
//    navegador bloquee localStorage (p. ej. navegación privada);
//  - cancelar el prompt deja de insistir durante esta sesión;
//  - solo se vuelve a preguntar si el PIN que falló es el mismo que ya se tenía.
let pinMemo = null;
let pinDeclined = false;
let pinPromptOpen = null;

function currentPin() {
  if (pinMemo != null) return pinMemo;
  try { return localStorage.getItem('kyn-pin') || ''; } catch (e) { return ''; }
}

function askPin(failedPin) {
  const known = currentPin();
  if (known && known !== failedPin) return Promise.resolve(known);
  if (pinDeclined) return Promise.resolve(null);
  if (!pinPromptOpen) {
    pinPromptOpen = Promise.resolve().then(() => {
      pinPromptOpen = null;
      // mientras esta petición esperaba su turno, otra pudo conseguir el PIN
      const fresh = currentPin();
      if (fresh && fresh !== failedPin) return fresh;
      if (pinDeclined) return null;
      const raw = window.prompt('PIN de KYN Cost Studio (el valor de KYN_PIN en Netlify):');
      if (raw == null) { pinDeclined = true; return null; }
      const p = raw.trim();
      pinMemo = p;
      try { localStorage.setItem('kyn-pin', p); } catch (e) {}
      return p;
    });
  }
  return pinPromptOpen;
}

async function api(path, method = 'GET', body = null, pinOverride = null) {
  const pin = pinOverride != null ? pinOverride : currentPin();
  const res = await fetch('/api/notion/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-KYN-Pin': pin },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && json && json.code === 'need_pin' && pinOverride == null) {
      const fresh = await askPin(pin);
      if (fresh != null && fresh !== pin) return api(path, method, body, fresh);
    }
    const msg = json && json.message ? json.message : 'Error ' + res.status;
    const err = new Error(msg);
    err.status = res.status;
    err.code = json && json.code;
    throw err;
  }
  return json;
}

// Notion limita cada rich_text a 2000 caracteres — se trocea el JSON.
function rt(str) {
  const out = [];
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i += 1900) out.push({ text: { content: s.slice(i, i + 1900) } });
  if (!out.length) out.push({ text: { content: '' } });
  return out;
}

const plain = (arr) => (arr || []).map((t) => t.plain_text != null ? t.plain_text : (t.text && t.text.content) || '').join('');

async function queryAll(dbId) {
  const pages = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await api('databases/' + dbId + '/query', 'POST', body);
    pages.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

function parseDataRow(page) {
  const p = page.properties || {};
  const dataProp = p.Data && p.Data.rich_text ? plain(p.Data.rich_text) : '';
  if (!dataProp) return null;
  try {
    return { pageId: page.id, obj: JSON.parse(dataProp) };
  } catch (e) {
    console.warn('Fila de Notion con Data inválido:', page.id, e);
    return null;
  }
}

// ---------- propiedades legibles por colección ----------

function matProps(m, C, db) {
  const cost = r2(C.materialUnitCost(db, m));
  return {
    Name: { title: rt(m.name) },
    Clave: { rich_text: rt(m.id) },
    'Categoría': { rich_text: rt(m.category || '') },
    Unidad: { rich_text: rt(m.unit || '') },
    Estado: { rich_text: rt(m.status || '') },
    'Costo vigente': { number: cost },
    Actualizado: { rich_text: rt(m.updatedAt || '') },
    Data: { rich_text: rt(JSON.stringify(m)) },
  };
}

function purProps(p, C) {
  const t = C.purchaseTotals(p);
  return {
    Name: { title: rt(p.name) },
    Clave: { rich_text: rt(p.id) },
    Fecha: p.date ? { date: { start: p.date } } : { date: null },
    Proveedor: { rich_text: rt(p.supplier || '') },
    Moneda: { rich_text: rt(p.currency || 'MXN') },
    'Total MXN': { number: r2(t.totalMXN) },
    'Extras MXN': { number: r2(t.extrasMXN) },
    Data: { rich_text: rt(JSON.stringify(p)) },
  };
}

function prodProps(p, C, db) {
  const cost = r2(C.productCost(db, p).total);
  const sp = p.savedPrices || {};
  const px = (k) => (sp[k] && sp[k].price != null ? +sp[k].price : null);
  return {
    Name: { title: rt(p.name) },
    Clave: { rich_text: rt(p.id) },
    'Categoría': { rich_text: rt(p.category || '') },
    Estado: { rich_text: rt(p.status || '') },
    Costo: { number: cost },
    'Precio en línea': { number: px('online') },
    'Precio en persona': { number: px('inPerson') },
    'Precio amigos': { number: px('friends') },
    Actualizado: { rich_text: rt(p.updatedAt || '') },
    Data: { rich_text: rt(JSON.stringify(p)) },
  };
}

// ---------- seeding (columnas nativas de Notion) ----------

// La base "KYN Seeding Tracker" no guarda un blob JSON: cada dato vive en su
// propia columna de Notion (título, select, url, número, fecha, texto) para
// que se pueda ver y editar bonito desde Notion. Estos helpers traducen entre
// esas columnas y el objeto plano que usa la app.

const readSel = (pr) => (pr && pr.select ? pr.select.name : '');
const readNum = (pr) => (pr && pr.number != null ? pr.number : null);
const readUrl = (pr) => (pr && pr.url) || '';
const readTxt = (pr) => (pr && pr.rich_text ? plain(pr.rich_text) : '');
// Notion puede devolver la fecha con hora ("2026-07-09T09:00:00.000-06:00")
// si la fila se editó desde Notion; la app solo maneja días → se recorta.
const readDate = (pr) => (pr && pr.date && pr.date.start ? String(pr.date.start).slice(0, 10) : '');

function parseSeedRow(page) {
  const p = page.properties || {};
  // El id del objeto en la app = el id de la página de Notion (estable entre
  // recargas). No hay columna "Clave" en esta base.
  return {
    pageId: page.id,
    obj: {
      id: page.id,
      createdTime: page.created_time || '',
      cuenta: p.Cuenta && p.Cuenta.title ? plain(p.Cuenta.title) : '',
      estatus: readSel(p.Estatus) || 'Por contactar',
      ciudad: readSel(p.Ciudad) || '',
      instagram: readUrl(p.Instagram),
      nicho: readTxt(p['Perro / Nicho']),
      seguidores: readNum(p.Seguidores),
      notas: readTxt(p.Notas),
      fechaContacto: readDate(p['Fecha de contacto']),
      colab: readTxt(p['Colaboración']),
    },
  };
}

// ---------- Crecimiento (columnas nativas de Notion) ----------

function parseGrowthRow(page) {
  const p = page.properties || {};
  return {
    pageId: page.id,
    obj: {
      id: page.id,
      createdTime: page.created_time || '',
      fecha: readDate(p.Fecha),
      cuenta: readSel(p.Cuenta),
      plataforma: readSel(p.Plataforma),
      seguidores: readNum(p.Seguidores),
      notas: readTxt(p.Notas),
    },
  };
}

function growthProps(g) {
  const seg = g.seguidores === '' || g.seguidores == null || isNaN(g.seguidores) ? null : Number(g.seguidores);
  return {
    Registro: { title: rt([g.cuenta, g.plataforma, g.fecha].filter(Boolean).join(' · ') || 'Medición') },
    Fecha: g.fecha ? { date: { start: g.fecha } } : { date: null },
    Cuenta: g.cuenta ? { select: { name: g.cuenta } } : { select: null },
    Plataforma: g.plataforma ? { select: { name: g.plataforma } } : { select: null },
    Seguidores: { number: seg },
    Notas: { rich_text: rt(g.notas || '') },
  };
}

function seedProps(s) {
  const seg = s.seguidores === '' || s.seguidores == null || isNaN(s.seguidores) ? null : Number(s.seguidores);
  return {
    Cuenta: { title: rt(s.cuenta || '') },
    Estatus: s.estatus ? { select: { name: s.estatus } } : { select: null },
    Ciudad: s.ciudad ? { select: { name: s.ciudad } } : { select: null },
    Instagram: { url: s.instagram ? s.instagram : null },
    'Perro / Nicho': { rich_text: rt(s.nicho || '') },
    Seguidores: { number: seg },
    Notas: { rich_text: rt(s.notas || '') },
    'Fecha de contacto': s.fechaContacto ? { date: { start: s.fechaContacto } } : { date: null },
    'Colaboración': { rich_text: rt(s.colab || '') },
  };
}

// ---------- carga ----------

export async function loadDB(C) {
  const [matPages, purPages, prodPages, setPages] = await Promise.all([
    queryAll(NOTION_DBS.materials),
    queryAll(NOTION_DBS.purchases),
    queryAll(NOTION_DBS.products),
    queryAll(NOTION_DBS.settings),
  ]);
  // La base de seeding se carga aparte y su falla NO tumba el resto: si la
  // integración todavía no está conectada a "KYN Seeding Tracker", los costos
  // y precios siguen sincronizando y la sección Seeding avisa en la UI.
  let seedPages = null;
  try {
    seedPages = await queryAll(NOTION_DBS.seeding);
  } catch (e) {
    console.warn('KYN Seeding Tracker no disponible en Notion — la sección Seeding no sincronizará hasta conectar la base a la integración.', e);
  }
  let growthPages = null;
  try {
    growthPages = await queryAll(NOTION_DBS.growth);
  } catch (e) {
    console.warn('KYN Crecimiento no disponible en Notion — la sección Crecimiento no sincronizará hasta conectar la base a la integración.', e);
  }
  const coll = (pages) => pages.map(parseDataRow).filter(Boolean);
  const mats = coll(matPages), purs = coll(purPages), prods = coll(prodPages);
  const seeds = (seedPages || []).map(parseSeedRow);
  const grows = (growthPages || []).map(parseGrowthRow);
  const setRow = coll(setPages)[0] || null;
  if (!setRow) throw new Error('No se encontró la fila de ajustes en Notion.');

  const db = {
    materials: mats.map((x) => x.obj),
    purchases: purs.map((x) => x.obj).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    products: prods.map((x) => x.obj).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    seeding: seeds.map((x) => x.obj).sort((a, b) => (b.createdTime || '').localeCompare(a.createdTime || '')),
    growth: grows.map((x) => x.obj).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    settings: setRow.obj,
  };

  const ctx = {
    pageMap: {
      materials: new Map(mats.map((x) => [x.obj.id, x.pageId])),
      purchases: new Map(purs.map((x) => [x.obj.id, x.pageId])),
      products: new Map(prods.map((x) => [x.obj.id, x.pageId])),
      seeding: new Map(seeds.map((x) => [x.obj.id, x.pageId])),
      growth: new Map(grows.map((x) => [x.obj.id, x.pageId])),
    },
    settingsPageId: setRow.pageId,
    // Sin acceso a una base no se escribe nada en ella (evita crear
    // duplicados o archivar filas por error con un estado incompleto).
    seedingDisabled: seedPages == null,
    growthDisabled: growthPages == null,
    propSnaps: { materials: new Map(), purchases: new Map(), products: new Map(), seeding: new Map(), growth: new Map(), settings: '' },
  };
  snapshotAll(db, ctx, C);
  return { db, ctx };
}

export function snapshotAll(db, ctx, C) {
  ctx.propSnaps.materials = new Map(db.materials.map((m) => [m.id, JSON.stringify(matProps(m, C, db))]));
  ctx.propSnaps.purchases = new Map(db.purchases.map((p) => [p.id, JSON.stringify(purProps(p, C))]));
  ctx.propSnaps.products = new Map(db.products.map((p) => [p.id, JSON.stringify(prodProps(p, C, db))]));
  ctx.propSnaps.seeding = new Map((db.seeding || []).map((s) => [s.id, JSON.stringify(seedProps(s))]));
  ctx.propSnaps.growth = new Map((db.growth || []).map((g) => [g.id, JSON.stringify(growthProps(g))]));
  ctx.propSnaps.settings = JSON.stringify(db.settings);
}

// ---------- guardado incremental ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function syncColl(name, list, buildProps, ctx) {
  const map = ctx.pageMap[name];
  const snaps = ctx.propSnaps[name];
  const seen = new Set();
  let writes = 0;
  for (const obj of list) {
    seen.add(obj.id);
    const props = buildProps(obj);
    const json = JSON.stringify(props);
    if (!map.has(obj.id)) {
      if (writes++) await sleep(340);
      const page = await api('pages', 'POST', { parent: { database_id: NOTION_DBS[name] }, properties: props });
      map.set(obj.id, page.id);
      snaps.set(obj.id, json);
    } else if (snaps.get(obj.id) !== json) {
      if (writes++) await sleep(340);
      await api('pages/' + map.get(obj.id), 'PATCH', { properties: props });
      snaps.set(obj.id, json);
    }
  }
  // elementos borrados en la app → se archivan en Notion (recuperables desde la papelera)
  for (const [id, pageId] of [...map]) {
    if (!seen.has(id)) {
      if (writes++) await sleep(340);
      await api('pages/' + pageId, 'PATCH', { archived: true });
      map.delete(id);
      snaps.delete(id);
    }
  }
  return writes;
}

export async function saveDB(db, ctx, C) {
  let writes = 0;
  writes += await syncColl('materials', db.materials, (m) => matProps(m, C, db), ctx);
  writes += await syncColl('purchases', db.purchases, (p) => purProps(p, C), ctx);
  writes += await syncColl('products', db.products, (p) => prodProps(p, C, db), ctx);
  if (!ctx.seedingDisabled) writes += await syncColl('seeding', db.seeding || [], (s) => seedProps(s), ctx);
  if (!ctx.growthDisabled) writes += await syncColl('growth', db.growth || [], (g) => growthProps(g), ctx);
  const setJson = JSON.stringify(db.settings);
  if (setJson !== ctx.propSnaps.settings) {
    await api('pages/' + ctx.settingsPageId, 'PATCH', { properties: { Data: { rich_text: rt(setJson) } } });
    ctx.propSnaps.settings = setJson;
    writes++;
  }
  return writes;
}
