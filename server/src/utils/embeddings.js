// ── Local neural embeddings (Transformers.js) ─────────────────────────────────
// We run the `all-MiniLM-L6-v2` sentence-transformer right here in Node — no API
// key, no cost. It turns a piece of text into a 384-dimension vector ("embedding")
// where semantically similar texts land close together. That's the "retrieval"
// half of RAG (Retrieval-Augmented Generation).
//
// ML concepts in play here:
//   • embeddings        — text → dense numeric vector
//   • mean pooling      — average the per-token vectors into one sentence vector
//   • L2 normalization  — scale vectors to length 1 so cosine = dot product
//   • cosine similarity — measure of how aligned two vectors are (−1..1)

import { pipeline, env } from "@xenova/transformers";

// Always pull the model from the Hugging Face hub (and cache it on disk after the
// first download). Disables the local-file lookups that would otherwise warn.
env.allowLocalModels = false;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DIM = 384;

// The model is loaded lazily and reused (loading it is the slow part — a one-time
// ~30 MB download, then it stays in memory). We also de-dupe concurrent loads.
let extractorPromise = null;
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID);
  }
  return extractorPromise;
}

// Warm the model up ahead of time (optional — called on server boot).
export async function warmEmbeddings() {
  try {
    await embed("warm up");
    return true;
  } catch (err) {
    console.error("embedding warm-up failed:", err.message);
    return false;
  }
}

// Embed a single string → number[384] (mean-pooled, normalized).
export async function embed(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// Embed many strings at once → number[][]. More efficient than calling embed() N times.
export async function embedBatch(texts) {
  if (!texts.length) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const [n, d] = output.dims; // [count, 384]
  const vectors = [];
  for (let i = 0; i < n; i++) {
    vectors.push(Array.from(output.data.slice(i * d, (i + 1) * d)));
  }
  return vectors;
}

// Cosine similarity. Our vectors are already normalized, so this is just the dot
// product — but we keep the full formula so it's correct for any input.
export function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
