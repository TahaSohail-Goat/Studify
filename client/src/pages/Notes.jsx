import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, FileText, Image, FileType, Trash2,
  Download, BookOpen, AlertCircle, CheckCircle, Presentation,
} from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import { getNotesApi, uploadNoteApi, deleteNoteApi, downloadNoteApi } from "../api/notes.js";

const ALLOWED_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",    // .docx
];
// Office files can come through as application/octet-stream, so accept by ext too.
const ALLOWED_EXT = /\.(pdf|jpe?g|png|webp|txt|pptx|docx)$/i;
const isAllowedFile = (file) => ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.test(file.name || "");
const MAX_BYTES = 50 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function FileIcon({ mimetype, name = "" }) {
  if (mimetype?.startsWith("image/")) return <Image size={20} />;
  if (mimetype === "application/pdf" || /\.pdf$/i.test(name)) return <FileType size={20} />;
  if (mimetype?.includes("presentation") || /\.pptx$/i.test(name)) return <Presentation size={20} />;
  return <FileText size={20} />;
}

export default function Notes() {
  const [notes, setNotes]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [confirmId, setConfirmId]   = useState(null); // note id awaiting delete confirm
  const fileInputRef                = useRef(null);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await getNotesApi();
      setNotes(data.notes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  async function handleFiles(files) {
    const file = files[0];
    if (!file) return;

    if (!isAllowedFile(file)) {
      setError("Only PDF, PowerPoint, Word, image, and text files are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File must be under 50 MB.");
      return;
    }

    setError("");
    setSuccess("");
    setUploading(true);

    try {
      await uploadNoteApi(file);
      setSuccess(`"${file.name}" uploaded successfully.`);
      // Reset the input so the same file can be re-uploaded if needed.
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchNotes();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleDelete(note) {
    if (confirmId !== note._id) {
      setConfirmId(note._id);
      return;
    }
    setConfirmId(null);
    try {
      await deleteNoteApi(note._id);
      setNotes((prev) => prev.filter((n) => n._id !== note._id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDownload(note) {
    try {
      await downloadNoteApi(note._id, note.originalName);
    } catch {
      setError("Download failed. Please try again.");
    }
  }

  return (
    <AppLayout title="My Notes">
      <div className="notes-page">
        <div className="page-header">
          <h1>My Notes</h1>
          <p>Upload PDFs, slides, Word docs, images, or text files to power your AI study assistant.</p>
        </div>

        {/* ── Alert banners ───────────────────────────────────────────────── */}
        {error && (
          <div className="notes-alert notes-alert--error">
            <AlertCircle size={15} />
            <span>{error}</span>
            <button className="notes-alert__close" onClick={() => setError("")}>×</button>
          </div>
        )}
        {success && (
          <div className="notes-alert notes-alert--success">
            <CheckCircle size={15} />
            <span>{success}</span>
            <button className="notes-alert__close" onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        {/* ── Upload zone ─────────────────────────────────────────────────── */}
        <div
          className={[
            "upload-zone",
            dragOver   ? "upload-zone--over"      : "",
            uploading  ? "upload-zone--uploading"  : "",
          ].join(" ").trim()}
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.pptx,.docx,.jpg,.jpeg,.png,.webp,.txt"
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />

          {uploading ? (
            <>
              <div className="upload-zone__spinner" />
              <p className="upload-zone__text">Uploading…</p>
            </>
          ) : (
            <>
              <div className="upload-zone__icon">
                <Upload size={24} />
              </div>
              <p className="upload-zone__text">
                <strong>Click to upload</strong> or drag and drop
              </p>
              <p className="upload-zone__hint">
                PDF · PPTX · DOCX · JPG · PNG · WEBP · TXT &nbsp;·&nbsp; Max 50 MB
              </p>
            </>
          )}
        </div>

        {/* ── Notes list ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="notes-loading">
            <div className="notes-spinner" />
          </div>
        ) : notes.length === 0 ? (
          <div className="notes-empty">
            <BookOpen size={36} />
            <p>No notes yet — upload your first file above.</p>
          </div>
        ) : (
          <>
            <p className="section-title">{notes.length} {notes.length === 1 ? "file" : "files"}</p>
            <div className="notes-grid">
              {notes.map((note) => (
                <div key={note._id} className="note-card">
                  <div className="note-card__icon">
                    <FileIcon mimetype={note.mimetype} name={note.originalName} />
                  </div>

                  <div className="note-card__info">
                    <div className="note-card__name" title={note.originalName}>
                      {note.originalName}
                    </div>
                    <div className="note-card__meta">
                      {formatSize(note.size)} · {formatDate(note.createdAt)}
                    </div>
                  </div>

                  <div className="note-card__actions">
                    <button
                      className="note-btn note-btn--download"
                      onClick={() => handleDownload(note)}
                      title="Download"
                    >
                      <Download size={14} />
                    </button>

                    <button
                      className={`note-btn note-btn--delete${confirmId === note._id ? " note-btn--confirm" : ""}`}
                      onClick={() => handleDelete(note)}
                      onBlur={() => setConfirmId(null)}
                      title={confirmId === note._id ? "Click again to confirm deletion" : "Delete"}
                    >
                      <Trash2 size={14} />
                      {confirmId === note._id && <span>Confirm?</span>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
