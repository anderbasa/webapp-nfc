// ============================================================
// BUILD — prepara la carpeta _site que se publica en GitHub Pages.
//
// Qué hace:
//   1. Copia los archivos del sitio (html, css, js, iconos) a _site/.
//   2. Por cada foto de photos/<album>/ genera dos versiones ligeras
//      en WebP: una miniatura (grid) y una "grande" (visor). Corrige
//      la orientación EXIF y no agranda fotos pequeñas.
//   3. Lee la fecha EXIF para ordenar cada álbum cronológicamente.
//   4. Escribe _site/data/photos.json con todo el catálogo, para que
//      la web no tenga que llamar a la API de GitHub nunca.
//
// Las fotos ORIGINALES no se publican: pesan mucho y ya están en el
// repo. Solo se publican las versiones optimizadas.
//
// Hay una caché en .cache/ para no reprocesar fotos que no han
// cambiado (la Action de GitHub la conserva entre despliegues).
// ============================================================

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import exifr from "exifr";

const execFileP = promisify(execFile);

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = path.join(ROOT, "_site");
const CACHE = path.join(ROOT, ".cache", "img");

const THUMB_WIDTH = 600; // miniatura del grid
const LARGE_WIDTH = 2000; // versión del visor a pantalla completa
const THUMB_QUALITY = 72;
const LARGE_QUALITY = 80;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|tiff?|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

// Archivos y carpetas del sitio que se copian tal cual a _site/.
const STATIC = [
  "index.html",
  "album.html",
  "manifest.json",
  "sw.js",
  "offline.html",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "css",
  "js",
];

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyRecursive(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    for (const entry of await fs.readdir(src)) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

function hashBuffer(buf) {
  return createHash("sha1").update(buf).digest("hex");
}

// Genera (o recupera de caché) las dos versiones WebP de una imagen.
async function processImage(buf, hash) {
  const cacheDir = path.join(CACHE, hash);
  const thumbCache = path.join(cacheDir, "thumb.webp");
  const largeCache = path.join(cacheDir, "large.webp");
  const metaCache = path.join(cacheDir, "meta.json");

  if (await exists(metaCache)) {
    return {
      thumb: await fs.readFile(thumbCache),
      large: await fs.readFile(largeCache),
      meta: JSON.parse(await fs.readFile(metaCache, "utf8")),
    };
  }

  const base = sharp(buf, { failOn: "none" }).rotate(); // rotate() = auto-orienta por EXIF
  const meta = await base.metadata();
  const width = meta.width ?? LARGE_WIDTH;
  const height = meta.height ?? Math.round(LARGE_WIDTH * 0.75);

  const [thumb, large] = await Promise.all([
    base
      .clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer(),
    base
      .clone()
      .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: LARGE_QUALITY })
      .toBuffer(),
  ]);

  let date = null;
  try {
    const tags = await exifr.parse(buf, { pick: ["DateTimeOriginal", "CreateDate"] });
    const d = tags?.DateTimeOriginal || tags?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) date = d.toISOString();
  } catch {
    /* sin EXIF: se ordenará por nombre */
  }

  const result = {
    meta: {
      w: Math.min(width, LARGE_WIDTH),
      h: width > LARGE_WIDTH ? Math.round((height * LARGE_WIDTH) / width) : height,
      date,
    },
    thumb,
    large,
  };

  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(thumbCache, thumb);
  await fs.writeFile(largeCache, large);
  await fs.writeFile(metaCache, JSON.stringify(result.meta));
  return result;
}

// "IMG_1094", "DSC00042", nombres UUID/hash, capturas... -> sin pie de foto.
function prettyCaption(filename) {
  const raw = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const junk = [
    /^\d+$/,
    /^img[\s_]*\d+/i,
    /^dsc[\s_]*\d+/i,
    /^dscn?\d+/i,
    /^pxl[\s_]*\d+/i,
    /^photo[\s_]*\d+/i,
    /^screenshot/i,
    /^captura/i,
    /^dji[\s_]*fly/i,
    /^[0-9a-f]{6,}(\s+[0-9a-f]{2,})*$/i, // hex / UUID troceado
    /^whatsapp/i,
  ];
  if (raw.length < 2 || junk.some((re) => re.test(raw))) return "";
  return raw;
}

function naturalCompare(a, b) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

let _ffmpeg;
async function ffmpegAvailable() {
  if (_ffmpeg !== undefined) return _ffmpeg;
  try {
    await execFileP("ffmpeg", ["-version"]);
    _ffmpeg = true;
  } catch {
    _ffmpeg = false;
    console.warn("  ⚠ ffmpeg no disponible: los vídeos se copian sin optimizar.");
  }
  return _ffmpeg;
}

// Transcodifica un vídeo a mp4 (H.264/AAC, apto para web) + un póster
// webp. Cacheado por hash. Devuelve null si no hay ffmpeg.
async function processVideo(srcAbs, hash) {
  if (!(await ffmpegAvailable())) return null;
  const cacheDir = path.join(CACHE, `v${hash}`);
  const mp4Cache = path.join(cacheDir, "video.mp4");
  const posterCache = path.join(cacheDir, "poster.webp");

  if (await exists(mp4Cache)) {
    return {
      mp4: await fs.readFile(mp4Cache),
      poster: (await exists(posterCache)) ? await fs.readFile(posterCache) : null,
    };
  }

  await fs.mkdir(cacheDir, { recursive: true });
  await execFileP("ffmpeg", [
    "-y", "-i", srcAbs,
    "-vf", "scale='min(1280,iw)':-2",
    "-c:v", "libx264", "-preset", "medium", "-crf", "28", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "128k",
    mp4Cache,
  ]);

  let poster = null;
  try {
    const posterTmp = path.join(cacheDir, "poster.jpg");
    await execFileP("ffmpeg", ["-y", "-i", srcAbs, "-vframes", "1", "-q:v", "3", posterTmp]);
    poster = await sharp(await fs.readFile(posterTmp))
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
    await fs.writeFile(posterCache, poster);
    await fs.rm(posterTmp, { force: true });
  } catch {
    /* sin póster: el <video> mostrará su propio primer frame */
  }

  return { mp4: await fs.readFile(mp4Cache), poster };
}

async function build() {
  const t0 = Date.now();
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  // 1. Archivos estáticos del sitio
  for (const item of STATIC) {
    const src = path.join(ROOT, item);
    if (await exists(src)) await copyRecursive(src, path.join(OUT, item));
  }
  await fs.writeFile(path.join(OUT, ".nojekyll"), "");

  // 2 + 3. Fotos -> versiones ligeras + catálogo
  const photosRoot = path.join(ROOT, "photos");
  const albums = {};
  let processed = 0;
  let outBytes = 0;

  const albumDirs = (await exists(photosRoot))
    ? (await fs.readdir(photosRoot, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort(naturalCompare)
    : [];

  for (const albumId of albumDirs) {
    const dir = path.join(photosRoot, albumId);
    await fs.mkdir(path.join(OUT, "photos", albumId), { recursive: true });
    const files = (await fs.readdir(dir)).filter(
      (f) => IMAGE_EXT.test(f) || VIDEO_EXT.test(f)
    );
    const entries = [];

    for (const file of files.sort(naturalCompare)) {
      const abs = path.join(dir, file);
      const rel = `photos/${albumId}/${file}`;

      if (VIDEO_EXT.test(file)) {
        const stem = file.replace(/\.[^.]+$/, "");
        const buf = await fs.readFile(abs);
        const hash = hashBuffer(buf);
        let vid = null;
        try {
          vid = await processVideo(abs, hash);
        } catch (err) {
          console.warn(`  ⚠ no se pudo transcodificar ${rel}: ${err.message}`);
        }
        if (vid) {
          const mp4Rel = `photos/${albumId}/${stem}.mp4`;
          await fs.writeFile(path.join(OUT, mp4Rel), vid.mp4);
          outBytes += vid.mp4.length;
          let posterRel = null;
          if (vid.poster) {
            posterRel = `photos/${albumId}/${stem}-poster.webp`;
            await fs.writeFile(path.join(OUT, posterRel), vid.poster);
            outBytes += vid.poster.length;
          }
          entries.push({ type: "video", src: mp4Rel, poster: posterRel, caption: prettyCaption(file), _name: file });
        } else {
          await copyRecursive(abs, path.join(OUT, rel));
          entries.push({ type: "video", src: rel, poster: null, caption: prettyCaption(file), _name: file });
        }
        continue;
      }

      const buf = await fs.readFile(abs);
      const hash = hashBuffer(buf);
      let out;
      try {
        out = await processImage(buf, hash);
      } catch (err) {
        console.warn(`  ⚠ no se pudo procesar ${rel}: ${err.message}`);
        continue;
      }

      const stem = file.replace(/\.[^.]+$/, "");
      const thumbRel = `photos/${albumId}/${stem}-thumb.webp`;
      const largeRel = `photos/${albumId}/${stem}-large.webp`;
      await fs.writeFile(path.join(OUT, thumbRel), out.thumb);
      await fs.writeFile(path.join(OUT, largeRel), out.large);
      outBytes += out.thumb.length + out.large.length;
      processed++;

      entries.push({
        type: "photo",
        thumb: thumbRel,
        large: largeRel,
        w: out.meta.w,
        h: out.meta.h,
        date: out.meta.date,
        caption: prettyCaption(file),
        _name: file,
      });
    }

    // Orden cronológico (por EXIF); las fotos sin fecha van al final por nombre.
    entries.sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return naturalCompare(a._name || a.src || "", b._name || b.src || "");
    });
    entries.forEach((e) => delete e._name);

    const cover = entries.find((e) => e.type === "photo");
    albums[albumId] = {
      count: entries.filter((e) => e.type === "photo").length,
      cover: cover ? cover.thumb : null,
      entries,
    };
  }

  // 4. Catálogo
  await fs.mkdir(path.join(OUT, "data"), { recursive: true });
  await fs.writeFile(
    path.join(OUT, "data", "photos.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), albums }, null, 0)
  );

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\n✓ _site listo en ${secs}s — ${albumDirs.length} álbumes, ${processed} fotos optimizadas, ` +
      `${(outBytes / 1024 / 1024).toFixed(1)} MB de imágenes publicadas.`
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
