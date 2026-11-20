/* Pink Finance — service worker: offline, lembretes em segundo plano */
const VERSION = 'pf-v1.0.0';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/core.js', 'js/game.js', 'js/sample.js', 'js/icons.js', 'js/ui.js', 'js/actions.js', 'js/screens1.js', 'js/screens2.js', 'js/system.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/badge-96.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'pf-meta').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone())); return res; }).catch(() => hit || caches.match('index.html'));
    return hit || net;
  }));
});

const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
async function backgroundReminders() {
  const meta = await caches.open('pf-meta');
  const r = await meta.match('pf-reminders.json'); if (!r) return;
  const data = await r.json(); if (!data.enabled) return;
  if (new Date().getHours() < (data.hour || 9)) return;
  const shownRes = await meta.match('pf-shown.json'); const shown = shownRes ? await shownRes.json() : {};
  const td = todayISO(), keys = [];
  for (const it of data.items) {
    if (it.date !== td || shown[it.key]) continue;
    await self.registration.showNotification(it.title, { body: it.body, tag: it.key, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { url: './' } });
    shown[it.key] = td; keys.push(it.key);
  }
  const old = new Date(Date.now() - 30 * 864e5), cut = `${old.getFullYear()}-${pad(old.getMonth() + 1)}-${pad(old.getDate())}`;
  for (const k of Object.keys(shown)) if (shown[k] < cut) delete shown[k];
  await meta.put('pf-shown.json', new Response(JSON.stringify(shown)));
  if (keys.length) (await self.clients.matchAll()).forEach(c => c.postMessage({ type: 'shown', keys }));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'pf-reminders') e.waitUntil(backgroundReminders()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
