(async function () {
  const params = new URLSearchParams(location.search);
  const countryId = params.get("id");
  const country = COUNTRIES.find((c) => c.id === countryId);

  const headerEl = document.getElementById("album-header");
  const galleryEl = document.getElementById("gallery");

  if (!country) {
    headerEl.innerHTML = `
      <a class="back-link" href="index.html">&larr; volver al corcho</a>
      <div class="ticket"><p class="ticket-note">No encuentro ese viaje. Revisa el enlace del imán, o añade este país en <code>js/countries.js</code>.</p></div>`;
    return;
  }

  document.title = `${country.nombre} — Diario de viajes`;

  headerEl.innerHTML = `
    <a class="back-link" href="index.html">&larr; volver al corcho</a>
    <div class="ticket">
      <div class="ticket-row">
        <span class="ticket-country">${country.bandera || ""} ${country.nombre}</span>
        <span class="ticket-stamp">${country.fecha || ""}</span>
      </div>
      <p class="ticket-note">${country.nota || ""}</p>
    </div>`;

  galleryEl.innerHTML = `<p class="gallery-loading">Revelando fotos…</p>`;

  let photos = [];
  try {
    photos = await fetchPhotoList(country.id);
  } catch (err) {
    galleryEl.innerHTML = `
      <p class="gallery-error">
        No he podido cargar las fotos de este viaje.<br>
        Comprueba que en <code>js/config.js</code> tienes bien puesto tu usuario
        y repositorio de GitHub, y que el repositorio es público.<br>
        <em>Detalle técnico: ${err.message}</em>
      </p>`;
    return;
  }

  if (photos.length === 0) {
    galleryEl.innerHTML = `<p class="gallery-empty">Todavía no hay fotos aquí.<br>Sube alguna a la carpeta <code>photos/${country.id}</code> en GitHub y aparecerán solas.</p>`;
    return;
  }

  galleryEl.innerHTML = photos
    .map(
      (p, i) => `
      <button class="polaroid" data-index="${i}" aria-label="Ver foto ${i + 1} de ${photos.length}${p.caption ? ": " + p.caption : ""}">
        <img src="${p.url}" alt="${p.caption || `Foto ${i + 1} de ${country.nombre}`}" loading="lazy" />
        ${p.caption ? `<span class="polaroid-caption">${p.caption}</span>` : ""}
      </button>`
    )
    .join("");

  setupLightbox(photos);

  function setupLightbox(photos) {
    const lightbox = document.getElementById("lightbox");
    const lbImg = document.getElementById("lightbox-img");
    const lbCounter = document.getElementById("lightbox-counter");
    let current = 0;

    function open(index) {
      current = index;
      render();
      lightbox.hidden = false;
      lightbox.querySelector(".lightbox-close").focus();
      document.body.style.overflow = "hidden";
    }

    function close() {
      lightbox.hidden = true;
      document.body.style.overflow = "";
    }

    function render() {
      const p = photos[current];
      lbImg.src = p.url;
      lbImg.alt = p.caption || `Foto ${current + 1} de ${country.nombre}`;
      lbCounter.textContent = `${current + 1} / ${photos.length}`;
    }

    function next() {
      current = (current + 1) % photos.length;
      render();
    }

    function prev() {
      current = (current - 1 + photos.length) % photos.length;
      render();
    }

    galleryEl.querySelectorAll(".polaroid").forEach((btn) => {
      btn.addEventListener("click", () => open(Number(btn.dataset.index)));
    });

    lightbox.querySelector(".lightbox-close").addEventListener("click", close);
    lightbox.querySelector(".lightbox-next").addEventListener("click", next);
    lightbox.querySelector(".lightbox-prev").addEventListener("click", prev);
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });

    document.addEventListener("keydown", (e) => {
      if (lightbox.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    });

    // Deslizar con el dedo en móvil
    let touchStartX = null;
    lightbox.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].clientX;
    });
    lightbox.addEventListener("touchend", (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx > 50) prev();
      if (dx < -50) next();
      touchStartX = null;
    });
  }
})();
