import { useEffect, useState } from "react";
import {
  deleteServerEmoji,
  listServerEmojis,
  uploadServerEmoji,
  type ServerEmoji,
} from "../lib/emojis";
import { ApiError } from "../lib/api";
import { fileToBase64 } from "../lib/fileToBase64";
import { notifyEmojisChanged } from "../hooks/useServerEmojis";

/**
 * v1.2.21 — Admin Emojis tab: upload + delete custom-emoji сервера.
 * Парсер `:shortcode:` и picker — следующими слайсами.
 *
 * Доступ: AdminPanel уже отсекает не-OWNER/ADMIN на уровне `accessDenied`,
 * этот таб виден только им. Backend (`/api/servers/:id/emojis`) тоже
 * проверяет роль — defense in depth.
 */

type Props = {
  serverId: string;
};

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const MAX_BYTES = 5 * 1024 * 1024;
const SHORTCODE_RE = /^[a-z0-9_-]{2,30}$/;

function suggestShortcodeFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").toLowerCase();
  return base.replace(/[^a-z0-9_-]+/g, "_").slice(0, 30);
}

export function AdminEmojisTab({ serverId }: Props) {
  const [emojis, setEmojis] = useState<ServerEmoji[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [shortcode, setShortcode] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listServerEmojis(serverId)
      .then((rows) => {
        if (!cancelled) setEmojis(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(
            e instanceof ApiError ? e.message : "Не удалось загрузить эмодзи.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const onPickFile = (f: File | null) => {
    setUploadError(null);
    setFile(f);
    if (f && !shortcode) {
      setShortcode(suggestShortcodeFromFilename(f.name));
    }
  };

  const submitUpload = async () => {
    if (!file) {
      setUploadError("Выбери файл");
      return;
    }
    if (!ALLOWED_MIME.has(file.type)) {
      setUploadError(
        `Формат ${file.type || "не определён"}. JPEG / PNG / WebP / GIF / AVIF.`,
      );
      return;
    }
    if (file.size === 0) {
      setUploadError("Пустой файл");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(
        `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} MB). Максимум 5 MB.`,
      );
      return;
    }
    const sc = shortcode.trim().toLowerCase();
    if (!SHORTCODE_RE.test(sc)) {
      setUploadError("Shortcode: 2–30 символов [a-z0-9_-]");
      return;
    }
    setUploadBusy(true);
    setUploadError(null);
    try {
      const dataBase64 = await fileToBase64(file);
      const created = await uploadServerEmoji(serverId, {
        shortcode: sc,
        contentType: file.type,
        dataBase64,
      });
      setEmojis((prev) => [created, ...(prev ?? [])]);
      setFile(null);
      setShortcode("");
      notifyEmojisChanged(serverId);
    } catch (e) {
      setUploadError(
        e instanceof ApiError ? e.message : "Не удалось загрузить эмодзи.",
      );
    } finally {
      setUploadBusy(false);
    }
  };

  const removeEmoji = async (id: string, sc: string) => {
    if (!window.confirm(`Удалить :${sc}:?`)) return;
    try {
      await deleteServerEmoji(id);
      setEmojis((prev) => prev?.filter((e) => e.id !== id) ?? null);
      notifyEmojisChanged(serverId);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Не удалось удалить.";
      window.alert(msg);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-4)" }}>
      <div>
        <div className="ec-admin-eyebrow">v1.2.21</div>
        <h3 className="ec-admin-title">Кастомные эмодзи</h3>
        <p
          className="ec-admin-sub"
          style={{ marginTop: "var(--ec-space-1)", maxWidth: 560 }}
        >
          Загрузи картинки и используй <code>:shortcode:</code> в сообщениях и
          реакциях. Лимит — 100 эмодзи на сервер. Файл до 5 MB, JPEG / PNG /
          WebP / GIF / AVIF. Картинка нарезается в webp 128×128.
        </p>
      </div>

      {/* Upload row */}
      <div
        className="ec-admin-card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: "var(--ec-space-2)",
          alignItems: "end",
        }}
      >
        <label
          style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}
        >
          <span className="ec-admin-card-label">Файл</span>
          <input
            type="file"
            accept={Array.from(ALLOWED_MIME).join(",")}
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            disabled={uploadBusy}
            className="ec-admin-input"
          />
        </label>
        <label
          style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}
        >
          <span className="ec-admin-card-label">Shortcode</span>
          <input
            type="text"
            value={shortcode}
            onChange={(e) => setShortcode(e.target.value)}
            placeholder="party_blob"
            maxLength={30}
            disabled={uploadBusy}
            className="ec-admin-input"
          />
        </label>
        <button
          type="button"
          className="ec-btn ec-btn--primary"
          disabled={uploadBusy || !file || shortcode.trim().length === 0}
          onClick={submitUpload}
        >
          {uploadBusy ? "Загружаю…" : "Загрузить"}
        </button>
        {uploadError && (
          <div
            style={{
              gridColumn: "1 / -1",
              color: "var(--ec-danger)",
              fontSize: "var(--ec-text-xs)",
            }}
          >
            {uploadError}
          </div>
        )}
      </div>

      {/* List */}
      {loading && <div className="ec-cck-empty">Загрузка…</div>}
      {loadError && (
        <div className="ec-cck-banner ec-cck-banner--error">{loadError}</div>
      )}
      {emojis && emojis.length === 0 && !loading && (
        <div className="ec-cck-empty">Пока нет кастомных эмодзи.</div>
      )}
      {emojis && emojis.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "var(--ec-space-2)",
          }}
        >
          {emojis.map((e) => (
            <div
              key={e.id}
              className="ec-admin-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ec-space-2)",
                padding: "var(--ec-space-2)",
              }}
            >
              <img
                src={e.url}
                alt={`:${e.shortcode}:`}
                width={48}
                height={48}
                loading="lazy"
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "contain",
                  borderRadius: "var(--ec-radius-sm)",
                  background: "var(--ec-surface-2)",
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
                    fontSize: "var(--ec-text-sm)",
                    color: "var(--ec-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={`:${e.shortcode}:`}
                >
                  :{e.shortcode}:
                </div>
                <div
                  style={{
                    fontSize: "var(--ec-text-2xs)",
                    color: "var(--ec-text-dim)",
                  }}
                >
                  {e.uploader?.displayName ?? "—"}
                </div>
              </div>
              <button
                type="button"
                className="ec-btn ec-btn--sm ec-btn--danger"
                onClick={() => removeEmoji(e.id, e.shortcode)}
                title="Удалить"
                aria-label={`Удалить :${e.shortcode}:`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
