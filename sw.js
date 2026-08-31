// Service worker — hace que el sitio cargue al instante y funcione sin
// conexión después de la primera visita.
//
//  · App shell (html/css/js/catálogo): stale-while-revalidate.
//  · Fotos ya vistas: cache-first, con un tope para no llenar el disco.
//  · Navegación sin red: se sirve la última versión cacheada.
//
// Sube SHELL_VERSION cuando cambies el HTML/CSS/JS para forzar refresco.

const SHELL_VERSION = "v2";
const SHELL_CACHE = `shell-${SHELL_VERSION}`;
const IMG_CACHE = "img-v1";
const IMG_LIMIT = 240; // ~ suficiente para varios álbumes vistos

const SHELL_ASSETS = [
  "./",
  "index.html",
  "album.html",
  "offline.html",
  "manifest.json",
  "favicon.svg",
  "css/style.css",
  "js/config.js",
  "js/countries.js",
  "js/github.js",
  "js/photos.js",
  "js/spring.js",
  "js/app.js",
  "js/album.js",
  "js/register-sw.js",
  "data/photos.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS.map((u) => new Request(u, { cache: "reload" }))))
      .catch(() => {}) // si falta algún archivo, no bloquees la instalación
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== IMG_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isImage(url) {
  return /\.(webp|jpe?g|png|gif|avif)$/i.test(url.pathname) || url.hostname === "wsrv.nl";
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (const key of keys.slice(0, keys.length - max)) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 1. Navegación -> red primero, con la copia cacheada / offline de reserva.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("album.html")) ||
            (await caches.match("index.html")) ||
            (await caches.match("offline.html"))
          );
        })
    );
    return;
  }

  // 2. Imágenes -> cache-first, con tope de entradas.
  if (isImage(url)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok || res.type === "opaque") {
            cache.put(request, res.clone());
            trimCache(IMG_CACHE, IMG_LIMIT);
          }
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // 3. Resto same-origin (css/js/json/fuentes) -> stale-while-revalidate.
  if (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
  }
});
