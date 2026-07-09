// ============================================================
// KYN Cost Studio · Motor de cálculo + datos seed
// Todas las fórmulas del negocio viven aquí (no en la UI).
// ============================================================

export const uid = () => 'k' + Math.random().toString(36).slice(2, 10);
export const round2 = (n) => Math.round(n * 100) / 100;

export const money = (n, d = 2) =>
  n == null || isNaN(n) ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

export const pct = (n, d = 1) =>
  n == null || isNaN(n) ? '—' : (n * 100).toFixed(d).replace(/\.0$/, '') + '%';

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return d + ' ' + meses[m - 1] + ' ' + y;
};

// ---------- Compras: distribución de costos extra ----------

export function purchaseExtras(p) {
  return (+p.shippingCost || 0) + (+p.taxes || 0) + (+p.importFees || 0) + (+p.paymentFees || 0) + (+p.otherFees || 0);
}

// Devuelve los items con costo real calculado según el método de distribución
export function computePurchaseItems(p) {
  const items = p.items || [];
  const subtotal = items.reduce((s, it) => s + (+it.originalUnitPrice || 0) * (+it.quantity || 0), 0);
  const totalQty = items.reduce((s, it) => s + (+it.quantity || 0), 0);
  const extras = purchaseExtras(p);
  const rate = p.currency === 'MXN' ? 1 : (+p.exchangeRate || 1);
  return items.map((it) => {
    const orig = (+it.originalUnitPrice || 0) * (+it.quantity || 0);
    const share = p.allocationMethod === 'qty' ? (totalQty ? (+it.quantity || 0) / totalQty : 0) : (subtotal ? orig / subtotal : 0);
    const allocatedMXN = extras * share * rate;
    const convertedTotalMXN = orig * rate;
    const realTotalCost = convertedTotalMXN + allocatedMXN;
    const q = +it.quantity || 0;
    return {
      ...it,
      originalTotal: orig,
      convertedTotalMXN,
      allocatedExtraCost: allocatedMXN,
      realTotalCost,
      realUnitCost: q ? realTotalCost / q : 0,
      baseUnitCostMXN: q ? convertedTotalMXN / q : 0,
      extraPct: convertedTotalMXN ? allocatedMXN / convertedTotalMXN : 0,
    };
  });
}

export function purchaseTotals(p) {
  const rate = p.currency === 'MXN' ? 1 : (+p.exchangeRate || 1);
  const items = p.items || [];
  const subtotal = items.reduce((s, it) => s + (+it.originalUnitPrice || 0) * (+it.quantity || 0), 0);
  const extras = purchaseExtras(p);
  return {
    subtotalOrig: subtotal,
    extrasOrig: extras,
    totalOrig: subtotal + extras,
    subtotalMXN: subtotal * rate,
    extrasMXN: extras * rate,
    totalMXN: (subtotal + extras) * rate,
    itemCount: items.length,
  };
}

// ---------- Materiales: costo unitario vigente ----------

export function materialHistory(db, materialId) {
  const rows = [];
  for (const p of db.purchases) {
    for (const it of computePurchaseItems(p)) {
      if (it.materialId === materialId) {
        rows.push({
          purchaseId: p.id, purchaseName: p.name, date: p.date, supplier: p.supplier,
          quantity: +it.quantity || 0, unit: it.unit,
          realUnitCost: it.realUnitCost, realTotalCost: it.realTotalCost,
          baseUnitCostMXN: it.baseUnitCostMXN, allocatedExtraCost: it.allocatedExtraCost,
        });
      }
    }
  }
  rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows;
}

export function materialUnitCost(db, mat) {
  if (!mat) return null;
  const method = mat.costingMethod || db.settings.defaultCostingMethod || 'last';
  if (method === 'manual') return mat.manualCost != null && mat.manualCost !== '' ? +mat.manualCost : null;
  const hist = materialHistory(db, mat.id);
  if (!hist.length) return mat.currentUnitCost != null ? +mat.currentUnitCost : null;
  if (method === 'wavg') {
    const q = hist.reduce((s, h) => s + h.quantity, 0);
    const c = hist.reduce((s, h) => s + h.realTotalCost, 0);
    return q ? c / q : null;
  }
  return hist[0].realUnitCost; // 'last'
}

// ---------- Productos: costo de producción ----------

// Una receta acepta dos tipos de línea:
//  - { materialId, quantity }  → materia prima (como siempre)
//  - { productId, quantity }   → otro producto terminado (para bundles):
//    su costo unitario es el costo TOTAL de ese producto (materiales, mano
//    de obra, merma, empaque). `_path` evita ciclos (A contiene B contiene A).
export function productCost(db, product, settings, _path) {
  settings = settings || db.settings;
  const path = _path || [];
  let materials = 0;     // total de la receta (materia prima + productos)
  let rawMaterials = 0;  // solo materia prima — la merma aplica sobre esto
  const missing = [];
  const lines = [];
  for (const l of product.recipe || []) {
    if (l.productId) {
      const sub = db.products.find((x) => x.id === l.productId);
      let unitCost = null;
      if (sub && sub.id !== product.id && !path.includes(sub.id)) {
        const sc = productCost(db, sub, settings, [...path, product.id]);
        if (!sc.missing.length) unitCost = sc.total;
      }
      const total = unitCost != null ? unitCost * (+l.quantity || 0) : null;
      if (total == null) missing.push(sub ? sub.name : 'producto eliminado');
      else materials += total;
      lines.push({ ...l, product: sub, unitCost, totalCost: total });
      continue;
    }
    const mat = db.materials.find((m) => m.id === l.materialId);
    const unitCost = materialUnitCost(db, mat);
    const total = unitCost != null ? unitCost * (+l.quantity || 0) : null;
    if (total == null) missing.push(mat ? mat.name : 'material eliminado');
    else { materials += total; rawMaterials += total; }
    lines.push({ ...l, material: mat, unitCost, totalCost: total });
  }
  const rate = product.laborHourlyRate != null ? +product.laborHourlyRate : (+settings.defaultLaborHourlyRate || 0);
  const labor = ((+product.laborTimeMinutes || 0) / 60) * rate;
  const wastePct = product.wastePercentage != null ? +product.wastePercentage : (+settings.defaultWastePercentage || 0);
  const waste = rawMaterials * wastePct;
  const packaging = +product.packagingCost || 0;
  const other = (+product.customizationCost || 0) + (+product.otherCosts || 0);
  const total = materials + labor + waste + packaging + other;
  return { materials, labor, laborRate: rate, waste, wastePct, packaging, other, total, lines, missing };
}

// ¿La receta de `product` usa (directa o transitivamente) al producto target?
// Sirve para no ofrecer como componente algo que crearía un ciclo.
export function recipeUsesProduct(db, product, targetId, _seen) {
  const seen = _seen || new Set();
  for (const l of product.recipe || []) {
    if (!l.productId) continue;
    if (l.productId === targetId) return true;
    if (seen.has(l.productId)) continue;
    seen.add(l.productId);
    const sub = db.products.find((x) => x.id === l.productId);
    if (sub && recipeUsesProduct(db, sub, targetId, seen)) return true;
  }
  return false;
}

// ---------- Precios ----------

export const priceByMultiplier = (cost, m) => cost * (+m || 0);
export const priceByMargin = (cost, margin) => (+margin >= 1 ? null : cost / (1 - (+margin || 0)));

export function roundPrice(v, rule) {
  if (v == null || isNaN(v)) return null;
  switch (rule) {
    case 'none': return round2(v);
    case '5': return Math.round(v / 5) * 5;
    case '10': return Math.round(v / 10) * 10;
    case '9': return Math.max(9, Math.round(v / 10) * 10 - 1);
    default: return Math.round(v); // '1'
  }
}

export function channelFeesPct(ch) {
  return (+ch.platformFeePct || 0) + (+ch.paymentFeePct || 0);
}

// utilidad / margen / markup dados un costo y un precio final
export function analyzePrice(cost, price, feesPct = 0, fixedFee = 0) {
  if (price == null || isNaN(price) || price <= 0) return null;
  const fees = price * feesPct + (+fixedFee || 0);
  const profit = price - cost - fees;
  return {
    price, fees, profit,
    margin: profit / price,
    markup: cost ? profit / cost : null,
    viable: profit > 0,
  };
}

// precio mínimo donde utilidad = minProfitPct del precio
export function minViablePrice(cost, feesPct = 0, fixedFee = 0, minProfitPct = 0.05) {
  const d = 1 - feesPct - minProfitPct;
  return d > 0 ? (cost + (+fixedFee || 0)) / d : null;
}

export function maxSafeDiscount(price, minViable) {
  if (price == null || minViable == null || !price) return null;
  return Math.max(0, (price - minViable) / price);
}

export function channelSuggestedPrice(cost, ch, settings) {
  let p = ch.method === 'multiplier' ? priceByMultiplier(cost, ch.multiplier) : priceByMargin(cost, ch.targetMargin);
  if (p == null) return null;
  return roundPrice(p, settings.defaultRoundingRule);
}

// ---------- Advertencias ----------

export function productWarnings(db, product, settings, cost) {
  settings = settings || db.settings;
  cost = cost || productCost(db, product, settings);
  const w = [];
  if (!(product.recipe || []).length)
    w.push({ level: 'warn', msg: 'La receta está vacía — agrega materiales o productos para calcular el costo real.' });
  if (cost.missing.length)
    w.push({ level: 'danger', msg: 'Usa componentes sin costo registrado: ' + cost.missing.join(', ') + '.' });
  for (const l of cost.lines) {
    if (l.material && (l.material.status === 'archivado' || l.material.status === 'agotado'))
      w.push({ level: 'warn', msg: '"' + l.material.name + '" está ' + l.material.status + '.' });
    if (l.product && (l.product.status === 'archivado' || l.product.status === 'agotado' || l.product.status === 'descontinuado'))
      w.push({ level: 'warn', msg: 'El producto "' + l.product.name + '" del bundle está ' + l.product.status + '.' });
  }
  const sp = product.savedPrices || {};
  for (const chId of Object.keys(settings.channels)) {
    const cfg = settings.channels[chId];
    const s = sp[chId];
    if (!s || !s.price) continue;
    const a = analyzePrice(cost.total, +s.price, channelFeesPct(cfg), cfg.fixedFee);
    if (a && a.profit < 0)
      w.push({ level: 'danger', msg: 'El precio de ' + cfg.label + ' (' + money(+s.price, 0) + ') está por debajo del costo real.' });
    else if (a && chId !== 'friends' && a.margin < (+settings.lowMarginThreshold || 0.3))
      w.push({ level: 'warn', msg: 'Margen bajo en ' + cfg.label + ': ' + pct(a.margin) + '.' });
    if (s.costSnapshot != null && Math.abs(+s.costSnapshot - cost.total) > 0.5)
      w.push({ level: 'info', msg: 'El costo cambió desde que guardaste el precio de ' + cfg.label + ' — recalcula.' });
  }
  return w;
}

// ============================================================
// DATOS SEED — reconstruidos del Excel real de KYN Studio
// (costos unitarios reales: Biothane $83.02/m, O-ring $55.10,
//  D-ring $64.72, trigger snap $155.84, swivel $180, etc.)
// ============================================================

// Construye una compra cuyos costos reales unitarios (con extras
// distribuidos) coinciden EXACTO con los del Excel.
function buildPurchase(cfg) {
  const rate = cfg.currency === 'MXN' ? 1 : cfg.exchangeRate;
  const f = cfg.extraRatio; // extras como fracción del subtotal
  const items = cfg.targets.map((t) => ({
    id: uid(),
    materialId: t.materialId,
    quantity: t.quantity,
    unit: t.unit,
    originalUnitPrice: t.realUnitMXN / (rate * (1 + f)),
    notes: t.notes || '',
  }));
  const subtotal = items.reduce((s, it) => s + it.originalUnitPrice * it.quantity, 0);
  const extras = subtotal * f;
  const split = cfg.extraSplit || { shippingCost: 1 };
  const p = {
    id: cfg.id, name: cfg.name, supplier: cfg.supplier, date: cfg.date,
    currency: cfg.currency, exchangeRate: rate,
    shippingCost: 0, taxes: 0, importFees: 0, paymentFees: 0, otherFees: 0,
    allocationMethod: 'cost', notes: cfg.notes || '', items,
    createdAt: cfg.date, updatedAt: cfg.date,
  };
  for (const k of Object.keys(split)) p[k] = round2(extras * split[k]);
  // ajusta redondeo residual al envío
  const diff = extras - purchaseExtras(p);
  p.shippingCost = round2(p.shippingCost + diff);
  return p;
}

export function makeSeedDB() {
  const M = (id, name, category, subcategory, unit, extra) => ({
    id, name, category, subcategory: subcategory || '', unit,
    costingMethod: 'last', manualCost: null, currentUnitCost: null,
    supplier: '', color: '', size: '', variant: '', sku: '',
    status: 'activo', notes: '', createdAt: '2026-05-01', updatedAt: '2026-06-20',
    ...(extra || {}),
  });

  const materials = [
    M('m_bio_peri', 'Biothane Periwinkle', 'Biothane', 'Beta 19 mm', 'm', { color: 'Periwinkle', size: '19 mm', supplier: 'BioThane USA' }),
    M('m_bio_camel', 'Biothane Camel', 'Biothane', 'Beta 19 mm', 'm', { color: 'Camel', size: '19 mm', supplier: 'BioThane USA' }),
    M('m_bio_olive', 'Biothane Olive', 'Biothane', 'Beta 19 mm', 'm', { color: 'Olive', size: '19 mm', supplier: 'BioThane USA' }),
    M('m_bio_cafe', 'Biothane Café Claro', 'Biothane', 'Beta 19 mm', 'm', { color: 'Café claro', size: '19 mm', supplier: 'BioThane USA' }),
    M('m_oring', 'O Ring solid brass', 'Herrajes', 'Argollas', 'pza', { size: '25 mm', supplier: 'Hardware Import Co.' }),
    M('m_dring', 'D Ring solid brass', 'Herrajes', 'Argollas', 'pza', { size: '25 mm', supplier: 'Hardware Import Co.' }),
    M('m_trigger', 'Trigger Snap solid brass', 'Herrajes', 'Mosquetones', 'pza', { size: '19 mm', supplier: 'Hardware Import Co.' }),
    M('m_swivel', 'Swivel Hook solid brass', 'Herrajes', 'Mosquetones', 'pza', { size: '19 mm', supplier: 'Hardware Import Co.' }),
    M('m_mini_swivel', 'Mini Swivel Hook', 'Herrajes', 'Mosquetones', 'pza', { size: '13 mm', supplier: 'Hardware Import Co.' }),
    M('m_slider', 'Slider solid brass', 'Herrajes', 'Conectores', 'pza', { size: '19 mm', supplier: 'Hardware Import Co.' }),
    M('m_cs5', 'Chicago Screw 5 mm', 'Remaches', 'Chicago screws', 'pza', { size: '5 mm', supplier: 'Hardware Import Co.' }),
    M('m_cs65', 'Chicago Screw 6.5 mm', 'Remaches', 'Chicago screws', 'pza', { size: '6.5 mm', supplier: 'Hardware Import Co.' }),
    M('m_buckle', 'Buckle M solid brass', 'Hebillas', '', 'pza', { size: 'M', supplier: 'Hardware Import Co.' }),
    M('m_eyelets', 'Ojillos latón', 'Remaches', 'Ojillos', 'pza', { size: '8 mm', supplier: 'Mercería local' }),
    M('m_box', 'Caja kraft KYN', 'Empaque', 'Cajas', 'pza', { supplier: 'Empaques MX' }),
    M('m_label', 'Etiqueta tejida KYN', 'Etiquetas', '', 'pza', { supplier: 'Etiquetas Deluxe' }),
    M('m_tissue', 'Papel tissue', 'Empaque', 'Consumibles', 'pza', { supplier: 'Empaques MX' }),
    M('m_paracord', 'Paracord ámbar', 'Paracord', '', 'm', { color: 'Ámbar', status: 'prueba', notes: 'Material en prueba para el Metro Trio. Todavía sin compra registrada.' }),
  ];

  const purchases = [
    buildPurchase({
      id: 'pu_bio', name: 'Pedido BioThane® rollos 30.48 m', supplier: 'BioThane USA',
      date: '2026-05-12', currency: 'USD', exchangeRate: 18.35, extraRatio: 0.1036,
      extraSplit: { shippingCost: 0.62, importFees: 0.38 },
      notes: 'Cuatro rollos Beta de 100 ft. Envío UPS + gastos de importación distribuidos por costo.',
      targets: [
        { materialId: 'm_bio_peri', quantity: 30.48, unit: 'm', realUnitMXN: 83.0246 },
        { materialId: 'm_bio_camel', quantity: 30.48, unit: 'm', realUnitMXN: 83.0246 },
        { materialId: 'm_bio_olive', quantity: 30.48, unit: 'm', realUnitMXN: 83.0246 },
        { materialId: 'm_bio_cafe', quantity: 30.48, unit: 'm', realUnitMXN: 83.0246 },
      ],
    }),
    buildPurchase({
      id: 'pu_hw', name: 'Herrajes solid brass — lote 1', supplier: 'Hardware Import Co.',
      date: '2026-05-28', currency: 'USD', exchangeRate: 17.85, extraRatio: 0.092,
      extraSplit: { shippingCost: 0.55, taxes: 0.45 },
      notes: 'Herrajes de latón sólido. Incluye impuestos de importación.',
      targets: [
        { materialId: 'm_oring', quantity: 15, unit: 'pza', realUnitMXN: 55.1 },
        { materialId: 'm_dring', quantity: 15, unit: 'pza', realUnitMXN: 64.72 },
        { materialId: 'm_trigger', quantity: 10, unit: 'pza', realUnitMXN: 155.84 },
        { materialId: 'm_swivel', quantity: 10, unit: 'pza', realUnitMXN: 180 },
        { materialId: 'm_mini_swivel', quantity: 5, unit: 'pza', realUnitMXN: 143 },
        { materialId: 'm_slider', quantity: 20, unit: 'pza', realUnitMXN: 49.85 },
        { materialId: 'm_cs5', quantity: 50, unit: 'pza', realUnitMXN: 16.23 },
        { materialId: 'm_cs65', quantity: 50, unit: 'pza', realUnitMXN: 16.23 },
        { materialId: 'm_buckle', quantity: 10, unit: 'pza', realUnitMXN: 80.92 },
        { materialId: 'm_eyelets', quantity: 100, unit: 'pza', realUnitMXN: 2.33 },
      ],
    }),
    {
      id: 'pu_pack', name: 'Empaque y etiquetas', supplier: 'Empaques MX / Etiquetas Deluxe',
      date: '2026-06-10', currency: 'MXN', exchangeRate: 1,
      shippingCost: 150, taxes: 0, importFees: 0, paymentFees: 0, otherFees: 0,
      allocationMethod: 'cost', notes: 'Compra nacional. Solo envío local.',
      createdAt: '2026-06-10', updatedAt: '2026-06-10',
      items: [
        { id: uid(), materialId: 'm_box', quantity: 50, unit: 'pza', originalUnitPrice: 18, notes: '' },
        { id: uid(), materialId: 'm_label', quantity: 100, unit: 'pza', originalUnitPrice: 4.5, notes: '' },
        { id: uid(), materialId: 'm_tissue', quantity: 100, unit: 'pza', originalUnitPrice: 2, notes: '' },
      ],
    },
  ];

  const settings = {
    baseCurrency: 'MXN',
    defaultExchangeRate: 18.35,
    defaultLaborHourlyRate: 80,
    defaultWastePercentage: 0,
    defaultAllocationMethod: 'cost',
    defaultCostingMethod: 'last',
    defaultRoundingRule: '1',
    lowMarginThreshold: 0.3,
    minProfitPct: 0.05,
    autoRecalc: true,
    channels: {
      online: { label: 'Venta en línea', method: 'margin', targetMargin: 0.47, multiplier: 2.5, platformFeePct: 0.04, paymentFeePct: 0.036, fixedFee: 0, shippingAbsorbed: false },
      inPerson: { label: 'En persona', method: 'margin', targetMargin: 0.36, multiplier: 2.0, platformFeePct: 0, paymentFeePct: 0.028, fixedFee: 0, shippingAbsorbed: false },
      friends: { label: 'Familia y amigos', method: 'margin', targetMargin: 0.21, multiplier: 1.35, platformFeePct: 0, paymentFeePct: 0, fixedFee: 0, shippingAbsorbed: false },
    },
  };

  const P = (id, name, category, extra) => ({
    id, name, category, status: 'activo', version: 'v1', description: '',
    laborTimeMinutes: 0, laborHourlyRate: null, packagingCost: 0,
    wastePercentage: null, customizationCost: 0, otherCosts: 0,
    notes: '', recipe: [], savedPrices: {},
    createdAt: '2026-05-15', updatedAt: '2026-06-25',
    ...(extra || {}),
  });
  const R = (materialId, quantity, unit) => ({ id: uid(), materialId, quantity, unit, notes: '' });

  const products = [
    P('p_leash', 'The Urban Leash', 'Correas', {
      description: 'Correa urbana de Biothane con herrajes solid brass.',
      laborTimeMinutes: 25,
      recipe: [R('m_bio_peri', 1.78, 'm'), R('m_oring', 1, 'pza'), R('m_dring', 1, 'pza'), R('m_trigger', 1, 'pza'), R('m_swivel', 1, 'pza'), R('m_cs65', 6, 'pza'), R('m_slider', 1, 'pza')],
    }),
    P('p_cross', 'The Urban Crossbody', 'Correas', {
      description: 'Correa crossbody manos libres.',
      laborTimeMinutes: 18,
      recipe: [R('m_bio_peri', 1.6, 'm'), R('m_oring', 1, 'pza'), R('m_dring', 1, 'pza'), R('m_trigger', 1, 'pza'), R('m_cs65', 4, 'pza'), R('m_slider', 1, 'pza')],
    }),
    P('p_duo', 'The Urban Duo', 'Correas', {
      description: 'Correa dual para dos perros.',
      laborTimeMinutes: 90,
      recipe: [R('m_bio_camel', 3.1, 'm'), R('m_oring', 3, 'pza'), R('m_dring', 1, 'pza'), R('m_swivel', 3, 'pza'), R('m_cs65', 12, 'pza'), R('m_slider', 3, 'pza')],
    }),
    P('p_long3', 'The Urban Long Leash 3 m', 'Correas', {
      description: 'Correa larga de entrenamiento, 3 metros.',
      laborTimeMinutes: 30,
      recipe: [R('m_bio_olive', 3, 'm'), R('m_oring', 1, 'pza'), R('m_dring', 1, 'pza'), R('m_swivel', 1, 'pza')],
    }),
    P('p_long5', 'The Urban Long Leash 5 m', 'Correas', {
      description: 'Correa larga de entrenamiento, 5 metros.',
      laborTimeMinutes: 30,
      recipe: [R('m_bio_peri', 5, 'm'), R('m_oring', 1, 'pza'), R('m_dring', 1, 'pza'), R('m_swivel', 1, 'pza')],
    }),
    P('p_collar', 'The Everyday Collar', 'Collares', {
      description: 'Collar de Biothane con hebilla solid brass.',
      laborTimeMinutes: 30,
      recipe: [R('m_bio_camel', 0.6, 'm'), R('m_buckle', 1, 'pza'), R('m_dring', 1, 'pza'), R('m_eyelets', 4, 'pza'), R('m_slider', 1, 'pza')],
    }),
    P('p_handle', 'The Traffic Handle', 'Accesorios', {
      description: 'Agarradera corta de control.',
      laborTimeMinutes: 15,
      recipe: [R('m_bio_olive', 1.2, 'm'), R('m_swivel', 1, 'pza'), R('m_oring', 1, 'pza'), R('m_dring', 1, 'pza'), R('m_cs65', 6, 'pza')],
    }),
    P('p_metro', 'The Metro Trio', 'Sistemas modulares', {
      status: 'prototipo', version: 'proto 2',
      description: 'Sistema modular en prueba: extensión + handle + crossbody.',
      laborTimeMinutes: 120,
      notes: 'Prueba con paracord ámbar — aún sin costo de compra registrado.',
      recipe: [R('m_bio_peri', 2.4, 'm'), R('m_paracord', 3, 'm'), R('m_swivel', 3, 'pza'), R('m_oring', 2, 'pza'), R('m_cs65', 8, 'pza')],
    }),
  ];

  // Seeding SIN datos de ejemplo, a propósito: son contactos reales y unas
  // cuentas inventadas aquí se confunden con cuentas verdaderas. La lista
  // real vive en Notion (KYN Seeding Tracker).
  const seeding = [];

  // Crecimiento SIN datos de ejemplo, igual que seeding: las mediciones de
  // seguidores son datos reales que captura la usuaria; inventarlas confunde.
  const growth = [];

  const db = { materials, purchases, products, seeding, growth, settings };

  // Precios finales del Excel, con snapshot del costo actual
  const excelPrices = {
    p_leash: [1480, 1221, 989],
    p_cross: [1078, 890, 721],
    p_duo: [2815, 2322, 1881],
    p_long3: [1113, 918, 744],
    p_long5: [1426, 1177, 953],
    p_collar: [566, 467, 378],
    p_handle: [974, 804, 651],
  };
  for (const pr of products) {
    const px = excelPrices[pr.id];
    if (!px) continue;
    const cost = productCost(db, pr, settings).total;
    pr.savedPrices = {
      online: { price: px[0], costSnapshot: cost, savedAt: '2026-06-25' },
      inPerson: { price: px[1], costSnapshot: cost, savedAt: '2026-06-25' },
      friends: { price: px[2], costSnapshot: cost, savedAt: '2026-06-25' },
    };
  }
  return db;
}

export const MATERIAL_CATEGORIES = ['Biothane', 'Herrajes', 'Mosquetones', 'Argollas', 'Hebillas', 'Remaches', 'Hilo', 'Paracord', 'Empaque', 'Etiquetas', 'Consumibles', 'Herramientas', 'Otros'];
export const PRODUCT_CATEGORIES = ['Correas', 'Collares', 'Sistemas modulares', 'Bundles', 'Accesorios', 'Personalizado', 'Otros'];
export const UNITS = ['m', 'cm', 'pza', 'par', 'rollo', 'kg', 'g', 'ml', 'hr'];

// ---------- Seeding ----------
// `v` = valor EXACTO de la opción en Notion (sin acentos, para no crear
// opciones duplicadas al sincronizar). `label` = como se muestra en la app.
// `bg`/`fg` = colores del chip, alineados con los colores de Notion.
export const SEEDING_STATUS = [
  { v: 'Por contactar', label: 'Por contactar', bg: '#EFEDF1', fg: '#6B6873' },
  { v: 'Contactada',    label: 'Contactada',    bg: '#FBF0D0', fg: '#8A6D1F' },
  { v: 'Respondio',     label: 'Respondió',     bg: '#DCE6FB', fg: '#3A5BB0' },
  { v: 'Enviado',       label: 'Enviado',       bg: '#FBE3CE', fg: '#9C5A22' },
  { v: 'Publico',       label: 'Publicó',       bg: '#D6F0DE', fg: '#2E7D4F' },
  { v: 'Descartada',    label: 'Descartada',    bg: '#FBDCE4', fg: '#9B4D67' },
];
export const SEEDING_CITIES = [
  { v: 'Guadalajara', label: 'Guadalajara' },
  { v: 'Queretaro',   label: 'Querétaro' },
  { v: 'CDMX',        label: 'CDMX' },
  { v: 'Puebla',      label: 'Puebla' },
  { v: 'Mexico',      label: 'México' },
  { v: 'Otro',        label: 'Otro' },
];

// ---------- Crecimiento (seguidores) ----------
// Las 4 series que se miden. `v` de cuenta/plataforma = valor EXACTO de la
// opción en la base "KYN Crecimiento" de Notion.
export const GROWTH_ACCOUNTS = [
  { cuenta: '@kynstudio', plataforma: 'Instagram' },
  { cuenta: '@kynstudio', plataforma: 'TikTok' },
  { cuenta: '@soykenna',  plataforma: 'Instagram' },
  { cuenta: '@soykenna',  plataforma: 'TikTok' },
];

export const fmtInt = (n) =>
  n == null || isNaN(n) ? '—' : Math.round(+n).toLocaleString('es-MX');

// suma días a una fecha 'YYYY-MM-DD' (en UTC, sin sorpresas de zona horaria)
export function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d)) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Mediciones de una serie (cuenta+plataforma) ordenadas por fecha ascendente.
// Si hay dos del mismo día gana la más reciente por orden de creación.
export function growthSeries(db, cuenta, plataforma) {
  return (db.growth || [])
    .filter((g) => g.cuenta === cuenta && g.plataforma === plataforma && g.fecha && g.seguidores != null && !isNaN(+g.seguidores))
    .sort((a, b) => (a.fecha === b.fecha ? (a.createdTime || '').localeCompare(b.createdTime || '') : a.fecha.localeCompare(b.fecha)));
}

// Resumen de una serie: último valor, cambio vs medición anterior y cambio
// vs la medición más cercana a 30 días atrás (si existe alguna anterior).
export function growthStats(db, cuenta, plataforma) {
  const serie = growthSeries(db, cuenta, plataforma);
  if (!serie.length) return { serie, last: null, prev: null, deltaPrev: null, base30: null, delta30: null, pct30: null };
  const last = serie[serie.length - 1];
  const prev = serie.length > 1 ? serie[serie.length - 2] : null;
  const cutoff = addDaysISO(last.fecha, -30);
  // referencia: la última medición con fecha ≤ 30 días antes de la última;
  // si el historial es más corto, la más antigua disponible.
  let base30 = null;
  for (const g of serie) {
    if (g === last) break;
    if (g.fecha <= cutoff) base30 = g;
  }
  if (!base30 && serie.length > 1) base30 = serie[0];
  const full30 = !!(base30 && base30.fecha <= cutoff);
  const deltaPrev = prev ? +last.seguidores - +prev.seguidores : null;
  const delta30 = base30 ? +last.seguidores - +base30.seguidores : null;
  const pct30 = base30 && +base30.seguidores > 0 ? (+last.seguidores - +base30.seguidores) / +base30.seguidores : null;
  return { serie, last, prev, deltaPrev, base30, delta30, pct30, full30 };
}
