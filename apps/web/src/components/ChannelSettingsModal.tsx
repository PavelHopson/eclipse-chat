import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import {
  ChannelGlyph,
  CHANNEL_ICON_PRESETS,
  getChannelIconLabel,
} from "./icons/ChannelCustomIcons";
import type { ChannelRow } from "../hooks/useChannels";

type Props = {
  channel: ChannelRow;
  onClose: () => void;
  onUpdate: (patch: {
    name?: string;
    description?: string | null;
    emoji?: string | null;
    internal?: boolean;
    messageTtlSeconds?: number | null;
  }) => Promise<boolean>;
  /** v0.47: показывать toggle «Internal channel». OWNER/ADMIN/MOD + Client mode. */
  showInternalToggle?: boolean;
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
  const [messageTtl, setMessageTtl] = useState<number | null>(channel.messageTtlSeconds ?? null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // При смене канала (теоретически — props change) — сбросить state
  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description ?? "");
    setEmoji(channel.emoji);
    setInternal(channel.internal ?? false);
    setMessageTtl(channel.messageTtlSeconds ?? null);
  }, [channel.id, channel.name, channel.description, channel.emoji, channel.internal, channel.messageTtlSeconds]);

  const nameChanged = name.trim() !== channel.name;
  const descChanged = (description.trim() || null) !== (channel.description || null);
  const emojiChanged = (emoji || null) !== (channel.emoji || null);
  const internalChanged = internal !== (channel.internal ?? false);
  const ttlChanged = messageTtl !== (channel.messageTtlSeconds ?? null);
  const canSave =
    (nameChanged || descChanged || emojiChanged || internalChanged || ttlChanged) &&
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
      messageTtlSeconds?: number | null;
    } = {};
    if (nameChanged) patch.name = name.trim();
    if (descChanged) patch.description = description.trim() || null;
    if (emojiChanged) patch.emoji = emoji;
    if (internalChanged) patch.internal = internal;
    if (ttlChanged) patch.messageTtlSeconds = messageTtl;
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

  const channelIconLabel = getChannelIconLabel(emoji, channel.type);

  return (
    <Modal
      title={`Настройки комнаты ${channel.name}`}
      onClose={onClose}
      width={560}
    >
      {/* Name */}
      <section>
        <h3 style={sectionLabel}>Название комнаты</h3>
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
            До 80 символов. URL-slug комнаты <code style={{
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

      {/* Channel icon */}
      <section style={{ marginTop: "var(--ec-space-4)" }}>
        <h3 style={sectionLabel}>Иконка комнаты</h3>
        <div style={groupCard}>
          <div className="ec-channel-icon-picker">
            <button
              type="button"
              onClick={() => setEmoji(null)}
              title="Сбросить — использовать системную иконку по типу комнаты"
              aria-pressed={emoji === null}
              className={[
                "ec-channel-icon-tile",
                "ec-channel-icon-tile--fallback",
                emoji === null ? "ec-channel-icon-tile--active" : "",
              ].filter(Boolean).join(" ")}
            >
              <ChannelGlyph
                type={channel.type}
                icon={null}
                size={18}
                className="ec-channel-icon-tile__glyph"
              />
              <span className="ec-channel-icon-tile__label">
                {channel.type === "VOICE" ? "Системная" : "Стандарт"}
              </span>
            </button>
            {CHANNEL_ICON_PRESETS.map((preset) => {
              const active = emoji === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setEmoji(preset.id)}
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={active}
                  className={[
                    "ec-channel-icon-tile",
                    active ? "ec-channel-icon-tile--active" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <ChannelGlyph
                    type={channel.type}
                    icon={preset.id}
                    size={18}
                    className="ec-channel-icon-tile__glyph"
                  />
                  <span className="ec-channel-icon-tile__label">{preset.label}</span>
                </button>
              );
            })}
          </div>
          <p style={fieldHint}>
            Кастомная иконка показывается в боковой панели и в шапке чата.
            <span className="ec-channel-icon-preview">
              <ChannelGlyph
                type={channel.type}
                icon={emoji}
                size={18}
                className="ec-channel-icon-preview__glyph"
              />
              <span>Сейчас: {channelIconLabel}</span>
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
            placeholder="О чём эта комната. Что обсуждается. Правила."
            style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
          />
          <p style={fieldHint}>
            Показывается тонкой строкой под названием комнаты в шапке чата.
            Поддерживается markdown — bold, italic, ссылки, эмоджи. До 1024 символов.
            <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
              {description.length}/1024
            </span>
          </p>
        </div>
      </section>

      {/* v1.7.0 — исчезающие сообщения (privacy slice A): дефолтный TTL канала. */}
      <section style={{ marginTop: "var(--ec-space-4)" }}>
        <h3 style={sectionLabel}>Исчезающие сообщения</h3>
        <div style={groupCard}>
          <select
            value={messageTtl === null ? "off" : String(messageTtl)}
            onChange={(e) => setMessageTtl(e.target.value === "off" ? null : Number(e.target.value))}
            style={inputStyle}
          >
            <option value="off">Выключено — сообщения не исчезают</option>
            <option value="3600">Через 1 час</option>
            <option value="86400">Через 24 часа</option>
            <option value="604800">Через 7 дней</option>
          </select>
          <p style={fieldHint}>
            Новые сообщения в этой комнате автоматически удаляются по таймеру —
            для приватных/временных обсуждений. Уже отправленные сообщения не
            затрагиваются. Удаление необратимо (без архива).
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
                  Внутренняя комната — скрыта от клиентов
                </div>
                <div style={fieldHint}>
                  Если включено, комната видна только OWNER / ADMIN /
                  MODERATOR. Members с ролью клиента (MEMBER в
                  CLIENT-пространстве) не увидят её в списке.
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
