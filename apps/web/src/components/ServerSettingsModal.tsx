import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { BotsTab } from "./BotsTab";
import type { ServerRow } from "../hooks/useServers";
import { resolveAssetUrl } from "../lib/assets";

type Props = {
  server: ServerRow;
  onClose: () => void;
  onUploadBanner: (file: File) => Promise<boolean>;
  onDeleteBanner: () => Promise<boolean>;
  onUpdateIdentity: (patch: {
    name?: string;
    brandColor?: string | null;
    description?: string | null;
    welcomeMessage?: string | null;
    mode?: "ENGINEERING" | "CLIENT";
  }) => Promise<boolean>;
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

// Преcеты цветов — креативный набор холодных тонов + аварийный warm-orange.
const COLOR_PRESETS: { name: string; hsl: string; demo: string }[] = [
  { name: "Cool sky", hsl: "195 70% 60%", demo: "hsl(195 70% 60%)" },
  { name: "Teal mint", hsl: "168 60% 58%", demo: "hsl(168 60% 58%)" },
  { name: "Electric violet", hsl: "252 70% 70%", demo: "hsl(252 70% 70%)" },
  { name: "Plasma pink", hsl: "320 75% 68%", demo: "hsl(320 75% 68%)" },
  { name: "Azure", hsl: "215 80% 68%", demo: "hsl(215 80% 68%)" },
  { name: "Lime", hsl: "85 60% 62%", demo: "hsl(85 60% 62%)" },
  { name: "Amber", hsl: "38 90% 60%", demo: "hsl(38 90% 60%)" },
  { name: "Coral", hsl: "12 85% 65%", demo: "hsl(12 85% 65%)" },
];

function parseHsl(value: string | null | undefined): { h: number; s: number; l: number } | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

function hslString(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

export function ServerSettingsModal({
  server,
  onClose,
  onUploadBanner,
  onDeleteBanner,
  onUpdateIdentity,
}: Props) {
  const [tab, setTab] = useState<"identity" | "banner" | "bots">("identity");
  const [name, setName] = useState<string>(server.name);
  const [mode, setMode] = useState<"ENGINEERING" | "CLIENT">(server.mode ?? "ENGINEERING");
  const [brandColor, setBrandColor] = useState<string>(server.brandColor ?? "");
  const [description, setDescription] = useState<string>(server.description ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState<string>(server.welcomeMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live preview brand-color: применяем к --ec-accent сразу же по mouse-up
  // на color-picker. На modal close — useEffect cleanup в AppShell вернёт
  // фактический server.brandColor (или default).
  const applyPreview = (hsl: string) => {
    if (/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(hsl)) {
      document.documentElement.style.setProperty("--ec-accent", `hsl(${hsl})`);
    }
  };

  useEffect(() => {
    // На unmount — если brandColor не сохранён, AppShell useEffect восстановит.
    return () => {
      /* no-op */
    };
  }, []);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 80;

  const handleSave = async () => {
    if (!nameValid) return;
    setSaving(true);
    try {
      const ok = await onUpdateIdentity({
        name: trimmedName,
        brandColor: brandColor.trim() || null,
        description: description.trim() || null,
        welcomeMessage: welcomeMessage.trim() || null,
        mode,
      });
      if (ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadBanner(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const parsed = parseHsl(brandColor);

  return (
    <Modal title={`Оформление пространства «${server.name}»`} onClose={onClose} width={620}>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: "var(--ec-surface-1)",
          borderRadius: "var(--ec-radius-md)",
          border: "1px solid var(--ec-border-subtle)",
          marginBottom: "var(--ec-space-3)",
        }}
        role="tablist"
      >
        {(
          [
            { id: "identity", label: "Идентичность" },
            { id: "banner", label: "Баннер" },
            { id: "bots", label: "Боты" },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "0.5rem 0.8rem",
                borderRadius: "var(--ec-radius-sm)",
                background: active ? "var(--ec-accent)" : "transparent",
                color: active ? "#fff" : "var(--ec-text-muted)",
                border: 0,
                cursor: "pointer",
                fontSize: "var(--ec-text-sm)",
                fontWeight: 600,
                letterSpacing: "var(--ec-tracking-wide)",
                boxShadow: active
                  ? "0 0 0 1px var(--ec-accent), 0 0 12px -2px hsl(195 70% 60% / 0.4)"
                  : "none",
                transition: "all var(--ec-dur-fast) var(--ec-ease)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "identity" && (
        <>
          {/* Server name */}
          <section style={{ marginBottom: "var(--ec-space-4)" }}>
            <h3 style={sectionLabel}>Название пространства</h3>
            <div style={groupCard}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Название пространства"
                style={{
                  ...inputStyle,
                  borderColor: nameValid
                    ? "var(--ec-border-default)"
                    : "var(--ec-danger)",
                }}
              />
              <p style={fieldHint}>
                Видно всем участникам в списке пространств и в шапке. 1–80 символов.
                Slug (внутренний идентификатор для ссылок) при переименовании
                не меняется.
                <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
                  {trimmedName.length}/80
                </span>
              </p>
            </div>
          </section>

          {/* Server mode */}
          <section style={{ marginBottom: "var(--ec-space-4)" }}>
            <h3 style={sectionLabel}>Режим</h3>
            <div style={groupCard}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ec-space-2)" }}>
                {([
                  {
                    id: "ENGINEERING" as const,
                    title: "Engineering",
                    desc: "Полный operator-инструментарий — Status Board, slash-commands, AI-сводки. Для внутренних команд.",
                  },
                  {
                    id: "CLIENT" as const,
                    title: "Client",
                    desc: "Calm portal для клиента — без developer-chrome, focus на approvals / files / summaries. Для агентств / dev-студий.",
                  },
                ]).map((opt) => {
                  const active = mode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMode(opt.id)}
                      style={{
                        textAlign: "left",
                        padding: "var(--ec-space-3)",
                        borderRadius: "var(--ec-radius-md)",
                        background: active ? "var(--ec-accent-soft)" : "var(--ec-surface-1)",
                        border: active
                          ? "1px solid var(--ec-border-accent)"
                          : "1px solid var(--ec-border-default)",
                        color: active ? "var(--ec-text-strong)" : "var(--ec-text)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        transition: "all var(--ec-dur-fast) var(--ec-ease)",
                        boxShadow: active ? "0 0 0 1px var(--ec-accent), 0 0 14px -2px hsl(195 70% 60% / 0.3)" : "none",
                      }}
                    >
                      <span style={{ fontSize: "var(--ec-text-sm)", fontWeight: 700 }}>
                        {opt.title}
                      </span>
                      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)", lineHeight: 1.4 }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p style={fieldHint}>
                В Client-режиме скрыты operator-инструменты (Доска задач, Дела/
                Файлы-табы, slash-hints) — клиент видит calm room, не developer
                chrome. Можно менять в любой момент.
              </p>
            </div>
          </section>

          {/* Brand color */}
          <section>
            <h3 style={sectionLabel}>Цвет акцента</h3>
            <div style={groupCard}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
                  gap: "var(--ec-space-2)",
                }}
              >
                {COLOR_PRESETS.map((p) => {
                  const active = brandColor.trim() === p.hsl;
                  return (
                    <button
                      key={p.hsl}
                      type="button"
                      onClick={() => {
                        setBrandColor(p.hsl);
                        applyPreview(p.hsl);
                      }}
                      title={p.name}
                      style={{
                        position: "relative",
                        height: 56,
                        borderRadius: "var(--ec-radius-md)",
                        background: p.demo,
                        border: active
                          ? "2px solid var(--ec-text-strong)"
                          : "1px solid var(--ec-border-default)",
                        cursor: "pointer",
                        transition: "transform var(--ec-dur-fast) var(--ec-ease), box-shadow var(--ec-dur-fast) var(--ec-ease)",
                        boxShadow: active
                          ? `0 0 0 1px ${p.demo}, 0 0 20px -2px ${p.demo}`
                          : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          bottom: 4,
                          left: 6,
                          right: 6,
                          fontSize: "0.55rem",
                          color: "#fff",
                          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom HSL sliders */}
              {parsed && (
                <div
                  style={{
                    background: "var(--ec-surface-1)",
                    border: "1px solid var(--ec-border-subtle)",
                    borderRadius: "var(--ec-radius-md)",
                    padding: "var(--ec-space-3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)" }}>
                    <span style={{ minWidth: 56 }}>Hue</span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={parsed.h}
                      onChange={(e) => {
                        const next = hslString(Number(e.target.value), parsed.s, parsed.l);
                        setBrandColor(next);
                        applyPreview(next);
                      }}
                      style={{ flex: 1, accentColor: "var(--ec-accent)" }}
                    />
                    <span style={{ minWidth: 32, textAlign: "right", fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>
                      {parsed.h}°
                    </span>
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)" }}>
                    <span style={{ minWidth: 56 }}>Sat</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={parsed.s}
                      onChange={(e) => {
                        const next = hslString(parsed.h, Number(e.target.value), parsed.l);
                        setBrandColor(next);
                        applyPreview(next);
                      }}
                      style={{ flex: 1, accentColor: "var(--ec-accent)" }}
                    />
                    <span style={{ minWidth: 32, textAlign: "right", fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>
                      {parsed.s}%
                    </span>
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)" }}>
                    <span style={{ minWidth: 56 }}>Light</span>
                    <input
                      type="range"
                      min={20}
                      max={90}
                      value={parsed.l}
                      onChange={(e) => {
                        const next = hslString(parsed.h, parsed.s, Number(e.target.value));
                        setBrandColor(next);
                        applyPreview(next);
                      }}
                      style={{ flex: 1, accentColor: "var(--ec-accent)" }}
                    />
                    <span style={{ minWidth: 32, textAlign: "right", fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>
                      {parsed.l}%
                    </span>
                  </label>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setBrandColor("");
                  document.documentElement.style.removeProperty("--ec-accent");
                }}
                disabled={!brandColor}
                className="ec-btn ec-btn--ghost ec-btn--sm"
                style={{ alignSelf: "flex-start" }}
              >
                Сбросить к стандартному
              </button>

              <p style={fieldHint}>
                Цвет применяется ко всем accent-элементам пока активно это пространство
                (кнопки, badges, focus rings, glow). Другие участники тоже увидят.
              </p>
            </div>
          </section>

          {/* Description */}
          <section style={{ marginTop: "var(--ec-space-4)" }}>
            <h3 style={sectionLabel}>Описание пространства</h3>
            <div style={groupCard}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="О чём это пространство. Что обсуждается. Кому подходит."
                style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
              />
              <p style={fieldHint}>
                Видно в Server Info всем участникам. До 1000 символов.
                <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
                  {description.length}/1000
                </span>
              </p>
            </div>
          </section>

          {/* Welcome message */}
          <section style={{ marginTop: "var(--ec-space-4)" }}>
            <h3 style={sectionLabel}>Приветствие новым участникам</h3>
            <div style={groupCard}>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Сообщение которое увидит новый участник при первом заходе."
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
              />
              <p style={fieldHint}>
                Показывается один раз в первой текстовой комнате пространства как
                dismissible welcome-card. До 500 символов.
                <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
                  {welcomeMessage.length}/500
                </span>
              </p>
            </div>
          </section>

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
            <button
              type="button"
              onClick={onClose}
              className="ec-btn ec-btn--ghost"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !nameValid}
              className="ec-btn ec-btn--primary"
            >
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
          </div>
        </>
      )}

      {tab === "banner" && (
        <section>
          <h3 style={sectionLabel}>Баннер пространства</h3>
          <div style={groupCard}>
            {server.banner ? (
              <div
                style={{
                  position: "relative",
                  borderRadius: "var(--ec-radius-lg)",
                  overflow: "hidden",
                  border: "1px solid var(--ec-border-default)",
                  aspectRatio: "3 / 1",
                  background: "var(--ec-surface-1)",
                }}
              >
                <img
                  src={resolveAssetUrl(server.banner) ?? ""}
                  alt="Server banner"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ) : (
              <div
                style={{
                  aspectRatio: "3 / 1",
                  borderRadius: "var(--ec-radius-lg)",
                  border: "1px dashed var(--ec-border-default)",
                  background:
                    "linear-gradient(135deg, var(--ec-surface-2), var(--ec-surface-3))",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--ec-text-muted)",
                  fontSize: "var(--ec-text-sm)",
                }}
              >
                Баннер не задан
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerSelect}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="ec-btn ec-btn--primary"
              >
                {uploading ? "Загружаем…" : server.banner ? "Сменить баннер" : "Загрузить баннер"}
              </button>
              {server.banner && (
                <button
                  type="button"
                  onClick={() => void onDeleteBanner()}
                  className="ec-btn ec-btn--danger"
                >
                  Удалить
                </button>
              )}
            </div>
            <p style={fieldHint}>
              1500×500, до 25 MB. Любой формат — конвертируем в webp. Показывается
              в шапке чата при пустой комнате и в Info modal.
            </p>
          </div>
        </section>
      )}

      {tab === "bots" && <BotsTab serverId={server.id} />}
    </Modal>
  );
}
