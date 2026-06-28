// ── Shared text extraction for notes (PDF / TXT / PPTX / DOCX) ────────────────
// Office files (.pptx, .docx) are just ZIP archives of XML. We unzip them and
// pull the text out of the slide / document XML. Whatever text we return feeds
// straight into summaries, quizzes, and the RAG search index.

import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// File types we can turn into text (and therefore index for RAG, summarize, quiz).
export const INDEXABLE_MIMETYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",    // .docx
]);

const INDEXABLE_EXTS = new Set([".pdf", ".txt", ".pptx", ".docx"]);

// Some browsers/OSes report Office files as application/octet-stream, so we also
// accept by extension.
export function isIndexable(mimetype = "", originalName = "") {
  if (INDEXABLE_MIMETYPES.has(mimetype)) return true;
  return INDEXABLE_EXTS.has(path.extname(originalName).toLowerCase());
}

// Friendly list for upload UIs / error messages.
export const INDEXABLE_LABEL = "PDF, PowerPoint, Word, or text";

// ── XML helpers ───────────────────────────────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&"); // ampersand last so we don't double-decode
}

// Turn a chunk of OOXML into readable text: paragraph/line tags become newlines,
// every other tag is stripped, leaving just the run text.
function xmlToText(xml, paraTag, breakTags = []) {
  let out = xml.replace(new RegExp(`<${paraTag}\\b[^>]*>`, "g"), "\n");
  for (const t of breakTags) {
    out = out.replace(new RegExp(`<${t}\\b[^>]*/?>`, "g"), "\n");
  }
  out = out.replace(/<[^>]+>/g, ""); // strip remaining tags (keeps run text)
  return decodeEntities(out).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// .pptx — slide text lives in ppt/slides/slideN.xml, runs are <a:t>, paras <a:p>.
function extractPptx(filePath) {
  const zip = new AdmZip(filePath);
  const slides = zip
    .getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
    .sort((a, b) => slideNum(a.entryName) - slideNum(b.entryName));

  const parts = [];
  for (const e of slides) {
    const text = xmlToText(e.getData().toString("utf8"), "a:p", ["a:br"]);
    if (text) parts.push(text);
  }
  return parts.join("\n\n");
}
function slideNum(name) {
  const m = name.match(/slide(\d+)\.xml$/i);
  return m ? Number(m[1]) : 0;
}

// .docx — body text lives in word/document.xml, runs are <w:t>, paras <w:p>.
function extractDocx(filePath) {
  const zip = new AdmZip(filePath);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) return "";
  return xmlToText(entry.getData().toString("utf8"), "w:p", ["w:br", "w:tab"]);
}

/**
 * Extract plain text from a stored note. Dispatches by file extension (reliable)
 * with the reported mimetype as a fallback. Returns "" for anything we can't read.
 */
export async function extractNoteText(note, uploadsDir) {
  const filePath = path.join(uploadsDir, note.storedName);
  if (!fs.existsSync(filePath)) throw new Error("The file is missing on the server.");

  const ext = path.extname(note.storedName).toLowerCase();
  const mt = note.mimetype || "";

  if (ext === ".pdf" || mt === "application/pdf") {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || "";
  }
  if (ext === ".txt" || mt === "text/plain") {
    return fs.readFileSync(filePath, "utf-8");
  }
  if (ext === ".pptx" || mt.includes("presentationml")) {
    return extractPptx(filePath);
  }
  if (ext === ".docx" || mt.includes("wordprocessingml")) {
    return extractDocx(filePath);
  }
  return "";
}
