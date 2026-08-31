(async function () {
  const params = new URLSearchParams(location.search);
  const countryId = params.get("id");
  const country = COUNTRIES.find((c) => c.id === countryId);

  const headerEl = document.getElementById("album-header");
  const galleryEl = document.getElementById("gallery");

  if (!country) {
    headerEl.innerHTML = `
      <a class="back-link" href="index.html">&larr; volver al corcho</a>
      <div class="ticket"><p class="ticket-note">No encuentro ese viaje. Revisa el enlace del imán, o añádelo en <code>js/countries.js</code>.</p></div>`;
    return;
  }

  document.title = `${country.nombre} — UDA 2026`;

  const bandera = escapeHtml(country.bandera || "");
  const nombre = escapeHtml(country.nombre);
  const fecha = escapeHtml(country.fecha || "");
  const nota = escapeHtml(country.nota || "");

  headerEl.innerHTML = `
    <a class="back-link" href="index.html">&larr; volver al corcho</a>
    <div class="ticket">
      <div class="ticket-row">
        <span class="ticket-country">${bandera} ${nombre}</span>
        <span class="ticket-stamp">${fecha}</span>
      </div>
      ${nota ? `<p class="ticket-note">${nota}</p>` : ""}
      <p class="ticket-count" id="ticket-count" hidden></p>
    </div>`;

  galleryEl.innerHTML = `<p class="gallery-loading">Revelando fotos…</p>`;

  let entries = [];
  try {
    entries = await fetchPhotoList(country.id);
  } catch (err) {
    galleryEl.innerHTML = `
      <p class="gallery-error">
        No he podido cargar las fotos de este viaje.<br>
        <em>Detalle técnico: ${escapeHtml(err.message)}</em>
      </p>`;
    return;
  }

  if (entries.length === 0) {
    galleryEl.innerHTML = `<p class="gallery-empty">Todavía no hay fotos aquí.<br>Sube alguna a la carpeta <code>photos/${escapeHtml(country.id)}</code> y aparecerán solas.</p>`;
    return;
  }

  const photos = entries.filter((e) => e.type !== "video");
  const countEl = document.getElementById("ticket-count");
  if (countEl) {
    const nP = photos.length;
    const nV = entries.length - nP;
    countEl.textContent =
      `${nP} foto${nP === 1 ? "" : "s"}` + (nV ? ` · ${nV} vídeo${nV === 1 ? "" : "s"}` : "");
    countEl.hidden = false;
  }

  let photoIndex = -1; // índice dentro de `photos` para el visor
  galleryEl.innerHTML = entries
    .map((e, i) => {
      if (e.type === "video") {
        const poster = e.poster ? ` poster="${escapeHtml(e.poster)}"` : "";
        return `
          <figure class="polaroid polaroid--video">
            <video src="${escapeHtml(e.url)}"${poster} controls preload="none" playsinline></video>
            ${e.caption ? `<figcaption class="polaroid-caption">${escapeHtml(e.caption)}</figcaption>` : ""}
          </figure>`;
      }
      photoIndex++;
      const label = e.caption
        ? `${escapeHtml(e.caption)}`
        : `Foto ${photoIndex + 1} de ${photos.length}`;
      return `
        <button class="polaroid" data-photo="${photoIndex}" aria-label="Ampliar: ${label}">
          <span class="polaroid-frame is-loading">
            <img src="${escapeHtml(e.thumb || e.url)}" alt="${escapeHtml(e.caption || `Foto ${photoIndex + 1} de ${country.nombre}`)}"
                 loading="lazy" decoding="async"
                 onload="this.parentNode.classList.remove('is-loading')" />
          </span>
          ${e.caption ? `<span class="polaroid-caption">${escapeHtml(e.caption)}</span>` : ""}
        </button>`;
    })
    .join("");

  if (photos.length > 0) setupLightbox(photos, country);

  // ============================================================
  // VISOR — arrastrar 1:1, deslizar con impulso real, cerrar
  // arrastrando hacia abajo. Interrumpible en cualquier instante,
  // como el visor de Fotos del iPhone. Las diapositivas cargan la
  // imagen grande solo cuando hacen falta (actual ± 1).
  // ============================================================
  function setupLightbox(photos, country) {
    const lightbox = document.getElementById("lightbox");
    const track = document.getElementById("lightbox-track");
    const backdrop = document.getElementById("lightbox-backdrop");
    const lbCounter = document.getElementById("lightbox-counter");
    const closeBtn = lightbox.querySelector(".lightbox-close");
    const prevBtn = lightbox.querySelector(".lightbox-prev");
    const nextBtn = lightbox.querySelector(".lightbox-next");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let index = 0;
    let slideWidth = 0;
    let lastFocus = null;

    const xSpring = new Spring({ dampingRatio: 1, response: 0.32 });
    const ySpring = new Spring({ dampingRatio: 1, response: 0.3 });
    const scaleSpring = new Spring({ value: 1, dampingRatio: 1, response: 0.3 });
    const fadeSpring = new Spring({ value: 1, dampingRatio: 1, response: 0.3 });

    track.innerHTML = photos
      .map(
        (p, i) => `
        <div class="lightbox-slide" data-slide="${i}">
          <div class="lightbox-media is-loading">
            <img alt="${escapeHtml(p.caption || `Foto ${i + 1} de ${country.nombre}`)}" draggable="false" />
          </div>
        </div>`
      )
      .join("");
    const slideMedia = [...track.querySelectorAll(".lightbox-media")];

    function loadNeighbours() {
      for (let i = index - 1; i <= index + 1; i++) {
        const media = slideMedia[i];
        if (!media) continue;
        const img = media.querySelector("img");
        if (!img.src) {
          img.addEventListener("load", () => media.classList.remove("is-loading"), { once: true });
          img.src = photos[i].url;
        }
      }
    }

    function measure() {
      slideWidth = lightbox.clientWidth;
    }

    function applyTransforms() {
      track.style.transform = `translate3d(${-index * slideWidth + xSpring.value}px, 0, 0)`;
      lightbox.style.setProperty("--drag-y", `${ySpring.value}px`);
      lightbox.style.setProperty("--drag-scale", scaleSpring.value);
      backdrop.style.opacity = fadeSpring.value;
    }

    function updateCounter() {
      lbCounter.textContent = `${index + 1} / ${photos.length}`;
    }

    function open(i) {
      lastFocus = document.activeElement;
      index = i;
      lightbox.hidden = false; // visible antes de medir, si no clientWidth es 0
      measure();
      xSpring.set(0);
      ySpring.set(0);
      scaleSpring.set(1);
      fadeSpring.set(1);
      applyTransforms();
      loadNeighbours();
      updateCounter();
      closeBtn.focus();
      document.body.style.overflow = "hidden";
    }

    function close() {
      document.body.style.overflow = "";
      lightbox.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function settleClosed() {
      xSpring.set(0);
      ySpring.set(0);
      scaleSpring.set(1);
      fadeSpring.set(1);
      close();
    }

    function goTo(newIndex) {
      const clamped = Math.max(0, Math.min(photos.length - 1, newIndex));
      if (clamped === index) return;
      const direction = clamped > index ? 1 : -1;
      index = clamped;
      updateCounter();
      loadNeighbours();
      if (reduceMotion) {
        xSpring.set(0);
        applyTransforms();
        return;
      }
      xSpring.value = direction * slideWidth;
      xSpring.velocity = 0;
      xSpring.retarget(0);
      runSprings([xSpring], applyTransforms);
    }

    // -------- Gestos --------
    let dragging = false;
    let dragAxis = null;
    let startX = 0;
    let startY = 0;
    let history = [];

    function onPointerDown(e) {
      if (e.target.closest("button")) return;
      dragging = true;
      dragAxis = null;
      startX = e.clientX;
      startY = e.clientY;
      history = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      track.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragAxis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        dragAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }

      history.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (history.length > 5) history.shift();

      if (dragAxis === "x") {
        let effectiveDx = dx;
        const atStart = index === 0 && dx > 0;
        const atEnd = index === photos.length - 1 && dx < 0;
        if (atStart || atEnd) effectiveDx = dx * 0.35;
        xSpring.set(effectiveDx);
        applyTransforms();
      } else {
        ySpring.set(dy);
        const dragRatio = Math.min(Math.abs(dy) / 400, 1);
        scaleSpring.set(1 - dragRatio * 0.18);
        fadeSpring.set(1 - dragRatio * 0.6);
        applyTransforms();
      }
    }

    function velocityFromHistory() {
      if (history.length < 2) return { vx: 0, vy: 0 };
      const first = history[0];
      const last = history[history.length - 1];
      const dt = Math.max((last.t - first.t) / 1000, 0.001);
      return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      const { vx, vy } = velocityFromHistory();

      if (dragAxis === "x") {
        const threshold = slideWidth * 0.22;
        const flick = Math.abs(vx) > 500;
        xSpring.velocity = vx;
        if ((xSpring.value < -threshold || (flick && vx < 0)) && index < photos.length - 1) {
          index += 1;
          xSpring.value += slideWidth;
        } else if ((xSpring.value > threshold || (flick && vx > 0)) && index > 0) {
          index -= 1;
          xSpring.value -= slideWidth;
        }
        updateCounter();
        loadNeighbours();
        xSpring.retarget(0);
        runSprings([xSpring], applyTransforms);
      } else if (dragAxis === "y") {
        const shouldDismiss = Math.abs(ySpring.value) > 120 || Math.abs(vy) > 700;
        if (shouldDismiss && !reduceMotion) {
          const direction = ySpring.value >= 0 ? 1 : -1;
          ySpring.velocity = vy;
          ySpring.retarget(direction * window.innerHeight);
          scaleSpring.retarget(0.85);
          fadeSpring.retarget(0);
          runSprings([ySpring, scaleSpring, fadeSpring], applyTransforms, settleClosed);
        } else {
          ySpring.velocity = vy;
          ySpring.retarget(0);
          scaleSpring.retarget(1);
          fadeSpring.retarget(1);
          runSprings([ySpring, scaleSpring, fadeSpring], applyTransforms);
        }
      }
      dragAxis = null;
    }

    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", onPointerUp);
    track.addEventListener("pointercancel", onPointerUp);

    galleryEl.querySelectorAll(".polaroid[data-photo]").forEach((btn) => {
      btn.addEventListener("click", () => open(Number(btn.dataset.photo)));
    });

    closeBtn.addEventListener("click", () => {
      if (reduceMotion) return settleClosed();
      ySpring.retarget(window.innerHeight);
      scaleSpring.retarget(0.85);
      fadeSpring.retarget(0);
      runSprings([ySpring, scaleSpring, fadeSpring], applyTransforms, settleClosed);
    });
    nextBtn.addEventListener("click", () => goTo(index + 1));
    prevBtn.addEventListener("click", () => goTo(index - 1));
    backdrop.addEventListener("click", () => closeBtn.click());

    document.addEventListener("keydown", (e) => {
      if (lightbox.hidden) return;
      if (e.key === "Escape") closeBtn.click();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    });

    window.addEventListener("resize", () => {
      if (lightbox.hidden) return;
      measure();
      xSpring.set(0);
      applyTransforms();
    });
  }
})();
