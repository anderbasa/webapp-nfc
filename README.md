# 📌 Diario de viajes — imanes NFC

Una web tipo "corcho de la nevera": cada imán físico con un chip NFC te lleva
directamente al álbum de fotos de ese viaje. Ahora mismo el proyecto trae 3
países de ejemplo (Italia, Francia, Japón) con fotos de muestra, para que
veas cómo queda antes de poner las tuyas.

---

## 1. Pruébalo en tu ordenador (opcional, 1 minuto)

Abre el archivo `index.html` haciendo doble clic. Verás el corcho con los 3
imanes de ejemplo. Es un modo "demo" con fotos de prueba — en cuanto lo subas
a GitHub y pongas tu usuario real, se sustituyen automáticamente por tus
fotos reales.

## 2. Súbelo a GitHub Pages (gratis, sin servidor)

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Crea un repositorio nuevo, **público**, por ejemplo llamado `webapp-nfc`.
3. Sube todos los archivos y carpetas de este proyecto a ese repositorio
   (puedes arrastrarlos directamente en la web de GitHub, en
   "Add file → Upload files").
4. Ve a **Settings → Pages** del repositorio, y en "Branch" elige `main` y
   la carpeta `/ (root)`. Guarda.
5. En un par de minutos tu web estará viva en:
   `https://TU-USUARIO.github.io/webapp-nfc/`

## 3. Conecta la web con tu usuario de GitHub

Abre el archivo `js/config.js` (puedes editarlo directamente en la web de
GitHub, con el lapicito ✏️) y cambia esto:

```js
const SITE_CONFIG = {
  githubUser: "TU-USUARIO-DE-GITHUB",  // ← pon tu usuario real aquí
  githubRepo: "webapp-nfc",             // ← el nombre de tu repositorio
  branch: "main",
};
```

Guarda ("Commit changes"). Con esto, la web ya sabe dónde buscar tus fotos.

## 4. Añadir o cambiar fotos (sin tocar código, nunca más)

Cada país tiene su propia carpeta dentro de `photos/`. Por ejemplo, las
fotos de Italia viven en `photos/italia/`.

Para añadir fotos nuevas:
1. Entra en esa carpeta desde la web de GitHub.
2. "Add file → Upload files", arrastra tus fotos (JPG, PNG o WebP).
3. Commit changes.

¡Ya está! La web las detecta solas la próxima vez que alguien escanee el
imán — no hay que editar nada más. Para quitar una foto, bórrala de esa
misma carpeta. Un consejo: si tus fotos del móvil pesan mucho (5-10 MB cada
una), la web tardará más en cargar; si puedes, redúcelas antes a un tamaño
razonable (por ejemplo 1500px de ancho).

## 5. Añadir un país/viaje nuevo

Esto sí requiere tocar un archivo, pero es solo copiar y pegar una línea.
Abre `js/countries.js` y añade un bloque nuevo, por ejemplo:

```js
{
  id: "portugal",
  nombre: "Portugal",
  bandera: "🇵🇹",
  fecha: "Junio 2025",
  nota: "Pastéis de nata para desayunar, comer y cenar.",
},
```

El `id` es el nombre que también debe tener la carpeta de fotos:
`photos/portugal/`. Créala y sube las fotos como en el paso anterior.

## 6. Grabar los chips NFC

Necesitas pegatinas/chips NFC regrabables (los NTAG213 son baratos y de
sobra para esto) y una app para escribir en ellos, por ejemplo **NFC Tools**
(gratis, Android e iOS).

Para cada imán:
1. Abre NFC Tools → "Escribir" → "Añadir un registro" → "URL/URI".
2. Escribe la dirección de ese álbum, por ejemplo:
   `https://TU-USUARIO.github.io/webapp-nfc/album.html?id=italia`
3. Acerca el móvil al chip NFC hasta que confirme la escritura.
4. Pega el chip en el imán o directamente en el imán físico del país.

Repite esto por cada país. Al escanear, Android abre la web directamente en
el navegador — no hace falta instalar nada. En iPhone, hay que abrir la app
Cámara y acercarla al chip (o usar un Atajo de Siri para automatizarlo).

## 7. Regalar un imán

Como cada álbum es solo una URL, puedes:
- Grabar un chip NFC nuevo con esa misma URL y regalarlo tal cual, o
- Compartir el enlace por WhatsApp si tu amigo no tiene el imán físico.

---

### Estructura del proyecto

```
webapp-nfc/
├── index.html          → el corcho con todos los imanes
├── album.html           → la vista de un álbum (a esta apunta cada chip NFC)
├── manifest.json         → permite "instalar" la web como una app
├── css/style.css
├── js/
│   ├── config.js         → tu usuario/repo de GitHub (edítalo una vez)
│   ├── countries.js       → la lista de tus viajes (edítalo al añadir uno nuevo)
│   ├── github.js          → busca las fotos automáticamente en tu repo
│   ├── app.js              → dibuja el corcho de la home
│   └── album.js             → dibuja el álbum y el visor de fotos
└── photos/
    ├── italia/    (fotos de muestra)
    ├── francia/   (fotos de muestra)
    └── japon/     (fotos de muestra)
```
