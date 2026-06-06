import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, api, apiJson } from "../lib/api";
import { resolveAssetUrl } from "../lib/assets";
import { fileToBase64 } from "../lib/fileToBase64";
import { SocketEvents } from "../lib/socket";
import { parseYouTubeUrl, toYouTubeEmbedUrl } from "../lib/youtubeEmbed";

type TrainingVideoSource = "youtube" | "file";

type TrainingVideo = {
  id: string;
  title: string;
  url: string;
  source: TrainingVideoSource;
  createdAt: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
};

type TrainingSection = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  videos: TrainingVideo[];
};

type TrainingCatalogResponse = {
  sections: TrainingSection[];
};

type UploadedTrainingVideo = {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
};

type Props = {
  serverId: string | null;
  canUploadFiles: boolean;
  socket?: Socket | null;
};

const TRAINING_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const TRAINING_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
]);
const TRAINING_VIDEO_ACCEPT = Array.from(TRAINING_VIDEO_MIME).join(",");

function trainingStorageKey(serverId: string): string {
  return `ec.teamHealth.training.${serverId}`;
}

function clampText(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function titleFromFilename(filename: string): string {
  return clampText(filename.replace(/\.[^.]+$/, ""), 80) || "Видео файл";
}

function formatBytes(size: number | null | undefined): string | null {
  if (!Number.isFinite(size) || size == null) return null;
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function mimeFromVideoFile(file: File): string | null {
  if (TRAINING_VIDEO_MIME.has(file.type)) return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    default:
      return null;
  }
}

function normalizeLegacyCatalog(raw: unknown): Array<{ name: string; videos: Array<Omit<TrainingVideo, "id">> }> {
  if (!raw || typeof raw !== "object" || !("sections" in raw)) return [];
  const sections = (raw as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    if (!section || typeof section !== "object") return [];
    const candidate = section as { name?: unknown; videos?: unknown };
    const name = typeof candidate.name === "string" ? clampText(candidate.name, 48) : "";
    if (!name || !Array.isArray(candidate.videos)) return [];
    const videos = candidate.videos.flatMap((video) => {
      if (!video || typeof video !== "object") return [];
      const v = video as {
        title?: unknown;
        url?: unknown;
        source?: unknown;
        createdAt?: unknown;
        filename?: unknown;
        mimeType?: unknown;
        size?: unknown;
      };
      if (typeof v.url !== "string") return [];
      const source: TrainingVideoSource = v.source === "file" ? "file" : "youtube";
      if (source === "youtube" && !parseYouTubeUrl(v.url)) return [];
      if (source === "file" && !v.url.startsWith("/uploads/training-videos/")) return [];
      return [{
        title: typeof v.title === "string" && v.title.trim() ? clampText(v.title, 80) : source === "file" && typeof v.filename === "string" ? titleFromFilename(v.filename) : "Видео YouTube",
        url: v.url,
        source,
        createdAt: typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
        filename: typeof v.filename === "string" ? v.filename : null,
        mimeType: typeof v.mimeType === "string" ? v.mimeType : source === "file" ? "video/mp4" : null,
        size: typeof v.size === "number" && Number.isFinite(v.size) ? v.size : null,
      }];
    });
    return [{ name, videos }];
  });
}

export function TeamTrainingLibrary({ serverId, canUploadFiles, socket }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const legacyImportRef = useRef<string | null>(null);
  const [sections, setSections] = useState<TrainingSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [renameSectionId, setRenameSectionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!serverId) {
      setSections([]);
      setActiveSectionId(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson<TrainingCatalogResponse>(`api/servers/${encodeURIComponent(serverId)}/training-library`);
      setSections(data.sections);
      setActiveSectionId((current) =>
        current && data.sections.some((section) => section.id === current)
          ? current
          : data.sections[0]?.id ?? null,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить библиотеку тренировок.");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!socket || !serverId) return;
    const onUpdated = (payload: { serverId?: string }) => {
      if (payload.serverId === serverId) void reload();
    };
    socket.on(SocketEvents.TrainingCatalogUpdated, onUpdated);
    return () => {
      socket.off(SocketEvents.TrainingCatalogUpdated, onUpdated);
    };
  }, [reload, serverId, socket]);

  useEffect(() => {
    if (!serverId || !canUploadFiles || sections.length > 0 || legacyImportRef.current === serverId) return;
    legacyImportRef.current = serverId;
    try {
      const raw = window.localStorage.getItem(trainingStorageKey(serverId));
      if (!raw) return;
      const legacy = normalizeLegacyCatalog(JSON.parse(raw));
      if (legacy.length === 0) return;
      void importLegacyCatalog(serverId, legacy).then((imported) => {
        if (imported) window.localStorage.removeItem(trainingStorageKey(serverId));
      });
    } catch {
      /* localStorage может быть отключён; серверный каталог всё равно работает */
    }
  }, [canUploadFiles, sections.length, serverId]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? null,
    [activeSectionId, sections],
  );

  async function importLegacyCatalog(
    targetServerId: string,
    legacy: Array<{ name: string; videos: Array<Omit<TrainingVideo, "id">> }>,
  ): Promise<boolean> {
    setBusy(true);
    try {
      let latest: TrainingCatalogResponse | null = null;
      for (const section of legacy) {
        latest = await apiJson<TrainingCatalogResponse>(`api/servers/${encodeURIComponent(targetServerId)}/training-sections`, {
          method: "POST",
          body: JSON.stringify({ name: section.name }),
        });
        const created = latest.sections.find((item) => item.name === section.name) ?? latest.sections.at(-1);
        if (!created) continue;
        for (const video of section.videos) {
          latest = await apiJson<TrainingCatalogResponse>(`api/servers/${encodeURIComponent(targetServerId)}/training-videos`, {
            method: "POST",
            body: JSON.stringify({
              sectionId: created.id,
              title: video.title,
              url: video.url,
              source: video.source,
              filename: video.filename ?? undefined,
              mimeType: video.mimeType ?? undefined,
              size: video.size ?? undefined,
            }),
          });
        }
      }
      if (latest) {
        setSections(latest.sections);
        setActiveSectionId(latest.sections[0]?.id ?? null);
      } else {
        await reload();
      }
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось перенести локальную библиотеку на сервер.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createSection() {
    if (!serverId) return;
    const name = clampText(newSectionName, 48);
    if (!name) {
      setError("Введите название раздела.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiJson<TrainingCatalogResponse>(`api/servers/${encodeURIComponent(serverId)}/training-sections`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setSections(data.sections);
      setActiveSectionId(data.sections.at(-1)?.id ?? data.sections[0]?.id ?? null);
      setNewSectionName("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать раздел.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSectionName(sectionId: string) {
    const name = clampText(renameDraft, 48);
    if (!name) {
      setError("Название раздела не может быть пустым.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiJson<TrainingCatalogResponse>(`api/training-sections/${encodeURIComponent(sectionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setSections(data.sections);
      setRenameSectionId(null);
      setRenameDraft("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось переименовать раздел.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSection(sectionId: string) {
    if (!window.confirm("Удалить раздел тренировок? Видео внутри раздела тоже будут удалены.")) return;
    setBusy(true);
    try {
      const res = await api(`api/training-sections/${encodeURIComponent(sectionId)}`, { method: "DELETE" });
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status, null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить раздел.");
      setBusy(false);
      return;
    }
    await reload();
    setBusy(false);
  }

  async function addVideo() {
    if (!serverId || !activeSection) return;
    if (!parseYouTubeUrl(url)) {
      setError("Добавьте корректную ссылку YouTube.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiJson<TrainingCatalogResponse>(`api/servers/${encodeURIComponent(serverId)}/training-videos`, {
        method: "POST",
        body: JSON.stringify({
          sectionId: activeSection.id,
          title: clampText(title, 80) || "Видео YouTube",
          url: url.trim(),
          source: "youtube",
        }),
      });
      setSections(data.sections);
      setTitle("");
      setUrl("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить YouTube-видео.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (!serverId || !activeSection) return;
    if (!canUploadFiles) {
      setError("Загружать видеофайлы могут только OWNER/ADMIN.");
      return;
    }
    const mimeType = mimeFromVideoFile(file);
    if (!mimeType) {
      setError("Поддерживаются MP4, WebM, MOV, MKV и AVI.");
      return;
    }
    if (file.size > TRAINING_VIDEO_MAX_BYTES) {
      setError("Файл слишком большой. Максимум — 200 MB.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const dataBase64 = await fileToBase64(file);
      const uploaded = await apiJson<{ file: UploadedTrainingVideo }>(
        `api/servers/${encodeURIComponent(serverId)}/training-videos/upload`,
        {
          method: "POST",
          body: JSON.stringify({
            file: {
              filename: file.name,
              mimeType,
              dataBase64,
            },
          }),
        },
      );
      const data = await apiJson<TrainingCatalogResponse>(`api/servers/${encodeURIComponent(serverId)}/training-videos`, {
        method: "POST",
        body: JSON.stringify({
          sectionId: activeSection.id,
          title: clampText(title, 80) || titleFromFilename(uploaded.file.filename),
          url: uploaded.file.url,
          source: "file",
          filename: uploaded.file.filename,
          mimeType: uploaded.file.mimeType,
          size: uploaded.file.size,
        }),
      });
      setSections(data.sections);
      setTitle("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Загружать видеофайлы могут только OWNER/ADMIN.");
      } else {
        setError(err instanceof Error ? err.message : "Не удалось загрузить видео.");
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeVideo(videoId: string) {
    setBusy(true);
    try {
      const res = await api(`api/training-videos/${encodeURIComponent(videoId)}`, { method: "DELETE" });
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status, null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить видео.");
      setBusy(false);
      return;
    }
    await reload();
    setBusy(false);
  }

  const canEdit = canUploadFiles;

  return (
    <section className="ec-team-training" aria-labelledby="team-training-title">
      <div className="ec-team-training__head">
        <div>
          <h3 id="team-training-title" className="ec-team-training__title">
            Тренировки
          </h3>
          <p className="ec-team-training__hint">
            Общая библиотека разделов и видео для всех участников пространства. Добавление и управление доступны OWNER/ADMIN.
          </p>
        </div>
        {canEdit && (
          <div className="ec-team-training__new-section">
            <input
              className="ec-field ec-team-training__input"
              value={newSectionName}
              onChange={(event) => setNewSectionName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createSection();
              }}
              maxLength={48}
              placeholder="Новый раздел"
              aria-label="Название нового раздела тренировок"
              disabled={busy}
            />
            <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => void createSection()} disabled={busy}>
              + Раздел
            </button>
          </div>
        )}
      </div>

      {loading && sections.length === 0 ? (
        <div className="ec-team-training__empty">Загружаем общую библиотеку тренировок...</div>
      ) : (
        <>
          <div className="ec-team-training__controls">
            <div className="ec-team-training__sections" role="tablist" aria-label="Разделы тренировок">
              {sections.map((section) => {
                const isActive = section.id === activeSection?.id;
                const isRenaming = section.id === renameSectionId;
                return (
                  <div key={section.id} className="ec-team-training__section-wrap">
                    {isRenaming ? (
                      <div className="ec-team-training__rename">
                        <input
                          className="ec-field ec-team-training__input"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void saveSectionName(section.id);
                            if (event.key === "Escape") {
                              setRenameSectionId(null);
                              setRenameDraft("");
                            }
                          }}
                          maxLength={48}
                          autoFocus
                          disabled={busy}
                          aria-label="Новое название раздела"
                        />
                        <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => void saveSectionName(section.id)} disabled={busy}>
                          OK
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          className={`ec-team-training__section ${isActive ? "ec-team-training__section--active" : ""}`}
                          onClick={() => {
                            setActiveSectionId(section.id);
                            setError(null);
                          }}
                        >
                          <span>{section.name}</span>
                          <span className="ec-team-training__count">{section.videos.length}</span>
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              className="ec-team-training__section-action"
                              onClick={() => {
                                setRenameSectionId(section.id);
                                setRenameDraft(section.name);
                                setError(null);
                              }}
                              title="Переименовать раздел"
                              aria-label={`Переименовать раздел ${section.name}`}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="ec-team-training__section-action"
                              onClick={() => void deleteSection(section.id)}
                              title="Удалить раздел"
                              aria-label={`Удалить раздел ${section.name}`}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="ec-team-training__active-summary">
              <div>
                <span className="ec-team-training__active-kicker">Активный раздел</span>
                <strong>{activeSection?.name ?? "Разделов пока нет"}</strong>
              </div>
              <span>{activeSection ? (activeSection.videos.length === 0 ? "нет видео" : `${activeSection.videos.length} видео`) : "создайте раздел"}</span>
            </div>

            {canEdit && activeSection && (
              <div className="ec-team-training__form">
                <input
                  className="ec-field ec-team-training__input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  placeholder="Название видео"
                  aria-label="Название видео"
                  disabled={busy}
                />
                <input
                  className="ec-field ec-team-training__input ec-team-training__input--url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void addVideo();
                  }}
                  placeholder="Ссылка YouTube"
                  aria-label="Ссылка YouTube"
                  disabled={busy}
                />
                <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={() => void addVideo()} disabled={busy}>
                  Добавить YouTube
                </button>
                <input
                  ref={fileInputRef}
                  className="ec-team-training__file-input"
                  type="file"
                  accept={TRAINING_VIDEO_ACCEPT}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                />
                <button
                  type="button"
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {busy ? "Сохраняю..." : "Загрузить файл"}
                </button>
                <p className="ec-team-training__upload-hint">
                  Файлы: MP4, WebM, MOV, MKV, AVI до 200 MB. После сохранения видео видно всем участникам сервера.
                </p>
              </div>
            )}

            {error && <div className="ec-team-training__error">{error}</div>}
          </div>

          <div className="ec-team-training__stage">
            {!activeSection ? (
              <div className="ec-team-training__empty">
                {canEdit ? "Создайте первый раздел тренировок." : "Разделы тренировок пока не добавлены."}
              </div>
            ) : activeSection.videos.length === 0 ? (
              <div className="ec-team-training__empty">
                В разделе «{activeSection.name}» пока нет видео.
              </div>
            ) : (
              <div className="ec-team-training__videos" role="tabpanel" aria-label={`Видео раздела ${activeSection.name}`}>
                {activeSection.videos.map((video) => (
                  <TrainingVideoCard
                    key={video.id}
                    video={video}
                    canEdit={canEdit}
                    onRemove={() => void removeVideo(video.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function TrainingVideoCard({ video, canEdit, onRemove }: { video: TrainingVideo; canEdit: boolean; onRemove: () => void }) {
  if (video.source === "file") {
    const src = resolveAssetUrl(video.url);
    return (
      <article className="ec-team-training-video ec-team-training-video--file">
        <div className="ec-team-training-video__frame">
          {src ? (
            <video controls preload="metadata" src={src} />
          ) : (
            <div className="ec-team-training-video__bad-link">Файл недоступен</div>
          )}
        </div>
        <div className="ec-team-training-video__meta">
          <div>
            <div className="ec-team-training-video__title">{video.title}</div>
            <div className="ec-team-training-video__source">
              Файл{formatBytes(video.size) ? ` · ${formatBytes(video.size)}` : ""}
            </div>
          </div>
          <div className="ec-team-training-video__actions">
            {src && (
              <a className="ec-team-training-video__link" href={src} target="_blank" rel="noopener noreferrer">
                Открыть
              </a>
            )}
            {canEdit && (
              <button type="button" className="ec-team-training-video__remove" onClick={onRemove}>
                Удалить
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  const parsed = parseYouTubeUrl(video.url);
  if (!parsed) {
    return (
      <article className="ec-team-training-video">
        <div className="ec-team-training-video__bad-link">Ссылка недоступна</div>
        {canEdit && (
          <button type="button" className="ec-team-training-video__remove" onClick={onRemove}>
            Удалить
          </button>
        )}
      </article>
    );
  }

  return (
    <article className="ec-team-training-video ec-team-training-video--youtube">
      <div className="ec-team-training-video__frame">
        <iframe
          title={video.title}
          src={toYouTubeEmbedUrl(parsed)}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="ec-team-training-video__meta">
        <div>
          <div className="ec-team-training-video__title">{video.title}</div>
          <div className="ec-team-training-video__source">YouTube</div>
        </div>
        <div className="ec-team-training-video__actions">
          <a className="ec-team-training-video__link" href={video.url} target="_blank" rel="noopener noreferrer">
            YouTube
          </a>
          {canEdit && (
            <button type="button" className="ec-team-training-video__remove" onClick={onRemove}>
              Удалить
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
