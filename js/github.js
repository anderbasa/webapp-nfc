// Va a buscar la lista de fotos de un país directamente a la carpeta
// /photos/<id> de tu repositorio de GitHub. Así, para añadir o cambiar
// fotos, solo tienes que subir/borrar imágenes en esa carpeta desde la
// propia web de GitHub — nunca hace falta tocar código.
//
// Mientras no hayas configurado tu usuario real en js/config.js (o si
// aún no tienes conexión), se usan las fotos de muestra que vienen en
// este proyecto, para que puedas ver cómo queda todo desde ya.

const DEMO_PHOTOS = {
  italia: ["01.jpg", "02.jpg", "03.jpg", "04.jpg"],
  francia: ["01.jpg", "02.jpg", "03.jpg", "04.jpg"],
  japon: ["01.jpg", "02.jpg", "03.jpg", "04.jpg"],
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

function isDemoMode() {
  return (
    !SITE_CONFIG.githubUser ||
    SITE_CONFIG.githubUser.trim() === "" ||
    SITE_CONFIG.githubUser === "TU-USUARIO-DE-GITHUB"
  );
}

function prettyCaption(filename) {
  const base = filename.replace(IMAGE_EXT, "");
  const cleaned = base.replace(/[-_]+/g, " ").trim();
  // Si el nombre es solo números (ej. "01", "IMG_2043"), no mostramos nada.
  if (/^\d+$/.test(cleaned) || /^img\s*\d+$/i.test(cleaned)) return "";
  return cleaned;
}

function localDemoList(countryId) {
  const files = DEMO_PHOTOS[countryId] || [];
  return files.map((f) => ({
    url: `photos/${countryId}/${f}`,
    caption: prettyCaption(f),
  }));
}

async function fetchPhotoList(countryId) {
  if (isDemoMode()) {
    return localDemoList(countryId);
  }

  const { githubUser, githubRepo, branch } = SITE_CONFIG;
  const apiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/photos/${encodeURIComponent(
    countryId
  )}?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (res.status === 404) {
    // La carpeta aún no existe o está vacía: no es un error, simplemente no hay fotos.
    return [];
  }
  if (!res.ok) {
    throw new Error(`GitHub API respondió ${res.status}`);
  }

  const items = await res.json();
  return items
    .filter((item) => item.type === "file" && IMAGE_EXT.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((item) => ({
      url: item.download_url,
      caption: prettyCaption(item.name),
    }));
}
