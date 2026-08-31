// Capa de datos del sitio.
//
// Lee UNA sola vez el catálogo estático data/photos.json (lo genera la
// Action al desplegar). Con eso el corcho y todos los álbumes funcionan
// sin una sola llamada a la API de GitHub, al instante y offline.
//
// Si el catálogo no está (pruebas en local sin build), usa el fallback
// de js/github.js.

let _catalogPromise = null;

function loadCatalog() {
  if (!_catalogPromise) {
    _catalogPromise = fetch("data/photos.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return _catalogPromise;
}

async function getAlbumFromCatalog(id) {
  const cat = await loadCatalog();
  if (!cat || !cat.albums) return null;
  return cat.albums[id] || { entries: [], count: 0, cover: null };
}

// Lista normalizada de un álbum: [{ type, url, thumb, w, h, caption }]
// url  -> versión grande (visor)
// thumb -> miniatura (grid / portada)
async function fetchPhotoList(countryId) {
  const album = await getAlbumFromCatalog(countryId);
  if (album) {
    return album.entries.map((e) =>
      e.type === "video"
        ? { type: "video", url: e.src, thumb: e.poster || null, poster: e.poster || null, caption: e.caption || "" }
        : {
            type: "photo",
            url: e.large,
            thumb: e.thumb,
            w: e.w,
            h: e.h,
            caption: e.caption || "",
          }
    );
  }
  return fetchPhotoListFallback(countryId);
}

// Portada de un imán (primera foto del álbum).
async function fetchAlbumCover(countryId) {
  const album = await getAlbumFromCatalog(countryId);
  if (album) return album.cover;
  const list = await fetchPhotoListFallback(countryId).catch(() => []);
  const first = list.find((p) => p.type !== "video");
  return first ? first.thumb || first.url : null;
}

// Número de fotos de un álbum, si el catálogo está disponible (para el
// contador del billete). Devuelve null si no se sabe sin cargar todo.
async function fetchAlbumCount(countryId) {
  const album = await getAlbumFromCatalog(countryId);
  return album ? album.count : null;
}

// Escapa texto que se vaya a inyectar como HTML (nombres de archivo,
// notas...). Evita que una comilla o un < rompan el maquetado.
function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
