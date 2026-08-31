# 📌 UDA 2026 — corcho de imanes NFC

Una web tipo "corcho de la nevera": cada imán físico con un chip NFC te lleva
directamente al álbum de fotos de ese momento.

Al desplegar, una GitHub Action **redimensiona automáticamente** todas las
fotos (una miniatura para la cuadrícula y una versión "grande" para el visor)
y genera un catálogo `data/photos.json`. Gracias a eso:

- la web carga en segundos aunque subas fotos de 4 MB del móvil,
- no gasta el límite de la API de GitHub (antes se agotaba en minutos),
- funciona sin conexión después de la primera visita (service worker).

Tu flujo de trabajo no cambia: **sigues subiendo fotos a `photos/<viaje>/`** y
ya está.

---

## Puesta en marcha (una sola vez)

1. **Pages con Actions.** En el repo: *Settings → Pages → Build and
   deployment → Source* → elige **GitHub Actions**.
2. Comprueba `js/config.js` (usuario y repo de GitHub). Solo se usa como
   respaldo si el catálogo aún no existe.
3. Haz un cambio en `main` (o lanza el workflow *Deploy* a mano desde la
   pestaña *Actions*). En 1–2 minutos la web está viva en
   `https://TU-USUARIO.github.io/webapp-nfc/`.

## Añadir o cambiar fotos

1. Entra en `photos/<viaje>/` en la web de GitHub.
2. *Add file → Upload files*, arrastra tus fotos (JPG, PNG, HEIC, WebP) o
   vídeos cortos (MP4, MOV).
3. *Commit changes*. La Action las optimiza y las publica sola.

Se ordenan por la fecha de la foto (EXIF). Para quitar una, bórrala de la
carpeta. No hace falta redimensionar nada a mano.

## Añadir un viaje nuevo

Edita `js/countries.js` y añade un bloque:

```js
{
  id: "getaria",          // = nombre de la carpeta en photos/
  nombre: "Getaria",
  bandera: "🐟",
  fecha: "Irailak 12",
  nota: "El txakoli de la fiesta",
},
```

Crea `photos/getaria/` y sube ahí sus fotos.

## Grabar los chips NFC

Con una app como **NFC Tools** escribe en cada chip un registro *URL*:

```
https://TU-USUARIO.github.io/webapp-nfc/album.html?id=getaria
```

Android abre la web al acercar el móvil; en iPhone se usa la app Cámara o un
Atajo de Siri.

---

## Desarrollo local

```bash
npm install
npm run build      # genera _site/  (necesita Node 18+; ffmpeg opcional para vídeos)
npm run serve      # http://localhost:4173/webapp-nfc/
```

Si abres `index.html` directamente (sin `build`), la web usa el modo de
respaldo: pide la lista de fotos a la API de GitHub y las sirve a través de
un CDN de imágenes gratuito.

### Estructura

```
webapp-nfc/
├── index.html · album.html · offline.html
├── manifest.json · sw.js · favicon.svg
├── css/style.css
├── js/
│   ├── config.js       → usuario/repo de GitHub (respaldo)
│   ├── countries.js     → la lista de viajes  ← se edita al añadir uno
│   ├── photos.js        → lee data/photos.json (catálogo)
│   ├── github.js        → respaldo vía API de GitHub + CDN de imágenes
│   ├── spring.js        → física del visor
│   ├── app.js · album.js
│   └── register-sw.js
├── scripts/build.mjs    → redimensiona fotos y crea el catálogo
├── .github/workflows/deploy.yml
└── photos/<viaje>/…      → tus fotos originales
```

Ajustes de calidad/tamaño de imagen: constantes al principio de
`scripts/build.mjs`.
