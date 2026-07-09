// ============================================================
// KYN Cost Studio · puente a Notion para Netlify
// Es el equivalente del proxy de server.js, pero como Netlify
// Function: la app en kyncost (Netlify) llama /api/notion/* y
// esta función reenvía a https://api.notion.com/v1/* agregando
// el token que vive en la variable de ambiente NOTION_TOKEN
// (Site configuration → Environment variables).
//
// Opcional pero recomendado: define también KYN_PIN. Si existe,
// la función exige ese PIN (la app lo pide una sola vez y lo
// recuerda); sin PIN, cualquiera que descubra la URL del sitio
// podría leer y escribir tus bases de Notion.
// ============================================================

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  const token = process.env.NOTION_TOKEN || '';
  if (!token || /PEGA|AQUI|xxxx/i.test(token)) {
    return json(503, { code: 'no_token', message: 'Falta NOTION_TOKEN en Netlify (Site configuration → Environment variables).' });
  }

  const pin = (process.env.KYN_PIN || '').trim();
  if (pin && (req.headers.get('x-kyn-pin') || '').trim() !== pin) {
    return json(401, { code: 'need_pin', message: 'PIN incorrecto o faltante.' });
  }

  const url = new URL(req.url);
  const notionPath = url.pathname.replace(/^\/api\/notion\//, '');
  if (!notionPath || notionPath.startsWith('/') || notionPath.includes('..')) {
    return json(400, { code: 'bad_path', message: 'Ruta inválida.' });
  }

  const init = {
    method: req.method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await req.text();

  try {
    const res = await fetch('https://api.notion.com/v1/' + notionPath + url.search, init);
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return json(502, { code: 'proxy_error', message: 'Sin conexión con Notion: ' + (e && e.message ? e.message : e) });
  }
};

export const config = { path: '/api/notion/*' };
