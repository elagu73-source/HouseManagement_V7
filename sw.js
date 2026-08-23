const CACHE_NAME = "house-management-v2";
const ARCHIVOS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png",
    "./apple-touch-icon.png"
];

self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ARCHIVOS))
    );

    self.skipWaiting();

});

self.addEventListener("activate", event => {

    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );

    self.clients.claim();

});

self.addEventListener("fetch", event => {

    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );

});

// ============================================
// NOTIFICACIONES PUSH
// ============================================

self.addEventListener("push", event => {

    let data = {
        title: "House Management",
        message: "Tenés una nueva notificación."
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (error) {
            console.error(
                "Error leyendo notificación push:",
                error
            );
        }
    }

    const options = {
        body: data.message,
        icon: "./icon-192.png",
        badge: "./icon-192.png"
    };

    event.waitUntil(
        self.registration.showNotification(
            data.title || "House Management",
            options
        )
    );
});