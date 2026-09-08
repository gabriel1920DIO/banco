/* Guarda o app no aparelho: depois da primeira abertura, funciona sem internet. */
const CACHE = 'barraca-v1';
const ARQUIVOS = [
  '.', 'index.html', 'manifest.webmanifest',
  'css/styles.css', 'js/store.js', 'js/parser.js', 'js/receipt.js', 'js/app.js',
  'icones/icone.svg', 'icones/icone-192.png', 'icones/icone-512.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  ev.respondWith(
    caches.match(req).then(guardado => {
      /* Serve o que está guardado e atualiza por trás, para a próxima abertura. */
      const rede = fetch(req).then(resp => {
        if (resp.ok) caches.open(CACHE).then(c => c.put(req, resp.clone()));
        return resp;
      }).catch(() => guardado);
      return guardado || rede;
    })
  );
});
