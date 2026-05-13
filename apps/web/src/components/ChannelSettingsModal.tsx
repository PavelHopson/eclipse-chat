import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import type { ChannelRow } from "../hooks/useChannels";

type Props = {
  channel: ChannelRow;
  onClose: () => void;
  onUpdate: (patch: { name?: string; description?: string | null }) => Promise<boolean>;
};

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

export function ChannelSettingsModal({ channel, onClose, onUpdate }: Props) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // При смене канала (теоретически — props change) — сбросить state
  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description ?? "");
  }, [channel.id, channel.name, channel.description]);

  const nameChanged = name.trim() !== channel.name;
  const descChanged = (description.trim() || null) !== (channel.description || null);
  const canSave = (nameChanged || descChanged) && name.trim().length > 0 && !saving;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const patch: { name?: string; description?: string | null } = {};
    if (nameChanged) patch.name = name.trim();
    if (descChanged) patch.description = description.trim() || null;
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

  const channelPrefix = channel.type === "VOICE" ? "🔊" : "#";

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
