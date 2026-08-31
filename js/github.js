// FALLBACK — solo se usa si data/photos.json todavía no existe
// (por ejemplo, abriendo index.html en local sin haber hecho
// "npm run build", o si la Action de despliegue aún no ha corrido).
//
// En condiciones normales el sitio lee el catálogo estático que genera
// la Action y NO llama a la API de GitHub. Ver js/photos.js.

const DEMO_PHOTOS = {
  italia: ["01.jpg", "02.jpg", "03.jpg", "04.jpg"],
  francia: ["01.jpg", "02.jpg", "03.jpg", "04.jpg"],
  japon: ["01.jpg", "02.jpg", "03.jpg", "04.jpg"],
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const API_TTL_MS = 10 * 60 * 1000; // cachea la respuesta de la API 10 min

function isDemoMode() {
  return (
    !SITE_CONFIG.githubUser ||
    SITE_CONFIG.githubUser.trim() === "" ||
    SITE_CONFIG.githubUser === "TU-USUARIO-DE-GITHUB"
  );
}

function prettyCaption(filename) {
  const raw = filename.replace(IMAGE_EXT, "").replace(/[-_]+/g, " ").trim();
  const junk = [
    /^\d+$/,
    /^img[\s_]*\d+/i,
    /^dscn?\d+/i,
    /^pxl[\s_]*\d+/i,
    /^screenshot/i,
    /^captura/i,
    /^dji[\s_]*fly/i,
    /^[0-9a-f]{6,}(\s+[0-9a-f]{2,})*$/i, // hex / UUID troceado
    /^whatsapp/i,
  ];
  if (raw.length < 2 || junk.some((re) => re.test(raw))) return "";
  return raw;
}

// Redimensiona vía un CDN gratuito para que el fallback tampoco cargue
// fotos de 3 MB (images.weserv.nl / wsrv.nl).
function optimized(rawUrl, width) {
  const host = rawUrl.replace(/^https?:\/\//, "");
  return `https://wsrv.nl/?url=${encodeURIComponent(host)}&w=${width}&output=webp&q=80`;
}

function localDemoList(countryId) {
  const files = DEMO_PHOTOS[countryId] || [];
  return files.map((f) => ({
    type: "photo",
    url: `photos/${countryId}/${f}`,
    thumb: `photos/${countryId}/${f}`,
    caption: prettyCaption(f),
  }));
}

async function fetchPhotoListFallback(countryId) {
  if (isDemoMode()) return localDemoList(countryId);

  const { githubUser, githubRepo, branch } = SITE_CONFIG;
  const cacheKey = `gh:${githubUser}/${githubRepo}/${branch}/${countryId}`;

  try {
    const hit = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (hit && Date.now() - hit.t < API_TTL_MS) return hit.list;
  } catch {
    /* sessionStorage no disponible */
  }

  const apiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/photos/${encodeURIComponent(
    countryId
  )}?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(apiUrl, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) return [];
  if (res.status === 403) {
    throw new Error("límite de la API de GitHub alcanzado (falta desplegar con la Action)");
  }
  if (!res.ok) throw new Error(`GitHub API respondió ${res.status}`);

  const items = await res.json();
  const list = items
    .filter((item) => item.type === "file" && IMAGE_EXT.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
    .map((item) => ({
      type: "photo",
      url: optimized(item.download_url, 2000),
      thumb: optimized(item.download_url, 600),
      caption: prettyCaption(item.name),
    }));

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), list }));
  } catch {
    /* ignora si no hay espacio */
  }
  return list;
}
