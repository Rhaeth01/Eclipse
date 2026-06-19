// Génère les assets visuels utilisés par l'installeur NSIS Eclipse.
// Sources : assets/branding/eclipse_icon_transparent_cropped.png (929x977)
//           assets/branding/eclipse_wordmark_transparent_cropped.png (1923x502)
// Sorties :
//   src-tauri/icons/installer.ico           (multi-res ICO 256/128/64/48/32/16)
//   src-tauri/windows/installer-header.bmp  (150x57, palette 8-bit pour NSIS)
//   src-tauri/windows/installer-sidebar.bmp (164x314, palette 8-bit pour NSIS)
//
// NSIS impose du BMP non compressé (format Windows 3.x) pour header/sidebar.
// On récupère les pixels via sharp, on quantifie en palette 256 couleurs, puis
// on écrit le BMP à la main. Le fond des images est forcé à la couleur Corona
// (#070709) pour rester cohérent avec l'app.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const CORONA_BG = { r: 7, g: 7, b: 9 };        // --background
const ICON_SRC = resolve(root, 'assets/branding/eclipse_icon_transparent_cropped.png');
const WORDMARK_SRC = resolve(root, 'assets/branding/eclipse_wordmark_transparent_cropped.png');

const ICON_OUT = resolve(root, 'src-tauri/icons/installer.ico');
const HEADER_OUT = resolve(root, 'src-tauri/windows/installer-header.bmp');
const SIDEBAR_OUT = resolve(root, 'src-tauri/windows/installer-sidebar.bmp');

async function flattenOnCorona(input, width, height) {
  // Compose l'image redimensionnée (contain) sur un canvas Corona de la taille
  // cible, puis aplatit l'alpha sur le fond Corona. Résultat : pixels RGBA aux
  // dimensions exactes width × height.
  const meta = await sharp(input).metadata();
  const srcW = meta.width || width;
  const srcH = meta.height || height;
  const scale = Math.min(width / srcW, height / srcH);
  const fitW = Math.max(1, Math.round(srcW * scale));
  const fitH = Math.max(1, Math.round(srcH * scale));
  const left = Math.floor((width - fitW) / 2);
  const top = Math.floor((height - fitH) / 2);

  const resized = await sharp(input)
    .resize(fitW, fitH, { fit: 'fill' })
    .ensureAlpha()
    .toBuffer();

  const canvas = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { ...CORONA_BG, alpha: 1 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();

  const { data, info } = await sharp(canvas)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Quantification médiane-cut basique → 256 couleurs max.
// Pour NSIS l'optimal est plus que suffisant : les visuels sont de grande
// taille mais peu colorés, la majorité des pixels est sur le fond Corona.
function medianCutQuantize(rgba, width, height, maxColors = 256) {
  const pixels = [];
  for (let i = 0; i < rgba.length; i += 4) {
    pixels.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  // Palette forcée avec le fond Corona en index 0.
  const palette = [[CORONA_BG.r, CORONA_BG.g, CORONA_BG.b]];
  // Couleurs distinctes par bucket (échantillonné pour rester rapide).
  const seen = new Map();
  for (const p of pixels) {
    const key = (p[0] >> 3 << 10) | (p[1] >> 3 << 5) | (p[2] >> 3);
    if (!seen.has(key)) {
      seen.set(key, p);
      palette.push(p);
      if (palette.length >= maxColors) break;
    }
  }
  while (palette.length < maxColors) palette.push([0, 0, 0]);

  // Indexation : on prend le voisin le plus proche dans la palette.
  const indices = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = pixels[i];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let c = 0; c < palette.length; c++) {
      const [pr, pg, pb] = palette[c];
      const dr = r - pr, dg = g - pg, db = b - pb;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) { bestDist = d; bestIdx = c; }
    }
    indices[i] = bestIdx;
  }
  return { palette, indices };
}

// Encode un BMP Windows 3.x 8-bit (palette 256, pas de compression).
// Format attendu par NSIS pour les images MUI_PAGE_HEADER / MUI_PAGE_INSTFILES.
function encodeBmp8(width, height, palette, indices) {
  const rowSize = ((width + 3) >> 2) << 2;        // BMP rows padded to 4 bytes
  const imageSize = rowSize * height;
  const paletteSize = palette.length * 4;          // BGRA entries
  const fileSize = 14 + 40 + paletteSize + imageSize;

  const buf = Buffer.alloc(fileSize);
  let p = 0;

  // --- BITMAPFILEHEADER (14 bytes) ---
  buf.write('BM', p); p += 2;
  buf.writeUInt32LE(fileSize, p); p += 4;
  buf.writeUInt16LE(0, p); p += 2;                // reserved1
  buf.writeUInt16LE(0, p); p += 2;                // reserved2
  buf.writeUInt32LE(14 + 40 + paletteSize, p); p += 4;   // pixel data offset

  // --- BITMAPINFOHEADER (40 bytes) ---
  buf.writeUInt32LE(40, p); p += 4;                // header size
  buf.writeInt32LE(width, p); p += 4;
  buf.writeInt32LE(height, p); p += 4;            // positive = bottom-up
  buf.writeUInt16LE(1, p); p += 2;                // planes
  buf.writeUInt16LE(8, p); p += 2;                // bpp
  buf.writeUInt32LE(0, p); p += 4;                // BI_RGB (no compression)
  buf.writeUInt32LE(imageSize, p); p += 4;
  buf.writeInt32LE(2835, p); p += 4;               // ~72 DPI horizontal
  buf.writeInt32LE(2835, p); p += 4;               // ~72 DPI vertical
  buf.writeUInt32LE(palette.length, p); p += 4;
  buf.writeUInt32LE(0, p); p += 4;                // 0 = all colors important

  // --- Palette (BGRA) ---
  for (const [r, g, b] of palette) {
    buf[p++] = b; buf[p++] = g; buf[p++] = r; buf[p++] = 0;
  }

  // --- Pixel data, bottom-up, padded rows ---
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      buf[p++] = indices[y * width + x];
    }
    for (let pad = width; pad < rowSize; pad++) buf[p++] = 0;
  }

  return buf;
}

async function writeBmp8(input, outPath, width, height) {
  const { data, width: w, height: h } = await flattenOnCorona(input, width, height);
  const { palette, indices } = medianCutQuantize(data, w, h, 256);
  const bmp = encodeBmp8(w, h, palette, indices);
  await writeFile(outPath, bmp);
  return bmp.length;
}

async function writeIco(input, outPath) {
  // Génère un ICO multi-résolutions en encapsulant des PNG (format PNG-in-ICO,
  // supporté par Windows Vista+). Chaque entrée = header ICONDIRENTRY (16 octets)
  // pointant vers les données PNG de la taille correspondante.
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const squarePng = await sharp(input)
    .resize(256, 256, { fit: 'contain', background: CORONA_BG })
    .flatten({ background: CORONA_BG })
    .png()
    .toBuffer();

  const pngLayers = await Promise.all(
    sizes.map(async (size) => ({
      size,
      data: await sharp(squarePng).resize(size, size).png().toBuffer(),
    })),
  );

  const headerSize = 6 + 16 * pngLayers.length;
  const totalSize = headerSize + pngLayers.reduce((s, l) => s + l.data.length, 0);
  const buf = Buffer.alloc(totalSize);
  let p = 0;

  // ICONDIR
  buf.writeUInt16LE(0, p); p += 2;              // reserved
  buf.writeUInt16LE(1, p); p += 2;              // type: 1 = ICO
  buf.writeUInt16LE(pngLayers.length, p); p += 2;// count

  // ICONDIRENTRY[] + offset = headerSize actuel, data écrit après.
  let dataOffset = headerSize;
  for (const { size, data } of pngLayers) {
    const w = size >= 256 ? 0 : size;           // 0 = 256
    const h = size >= 256 ? 0 : size;
    buf.writeUInt8(w, p); p += 1;
    buf.writeUInt8(h, p); p += 1;
    buf.writeUInt8(0, p); p += 1;               // color count (0 = >= 256)
    buf.writeUInt8(0, p); p += 1;               // reserved
    buf.writeUInt16LE(1, p); p += 2;            // color planes
    buf.writeUInt16LE(32, p); p += 2;           // bits per pixel
    buf.writeUInt32LE(data.length, p); p += 4;  // size of image data
    buf.writeUInt32LE(dataOffset, p); p += 4;   // offset
    dataOffset += data.length;
  }

  // Image data (PNG bytes)
  for (const { data } of pngLayers) {
    data.copy(buf, p);
    p += data.length;
  }

  await writeFile(outPath, buf);
  return buf.length;
}

async function main() {
  console.log('[nsis-assets] Génération des assets de l\'installeur Eclipse...');

  await mkdir(dirname(ICON_OUT), { recursive: true });
  await mkdir(dirname(HEADER_OUT), { recursive: true });

  const headerSize = await writeBmp8(WORDMARK_SRC, HEADER_OUT, 150, 57);
  console.log(`[nsis-assets] header  → ${HEADER_OUT} (${headerSize} bytes)`);

  const sidebarSize = await writeBmp8(ICON_SRC, SIDEBAR_OUT, 164, 314);
  console.log(`[nsis-assets] sidebar → ${SIDEBAR_OUT} (${sidebarSize} bytes)`);

  const icoSize = await writeIco(ICON_SRC, ICON_OUT);
  console.log(`[nsis-assets] icon    → ${ICON_OUT} (${icoSize} bytes)`);

  console.log('[nsis-assets] Terminé.');
}

main().catch((err) => {
  console.error('[nsis-assets] Erreur:', err);
  process.exit(1);
});
