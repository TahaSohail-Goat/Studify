// ── OCR: read text out of images and scanned (image-only) PDFs ────────────────
// Uses Tesseract.js (pure WASM — no system binaries, so it runs on Railway) for
// the actual character recognition, and pdf-to-img to turn scanned PDF pages into
// images first. OCR is slow and CPU-heavy, so callers use it only as a FALLBACK
// when a file has no real text layer, and we cap how many pages we read.

import { createWorker } from "tesseract.js";

const MAX_OCR_PAGES = 10; // bound the work so one request can't run forever
const RASTER_SCALE = 2;   // higher = sharper page image = better OCR (but slower)

let workerPromise = null;

// One shared Tesseract worker, created on first use. The English model (~15 MB)
// downloads once per server start, then is reused for every OCR call.
async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng");
  }
  return workerPromise;
}

// OCR a single image file (jpg / png / webp) → plain text.
export async function ocrImageFile(filePath) {
  const worker = await getWorker();
  const { data } = await worker.recognize(filePath);
  return (data?.text || "").trim();
}

// OCR a scanned PDF: rasterize each page to an image, then OCR it (capped pages).
export async function ocrPdfBuffer(buffer) {
  const { pdf } = await import("pdf-to-img");
  const document = await pdf(buffer, { scale: RASTER_SCALE });
  const worker = await getWorker();

  const parts = [];
  let page = 0;
  for await (const image of document) {
    if (page >= MAX_OCR_PAGES) break;
    const { data } = await worker.recognize(image); // one worker → runs sequentially
    const text = (data?.text || "").trim();
    if (text) parts.push(text);
    page++;
  }
  return parts.join("\n\n").trim();
}
