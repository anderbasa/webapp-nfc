// Registra el service worker (js/../sw.js) para que, tras la primera
// visita, el corcho y los álbumes que hayas abierto carguen al instante
// y funcionen sin conexión. Solo se activa servido por http(s).

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("No se pudo registrar el service worker:", err);
    });
  });
}
