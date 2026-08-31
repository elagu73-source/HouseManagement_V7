const CACHE_NAME = "house-management-v48";

const ARCHIVOS = [
    "./",
    "./index.html",
    "./politica-privacidad.html",
    "./terminos-condiciones.html",
    "./manifest.json",

    "./css/style.css?v=8",

    "./js/supabase.js?v=109",
    "./js/storage.js?v=2",
    "./js/photos.js",
    "./js/app.js?v=136",

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
    badge: "./icon-192.png",
    data: {
        notificationId:
            data.notificationId || "",
        organizationId:
            data.organizationId || "",
        houseId:
            data.houseId || "",
        entityType:
            data.entityType || "",
        entityId:
            data.entityId || ""
    }
};

    event.waitUntil(
        self.registration.showNotification(
            data.title || "House Management",
            options
        )
    );
});

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();

        const data =
            event.notification.data || {};

        const destination =
            new URL(
                "./",
                self.registration.scope
            );

        if (data.notificationId) {
            destination.searchParams.set(
                "notification",
                data.notificationId
            );
        }

        if (data.organizationId) {
            destination.searchParams.set(
                "organization",
                data.organizationId
            );
        }

        if (data.houseId) {
            destination.searchParams.set(
                "house",
                data.houseId
            );
        }

        if (data.entityType) {
            destination.searchParams.set(
                "entity",
                data.entityType
            );
        }

        event.waitUntil(
            (async () => {

                const windows =
                    await clients.matchAll({
                        type: "window",
                        includeUncontrolled: true
                    });

                if (windows.length > 0) {

                    const appWindow =
                        windows[0];

                    await appWindow.navigate(
                        destination.href
                    );

                    return appWindow.focus();
                }

                return clients.openWindow(
                    destination.href
                );
            })()
        );
    }
);