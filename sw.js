const CACHE_NAME = "house-management-v30";

const ARCHIVOS = [
    "./",
    "./index.html",
    "./politica-privacidad.html",
    "./terminos-condiciones.html",
    "./manifest.json",

    "./css/style.css?v=6",

    "./js/supabase.js?v=105",
    "./js/storage.js?v=2",
    "./js/photos.js",
    "./js/app.js?v=123",

    "./logo-house-management.png",

    "./icon-192.png",
    "./icon-512-v2.png",
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

    const request = event.request;

    // No intervenir en POST, PUT, DELETE, etc.
    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

   // Librería externa de Supabase
if (url.hostname === "cdn.jsdelivr.net") {

    event.respondWith(
        fetch(request)
            .then(response => {

                const copia = response.clone();

                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(request, copia);
                    });

                return response;
            })
            .catch(() => caches.match(request))
    );

    return;
}

// Librería externa de Supabase
if (url.hostname === "cdn.jsdelivr.net") {

    event.respondWith(
        fetch(request)
            .then(response => {

                const copia = response.clone();

                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(request, copia);
                    });

                return response;
            })
            .catch(() => caches.match(request))
    );

    return;
}


// No intervenir en Supabase ni otros dominios externos
if (url.origin !== self.location.origin) {
    return;
}

    // Navegación principal
    if (request.mode === "navigate") {

        event.respondWith(
            fetch(request)
                .catch(() => caches.match("./index.html"))
        );

        return;
    }

    // Archivos locales
    event.respondWith(
        fetch(request)
            .then(response => {

                if (response && response.ok) {

                    const copia = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(request, copia);
                        });
                }

                return response;
            })
            .catch(() => caches.match(request))
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