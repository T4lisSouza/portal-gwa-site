/* ===== INTRANET GWA :: SERVICE WORKER =====
   Deixa a intranet instalavel como app e abre mesmo com internet ruim.
   Regras:
   - a pagina (index) vem SEMPRE da internet primeiro; so usa a copia guardada
     se estiver sem conexao. Assim toda atualizacao publicada chega na hora.
   - icones e manifest ficam guardados no aparelho.
   - API, Google e CDNs NAO passam por aqui (dados sempre frescos). */
var VERSAO = 'gwa-app-v1';
var BASICO = ['./', './index.html', './manifest.webmanifest', './favicon.ico',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSAO).then(function (c) {
      return Promise.all(BASICO.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function comTempo(p, ms) {
  return new Promise(function (ok, erro) {
    var t = setTimeout(function () { erro(new Error('tempo')); }, ms);
    p.then(function (r) { clearTimeout(t); ok(r); }, function (x) { clearTimeout(t); erro(x); });
  });
}

var OFFLINE = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>GWA — sem conexão</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#0d0d0d;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}h1{color:#f0943a;font-size:22px}' +
  'button{margin-top:18px;background:linear-gradient(135deg,#f0943a,#c4661a);color:#fff;border:0;border-radius:12px;padding:13px 22px;font-weight:800;font-size:15px}</style></head>' +
  '<body><div><h1>Sem conexão com a internet</h1><p>Assim que a internet voltar, a intranet abre normalmente.</p>' +
  '<button onclick="location.reload()">Tentar de novo</button></div></body></html>';

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          /* API, fontes, CDNs: direto da rede */

  /* a pagina: internet primeiro */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0) {
    e.respondWith(
      comTempo(fetch(req), 8000).then(function (r) {
        if (r && r.ok) { var copia = r.clone(); caches.open(VERSAO).then(function (c) { c.put('./index.html', copia); }); }
        return r;
      }).catch(function () {
        return caches.match('./index.html').then(function (c) {
          return c || new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        });
      })
    );
    return;
  }

  /* icones, manifest: usa o guardado e atualiza por tras */
  e.respondWith(
    caches.match(req).then(function (guardado) {
      var rede = fetch(req).then(function (r) {
        if (r && r.ok) { var copia = r.clone(); caches.open(VERSAO).then(function (c) { c.put(req, copia); }); }
        return r;
      }).catch(function () { return guardado; });
      return guardado || rede;
    })
  );
});
