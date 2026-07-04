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
};

const r2 = (n) => (n == null || isNaN(n) ? null : Math.round(n * 100) / 100);

async function api(path, method = 'GET', body = null) {
  const res = await fetch('/api/notion/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
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

// ---------- carga ----------

export async function loadDB(C) {
  const [matPages, purPages, prodPages, setPages] = await Promise.all([
    queryAll(NOTION_DBS.materials),
    queryAll(NOTION_DBS.purchases),
    queryAll(NOTION_DBS.products),
    queryAll(NOTION_DBS.settings),
  ]);
  const coll = (pages) => pages.map(parseDataRow).filter(Boolean);
  const mats = coll(matPages), purs = coll(purPages), prods = coll(prodPages);
  const setRow = coll(setPages)[0] || null;
  if (!setRow) throw new Error('No se encontró la fila de ajustes en Notion.');

  const db = {
    materials: mats.map((x) => x.obj),
    purchases: purs.map((x) => x.obj).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    products: prods.map((x) => x.obj).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    settings: setRow.obj,
  };

  const ctx = {
    pageMap: {
      materials: new Map(mats.map((x) => [x.obj.id, x.pageId])),
      purchases: new Map(purs.map((x) => [x.obj.id, x.pageId])),
      products: new Map(prods.map((x) => [x.obj.id, x.pageId])),
    },
    settingsPageId: setRow.pageId,
    propSnaps: { materials: new Map(), purchases: new Map(), products: new Map(), settings: '' },
  };
  snapshotAll(db, ctx, C);
  return { db, ctx };
}

export function snapshotAll(db, ctx, C) {
  ctx.propSnaps.materials = new Map(db.materials.map((m) => [m.id, JSON.stringify(matProps(m, C, db))]));
  ctx.propSnaps.purchases = new Map(db.purchases.map((p) => [p.id, JSON.stringify(purProps(p, C))]));
  ctx.propSnaps.products = new Map(db.products.map((p) => [p.id, JSON.stringify(prodProps(p, C, db))]));
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
  const setJson = JSON.stringify(db.settings);
  if (setJson !== ctx.propSnaps.settings) {
    await api('pages/' + ctx.settingsPageId, 'PATCH', { properties: { Data: { rich_text: rt(setJson) } } });
    ctx.propSnaps.settings = setJson;
    writes++;
  }
  return writes;
}
