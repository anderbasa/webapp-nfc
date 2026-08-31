// Dibuja el "corcho" de la home: un imán por cada viaje de countries.js.
// La portada de cada imán es la primera foto del álbum, servida ya como
// miniatura ligera desde el catálogo (data/photos.json).

(async function () {
  const board = document.getElementById("board");

  if (!Array.isArray(COUNTRIES) || COUNTRIES.length === 0) {
    board.innerHTML = `<p class="board-empty">Aún no hay ningún viaje añadido.<br>Edita <code>js/countries.js</code> para crear tu primer imán.</p>`;
    return;
  }

  board.innerHTML = COUNTRIES.map(magnetSkeleton).join("");

  // Carga las portadas en paralelo. Con el catálogo esto es instantáneo
  // (no hay una petición de red por imán); sin él, cae al fallback.
  await Promise.allSettled(
    COUNTRIES.map(async (country) => {
      const frame = board.querySelector(`[data-cover="${country.id}"]`);
      if (!frame) return;
      const img = frame.querySelector("img");
      try {
        const cover = await fetchAlbumCover(country.id);
        if (!cover) {
          frame.classList.remove("is-loading");
          frame.classList.add("is-empty");
          return;
        }
        img.addEventListener(
          "load",
          () => {
            frame.classList.remove("is-loading");
            frame.classList.add("is-loaded");
          },
          { once: true }
        );
        img.addEventListener(
          "error",
          () => {
            frame.classList.remove("is-loading");
            frame.classList.add("is-empty");
          },
          { once: true }
        );
        img.src = cover;
        img.alt = `Recuerdo de ${country.nombre}`;
      } catch {
        frame.classList.remove("is-loading");
        frame.classList.add("is-empty");
      }
    })
  );

  function magnetSkeleton(c) {
    const nombre = escapeHtml(c.nombre);
    const fecha = escapeHtml(c.fecha || "");
    const nota = escapeHtml(c.nota || "");
    return `
      <a class="magnet" href="album.html?id=${encodeURIComponent(c.id)}" aria-label="${nombre}${fecha ? ", " + fecha : ""}">
        <span class="magnet-pin" aria-hidden="true"></span>
        <span class="magnet-frame is-loading" data-cover="${escapeHtml(c.id)}">
          <img class="magnet-photo" alt="" loading="lazy" decoding="async" />
          <span class="magnet-flag" aria-hidden="true">${escapeHtml(c.bandera || "")}</span>
        </span>
        <span class="magnet-caption">
          <span class="magnet-name">${nombre}</span>
          <span class="magnet-date">${fecha}</span>
          ${nota ? `<span class="magnet-note">${nota}</span>` : ""}
        </span>
      </a>`;
  }
})();
