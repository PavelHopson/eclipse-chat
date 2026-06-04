import { useEffect, useMemo, useState } from "react";
import { parseYouTubeUrl, toYouTubeEmbedUrl } from "../lib/youtubeEmbed";

type TrainingVideo = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
};

type TrainingSection = {
  id: string;
  name: string;
  videos: TrainingVideo[];
};

type Props = {
  serverId: string | null;
};

const DEFAULT_TRAINING_SECTION: TrainingSection = {
  id: "training",
  name: "Тренировки",
  videos: [],
};

function cloneDefaultTrainingSection(): TrainingSection {
  return { ...DEFAULT_TRAINING_SECTION, videos: [] };
}

function trainingStorageKey(serverId: string): string {
  return `ec.teamHealth.training.${serverId}`;
}

function makeTrainingId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampText(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function normalizeTrainingCatalog(raw: unknown): TrainingSection[] {
  if (!raw || typeof raw !== "object" || !("sections" in raw)) {
    return [cloneDefaultTrainingSection()];
  }
  const sections = (raw as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) {
    return [cloneDefaultTrainingSection()];
  }
  const normalized = sections
    .map((section): TrainingSection | null => {
      if (!section || typeof section !== "object") return null;
      const candidate = section as { id?: unknown; name?: unknown; videos?: unknown };
      const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : makeTrainingId("section");
      const name = typeof candidate.name === "string" && candidate.name.trim() ? clampText(candidate.name, 48) : "Раздел";
      const videos = Array.isArray(candidate.videos)
        ? candidate.videos
            .map((video): TrainingVideo | null => {
              if (!video || typeof video !== "object") return null;
              const v = video as { id?: unknown; title?: unknown; url?: unknown; createdAt?: unknown };
              if (typeof v.url !== "string" || !parseYouTubeUrl(v.url)) return null;
              return {
                id: typeof v.id === "string" && v.id.trim() ? v.id : makeTrainingId("video"),
                title: typeof v.title === "string" && v.title.trim() ? clampText(v.title, 80) : "Видео YouTube",
                url: v.url,
                createdAt: typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
              };
            })
            .filter((video): video is TrainingVideo => video !== null)
        : [];
      return { id, name, videos };
    })
    .filter((section): section is TrainingSection => section !== null);

  return normalized.length > 0 ? normalized : [cloneDefaultTrainingSection()];
}

export function TeamTrainingLibrary({ serverId }: Props) {
  const trainingKey = serverId ? trainingStorageKey(serverId) : null;
  const [sections, setSections] = useState<TrainingSection[]>([cloneDefaultTrainingSection()]);
  const [activeSectionId, setActiveSectionId] = useState(DEFAULT_TRAINING_SECTION.id);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [renameSectionId, setRenameSectionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trainingKey) {
      setSections([cloneDefaultTrainingSection()]);
      setActiveSectionId(DEFAULT_TRAINING_SECTION.id);
      setLoadedKey(null);
      return;
    }

    try {
      const stored = window.localStorage.getItem(trainingKey);
      const nextSections = stored ? normalizeTrainingCatalog(JSON.parse(stored)) : [cloneDefaultTrainingSection()];
      setSections(nextSections);
      setActiveSectionId((current) =>
        nextSections.some((section) => section.id === current) ? current : nextSections[0]?.id ?? DEFAULT_TRAINING_SECTION.id,
      );
      setLoadedKey(trainingKey);
    } catch {
      setSections([cloneDefaultTrainingSection()]);
      setActiveSectionId(DEFAULT_TRAINING_SECTION.id);
      setLoadedKey(trainingKey);
      setError("Не удалось прочитать локальную библиотеку тренировок. Начали с пустого раздела.");
    }
  }, [trainingKey]);

  useEffect(() => {
    if (!trainingKey || loadedKey !== trainingKey) return;
    try {
      window.localStorage.setItem(trainingKey, JSON.stringify({ sections }));
    } catch {
      setError("Не удалось сохранить библиотеку тренировок в браузере.");
    }
  }, [loadedKey, sections, trainingKey]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? cloneDefaultTrainingSection(),
    [activeSectionId, sections],
  );

  const createSection = () => {
    const name = clampText(newSectionName, 48);
    if (!name) {
      setError("Введите название раздела.");
      return;
    }
    const section: TrainingSection = { id: makeTrainingId("section"), name, videos: [] };
    setSections((current) => [...current, section]);
    setActiveSectionId(section.id);
    setNewSectionName("");
    setError(null);
  };

  const saveSectionName = (sectionId: string) => {
    const name = clampText(renameDraft, 48);
    if (!name) {
      setError("Название раздела не может быть пустым.");
      return;
    }
    setSections((current) => current.map((section) => (section.id === sectionId ? { ...section, name } : section)));
    setRenameSectionId(null);
    setRenameDraft("");
    setError(null);
  };

  const addVideo = () => {
    if (!parseYouTubeUrl(url)) {
      setError("Добавьте корректную ссылку YouTube.");
      return;
    }
    const video: TrainingVideo = {
      id: makeTrainingId("video"),
      title: clampText(title, 80) || "Видео YouTube",
      url: url.trim(),
      createdAt: new Date().toISOString(),
    };
    setSections((current) =>
      current.map((section) =>
        section.id === activeSection.id ? { ...section, videos: [video, ...section.videos] } : section,
      ),
    );
    setTitle("");
    setUrl("");
    setError(null);
  };

  const removeVideo = (videoId: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === activeSection.id
          ? { ...section, videos: section.videos.filter((video) => video.id !== videoId) }
          : section,
      ),
    );
  };

  return (
    <section className="ec-team-training" aria-labelledby="team-training-title">
      <div className="ec-team-training__head">
        <div>
          <h3 id="team-training-title" className="ec-team-training__title">
            Тренировки
          </h3>
          <p className="ec-team-training__hint">
            Локальная библиотека видео для этого пространства на текущем устройстве.
          </p>
        </div>
        <div className="ec-team-training__new-section">
          <input
            className="ec-field ec-team-training__input"
            value={newSectionName}
            onChange={(event) => setNewSectionName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createSection();
            }}
            maxLength={48}
            placeholder="Новый раздел"
            aria-label="Название нового раздела тренировок"
          />
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={createSection}>
            + Раздел
          </button>
        </div>
      </div>

      <div className="ec-team-training__sections" role="tablist" aria-label="Разделы тренировок">
        {sections.map((section) => {
          const isActive = section.id === activeSectionId;
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
                      if (event.key === "Enter") saveSectionName(section.id);
                      if (event.key === "Escape") {
                        setRenameSectionId(null);
                        setRenameDraft("");
                      }
                    }}
                    maxLength={48}
                    autoFocus
                    aria-label="Новое название раздела"
                  />
                  <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => saveSectionName(section.id)}>
                    OK
                  </button>
                  <button
                    type="button"
                    className="ec-btn ec-btn--ghost ec-btn--sm"
                    onClick={() => {
                      setRenameSectionId(null);
                      setRenameDraft("");
                    }}
                  >
                    Отмена
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
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="ec-team-training__active-summary">
        <div>
          <span className="ec-team-training__active-kicker">Активный раздел</span>
          <strong>{activeSection.name}</strong>
        </div>
        <span>{activeSection.videos.length === 0 ? "нет видео" : `${activeSection.videos.length} видео`}</span>
      </div>

      <div className="ec-team-training__form">
        <input
          className="ec-field ec-team-training__input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          placeholder="Название видео"
          aria-label="Название видео"
        />
        <input
          className="ec-field ec-team-training__input ec-team-training__input--url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addVideo();
          }}
          placeholder="Ссылка YouTube"
          aria-label="Ссылка YouTube"
        />
        <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={addVideo}>
          Добавить видео
        </button>
      </div>

      {error && <div className="ec-team-training__error">{error}</div>}

      {activeSection.videos.length === 0 ? (
        <div className="ec-team-training__empty">
          В разделе «{activeSection.name}» пока нет видео. Добавьте первую тренировку ссылкой YouTube.
        </div>
      ) : (
        <div className="ec-team-training__videos" role="tabpanel" aria-label={`Видео раздела ${activeSection.name}`}>
          {activeSection.videos.map((video) => (
            <TrainingVideoCard key={video.id} video={video} onRemove={() => removeVideo(video.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function TrainingVideoCard({ video, onRemove }: { video: TrainingVideo; onRemove: () => void }) {
  const parsed = parseYouTubeUrl(video.url);
  if (!parsed) {
    return (
      <article className="ec-team-training-video">
        <div className="ec-team-training-video__bad-link">Ссылка недоступна</div>
        <button type="button" className="ec-team-training-video__remove" onClick={onRemove}>
          Удалить
        </button>
      </article>
    );
  }

  return (
    <article className="ec-team-training-video">
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
        <div className="ec-team-training-video__title">{video.title}</div>
        <div className="ec-team-training-video__actions">
          <a className="ec-team-training-video__link" href={video.url} target="_blank" rel="noopener noreferrer">
            YouTube
          </a>
          <button type="button" className="ec-team-training-video__remove" onClick={onRemove}>
            Удалить
          </button>
        </div>
      </div>
    </article>
  );
}
