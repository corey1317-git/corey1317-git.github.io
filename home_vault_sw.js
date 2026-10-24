// Home Vault service worker: offline support for the installed app.
// Pages: network-first (always fresh when online). Static assets + CDNs: stale-while-revalidate.
const CACHE = 'home-vault-v1';
const CORE = [
    'home_vault.html',
    'home_vault.webmanifest',
    'big_jim_avatar.jpg',
    'home_vault_icon_192.png',
    'home_vault_icon_512.png',
    'home_vault_apple_touch.png'
];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('home-vault-') && k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put('home_vault.html', copy));
                    return res;
                })
                .catch(() => caches.match('home_vault.html'))
        );
        return;
    }

    const sameOrigin = url.origin === self.location.origin;
    if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return; // AI APIs, analytics, etc. go straight to the network

    event.respondWith(
        caches.open(CACHE).then(cache =>
            cache.match(req).then(cached => {
                const network = fetch(req)
                    .then(res => {
                        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
                        return res;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        )
    );
});
