const CACHE_NAME = "srm-cache-v1";
const APP_SHELL = [
  "/", // raíz
  "/index.html",
  "/dashboard.html",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/site.webmanifest"
];

// ✅ Instalar el Service Worker
self.addEventListener("install", (event) => {
  console.log("🧩 Instalando Service Worker SRM...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Archivos cacheados:", APP_SHELL);
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ✅ Activar (limpia versiones antiguas)
self.addEventListener("activate", (event) => {
  console.log("⚙️ Activando Service Worker...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🗑️ Eliminando caché antigua:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// ✅ Estrategia de red con caché (Network First)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then(resp => resp || caches.match("/offline.html")))
  );
});


// ✅ Notificación opcional (para futuras actualizaciones)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
