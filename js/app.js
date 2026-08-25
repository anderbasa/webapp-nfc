// Renderiza el "corcho" de la home con un imán por cada país.
// La foto de portada de cada imán es simplemente la primera foto
// que encuentre en /photos/<id>/ dentro de tu repo de GitHub.

(async function () {
  const board = document.getElementById("board");
  if (!COUNTRIES || COUNTRIES.length === 0) {
    board.innerHTML = `<p class="board-empty">Aún no hay ningún viaje añadido.<br>Edita <code>js/countries.js</code> para crear tu primer imán.</p>`;
    return;
  }

  board.innerHTML = COUNTRIES.map((c) => magnetSkeleton(c)).join("");

  // Carga la foto de portada de cada país en paralelo, sin bloquear el render.
  COUNTRIES.forEach(async (country) => {
    const imgEl = document.querySelector(`[data-cover="${country.id}"]`);
    try {
      const photos = await fetchPhotoList(country.id);
      if (photos.length > 0 && imgEl) {
        imgEl.src = photos[0].url;
        imgEl.alt = `Recuerdo de ${country.nombre}`;
      }
    } catch (err) {
      // Sin conexión al repo todavía (p.ej. estás probando en local
      // antes de subirlo a GitHub). El imán se queda con el fondo neutro.
      console.warn(`No se pudo cargar la portada de ${country.nombre}:`, err);
    }
  });

  function magnetSkeleton(c) {
    return `
      <a class="magnet" href="album.html?id=${encodeURIComponent(c.id)}">
        <span class="magnet-pin" aria-hidden="true"></span>
        <img class="magnet-photo" data-cover="${c.id}" alt="" loading="lazy" />
        <span class="magnet-flag" aria-hidden="true">${c.bandera || ""}</span>
        <span class="magnet-caption">
          <span class="magnet-name">${c.nombre}</span>
          <span class="magnet-date">${c.fecha || ""}</span>
        </span>
      </a>`;
  }
})();
