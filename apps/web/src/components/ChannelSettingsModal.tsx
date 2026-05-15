import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import type { ChannelRow } from "../hooks/useChannels";

type Props = {
  channel: ChannelRow;
  onClose: () => void;
  onUpdate: (patch: {
    name?: string;
    description?: string | null;
    emoji?: string | null;
    internal?: boolean;
  }) => Promise<boolean>;
  /** v0.47: показывать toggle «Internal channel». OWNER/ADMIN/MOD + Client mode. */
  showInternalToggle?: boolean;
};

/**
 * Channel-relevant emoji presets (компактный набор, не overwhelm picker).
 * 5 columns × 6 rows = 30 шт.
 */
const CHANNEL_EMOJI_PRESETS = [
  "💬", "🔔", "📢", "📌", "🗣️",
  "💡", "🧠", "🎯", "🚀", "🔥",
  "🐛", "🛠️", "⚙️", "🔧", "📦",
  "📊", "📈", "💰", "💸", "💎",
  "🎨", "🎮", "🎬", "🎵", "📺",
  "☕", "🍕", "🌍", "🌙", "⭐",
] as const;

const sectionLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  margin: "0 0 var(--ec-space-2) 0",
};

const groupCard: CSSProperties = {
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  padding: "var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const fieldHint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  lineHeight: 1.5,
  margin: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-surface-1)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  fontFamily: "inherit",
};

export function ChannelSettingsModal({
  channel,
  onClose,
  onUpdate,
  showInternalToggle = false,
}: Props) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [emoji, setEmoji] = useState<string | null>(channel.emoji);
  const [internal, setInternal] = useState<boolean>(channel.internal ?? false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // При смене канала (теоретически — props change) — сбросить state
  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description ?? "");
    setEmoji(channel.emoji);
    setInternal(channel.internal ?? false);
  }, [channel.id, channel.name, channel.description, channel.emoji, channel.internal]);

  const nameChanged = name.trim() !== channel.name;
  const descChanged = (description.trim() || null) !== (channel.description || null);
  const emojiChanged = (emoji || null) !== (channel.emoji || null);
  const internalChanged = internal !== (channel.internal ?? false);
  const canSave =
    (nameChanged || descChanged || emojiChanged || internalChanged) &&
    name.trim().length > 0 &&
    !saving;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const patch: {
      name?: string;
      description?: string | null;
      emoji?: string | null;
      internal?: boolean;
    } = {};
    if (nameChanged) patch.name = name.trim();
    if (descChanged) patch.description = description.trim() || null;
    if (emojiChanged) patch.emoji = emoji;
    if (internalChanged) patch.internal = internal;
    try {
      const ok = await onUpdate(patch);
      if (ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      } else {
        setError("Не удалось сохранить");
      }
    } finally {
      setSaving(false);
    }
  };

  const channelPrefix = emoji || (channel.type === "VOICE" ? "🔊" : "#");

  return (
    <Modal
      title={`Настройки канала ${channelPrefix} ${channel.name}`}
      onClose={onClose}
      width={560}
    >
      {/* Name */}
      <section>
        <h3 style={sectionLabel}>Название канала</h3>
        <div style={groupCard}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="general"
            style={inputStyle}
            autoFocus
          />
          <p style={fieldHint}>
            Видно всем участникам в боковой панели + breadcrumb сверху.
            До 80 символов. URL-slug канала <code style={{
              fontFamily: "var(--ec-font-mono)",
              fontSize: "0.85em",
              background: "var(--ec-surface-3)",
              padding: "0.05rem 0.3rem",
              borderRadius: "var(--ec-radius-sm)",
            }}>{channel.slug}</code> остаётся прежним даже после переименования —
            старые ссылки продолжат работать.
            <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
              {name.length}/80
            </span>
          </p>
        </div>
      </section>

      {/* Emoji prefix */}
      <section style={{ marginTop: "var(--ec-space-4)" }}>
        <h3 style={sectionLabel}>Иконка канала</h3>
        <div style={groupCard}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(10, 1fr)",
              gap: "var(--ec-space-1)",
            }}
          >
            <button
              type="button"
              onClick={() => setEmoji(null)}
              title="Сбросить — использовать стандартную #"
              style={{
                aspectRatio: "1",
                display: "grid",
                placeItems: "center",
                background: emoji === null ? "var(--ec-accent-soft)" : "var(--ec-surface-1)",
                border: emoji === null ? "1px solid var(--ec-accent)" : "1px solid var(--ec-border-subtle)",
                borderRadius: "var(--ec-radius-md)",
                fontSize: "1.1rem",
                color: emoji === null ? "var(--ec-accent)" : "var(--ec-text-muted)",
                cursor: "pointer",
                fontWeight: 700,
                transition: "all var(--ec-dur-fast) var(--ec-ease)",
              }}
            >
              {channel.type === "VOICE" ? "🔊" : "#"}
            </button>
            {CHANNEL_EMOJI_PRESETS.map((e) => {
              const active = emoji === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  title={e}
                  style={{
                    aspectRatio: "1",
                    display: "grid",
                    placeItems: "center",
                    background: active ? "var(--ec-accent-soft)" : "var(--ec-surface-1)",
                    border: active
                      ? "1px solid var(--ec-accent)"
                      : "1px solid var(--ec-border-subtle)",
                    borderRadius: "var(--ec-radius-md)",
                    fontSize: "1.05rem",
                    cursor: "pointer",
                    transition: "all var(--ec-dur-fast) var(--ec-ease)",
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
          <p style={fieldHint}>
            Кастомная иконка показывается вместо # / 🔊 в боковой панели
            и шапке чата. Сейчас: <span style={{ fontSize: "1rem" }}>{channelPrefix}</span>
          </p>
        </div>
      </section>

      {/* Description */}
      <section style={{ marginTop: "var(--ec-space-4)" }}>
        <h3 style={sectionLabel}>Описание</h3>
        <div style={groupCard}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1024}
            rows={4}
            placeholder="О чём этот канал. Что обсуждается. Правила."
            style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
          />
          <p style={fieldHint}>
            Показывается тонкой строкой под названием канала в шапке чата.
            Поддерживается markdown — bold, italic, ссылки, эмоджи. До 1024 символов.
            <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
              {description.length}/1024
            </span>
          </p>
        </div>
      </section>

      {/* v0.47 Client Mode v2: internal toggle. Видим только для
          OWNER/ADMIN/MOD в CLIENT-server'е (showInternalToggle prop). */}
      {showInternalToggle && (
        <section>
          <h3 style={sectionLabel}>Видимость для клиентов</h3>
          <div style={groupCard}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ec-space-3)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: "var(--ec-accent)",
                  cursor: "pointer",
                }}
              />
              <div>
                <div
                  style={{
                    color: "var(--ec-text-strong)",
                    fontSize: "var(--ec-text-sm)",
                    fontWeight: 500,
                  }}
                >
                  Internal channel — скрыт от клиентов
                </div>
                <div style={fieldHint}>
                  Если включено, канал виден только OWNER / ADMIN /
                  MODERATOR. Members с ролью клиента (MEMBER в
                  CLIENT-server'е) не увидят канал в списке.
                </div>
              </div>
            </label>
          </div>
        </section>
      )}

      {error && (
        <div
          style={{
            marginTop: "var(--ec-space-3)",
            padding: "var(--ec-space-2) var(--ec-space-3)",
            background: "var(--ec-danger-soft)",
            color: "var(--ec-danger)",
            border: "1px solid var(--ec-danger)",
            borderRadius: "var(--ec-radius-md)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--ec-space-2)",
          justifyContent: "flex-end",
          marginTop: "var(--ec-space-4)",
          alignItems: "center",
        }}
      >
        {savedFlash && (
          <span
            style={{
              color: "var(--ec-ok)",
              fontSize: "var(--ec-text-2xs)",
              marginRight: "auto",
            }}
          >
            ✓ Сохранено
          </span>
        )}
        <button type="button" onClick={onClose} className="ec-btn ec-btn--ghost">
          Закрыть
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="ec-btn ec-btn--primary"
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}
