#!/usr/bin/env node
// ============================================================
// KYN Cost Studio · servidor local
// 1) Sirve la app (index.html y archivos estáticos).
// 2) Proxy /api/notion/* → https://api.notion.com/v1/*
//    agregando tu token de integración (notion-config.json),
//    porque el API de Notion no acepta llamadas directas
//    desde el navegador.
// Sin dependencias — solo Node.
// ============================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'notion-config.json');

function readConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return cfg || {};
  } catch {
    return {};
  }
}

const PORT = readConfig().port || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('No encontrado: ' + urlPath); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

function proxyNotion(req, res) {
  const token = process.env.NOTION_TOKEN || readConfig().notionToken || '';
  if (!token || /PEGA|AQUI|xxxx/i.test(token)) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 'no_token', message: 'Falta el token de Notion. Ábrelo en notion-config.json y pega tu token de integración.' }));
    return;
  }
  const notionPath = '/v1/' + req.url.replace(/^\/api\/notion\//, '');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const preq = https.request({
      hostname: 'api.notion.com',
      path: notionPath,
      method: req.method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    }, (pres) => {
      res.writeHead(pres.statusCode || 500, { 'Content-Type': 'application/json' });
      pres.pipe(res);
    });
    preq.on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'proxy_error', message: 'Sin conexión con Notion: ' + e.message }));
    });
    preq.end(body);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/notion/')) proxyNotion(req, res);
  else serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = 'http://localhost:' + PORT;
  console.log('');
  console.log('  KYN Cost Studio corriendo en ' + url);
  console.log('  (deja esta ventana abierta mientras uses la app)');
  console.log('');
  if (process.platform === 'darwin' && !process.env.KYN_NO_OPEN) {
    execFile('open', [url], () => {});
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('El puerto ' + PORT + ' ya está en uso — probablemente la app ya está corriendo.');
    if (process.platform === 'darwin' && !process.env.KYN_NO_OPEN) execFile('open', ['http://localhost:' + PORT], () => {});
  } else {
    console.error(e);
  }
});
