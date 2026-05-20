import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { BotsTab } from "./BotsTab";
import { DeleteButton } from "./DeleteButton";
import { Modal } from "./Modal";
import type { MemberRole, MemberRow } from "../hooks/useMembers";
import type { ServerRow } from "../hooks/useServers";
import { resolveAssetUrl } from "../lib/assets";

/**
 * ServerHubModal — v0.97 UX refactor.
 *
 * Объединяет старые ServerInfoModal (read-only обзор + invite + members +
 * leave/delete) и ServerSettingsModal (name/mode/brand/banner/desc/welcome
 * + bots config) в один tabbed Hub.
 *
 * 4 вкладки:
 *   - Обзор       — icon edit + name + role + stats + description preview
 *                    + member list compact + invite codes
 *   - Оформление  — banner + brand color picker (OWNER only)
 *   - Настройки   — name edit + mode + description edit + welcome (OWNER)
 *   - Боты        — BotsTab (OWNER + ADMIN)
 *
 * Footer: «Опасная зона» collapsible section с leave / delete buttons.
 *
 * Pavel-feedback 19.05: «надо сделать экран редактирования и настройки
 * сервера лучше» — старые модалки показывали raw description text без
 * структуры, два модала путало (Info → click «Оформление» → новый
 * модал). Теперь one stop shop.
 */

type Props = {
  server: ServerRow;
  members?: MemberRow[];
  currentUserId?: string;
  onClose: () => void;
  onLeave: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onUploadIcon?: (file: File) => Promise<boolean>;
  onDeleteIcon?: () => Promise<boolean>;
  onUpdateRole?: (
    memberUserId: string,
    role: "ADMIN" | "MODERATOR" | "MEMBER",
  ) => Promise<boolean>;
  onUploadBanner: (file: File) => Promise<boolean>;
  onDeleteBanner: () => Promise<boolean>;
  onUpdateIdentity: (patch: {
    name?: string;
    brandColor?: string | null;
    description?: string | null;
    welcomeMessage?: string | null;
    mode?: "ENGINEERING" | "CLIENT";
  }) => Promise<boolean>;
  /** v0.97: open tab напрямую (если триггер — settings icon → Настройки). */
  initialTab?: HubTab;
};

type HubTab = "overview" | "branding" | "settings" | "bots";

const COLOR_PRESETS: { name: string; hsl: string }[] = [
  { name: "Cool sky", hsl: "195 70% 60%" },
  { name: "Teal mint", hsl: "168 60% 58%" },
  { name: "Electric violet", hsl: "252 70% 70%" },
  { name: "Plasma pink", hsl: "320 75% 68%" },
  { name: "Azure", hsl: "215 80% 68%" },
  { name: "Lime", hsl: "85 60% 62%" },
  { name: "Amber", hsl: "38 90% 60%" },
  { name: "Coral", hsl: "12 85% 65%" },
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

function buildInviteUrl(code: string): string {
  if (typeof window === "undefined") return `?invite=${code}`;
  return `${window.location.origin}${import.meta.env.BASE_URL}?invite=${encodeURIComponent(code)}`;
}

function roleBadgeClass(role: MemberRole | string): string {
  if (role === "OWNER") return "ec-badge ec-badge--owner";
  if (role === "ADMIN" || role === "MODERATOR") return "ec-badge ec-badge--accent";
  return "ec-badge";
}

const tabBar: CSSProperties = {
  display: "flex",
  gap: 4,
  padding: 4,
  background: "var(--ec-surface-1)",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-subtle)",
  marginBottom: "var(--ec-space-4)",
};

function tabBtn(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "0.55rem 0.8rem",
    borderRadius: "var(--ec-radius-sm)",
    background: active ? "var(--ec-accent)" : "transparent",
    color: active ? "var(--ec-accent-text)" : "var(--ec-text-muted)",
    border: 0,
    cursor: "pointer",
    fontSize: "var(--ec-text-sm)",
    fontWeight: 600,
    letterSpacing: "var(--ec-tracking-wide)",
    transition: "all var(--ec-dur-fast) var(--ec-ease)",
    boxShadow: active
      ? "0 0 0 1px var(--ec-accent), 0 0 12px -2px hsl(195 70% 60% / 0.4)"
      : "none",
  };
}

const sectionCard: CSSProperties = {
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  padding: "var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const sectionLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  margin: "0 0 var(--ec-space-2)",
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

const stat: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
};

const statLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
  fontWeight: 600,
};

const statValue: CSSProperties = {
  fontSize: "var(--ec-text-md)",
  fontWeight: 600,
  color: "var(--ec-text-strong)",
  fontFeatureSettings: '"tnum"',
};

const codeBox: CSSProperties = {
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-input-bg)",
  color: "var(--ec-text)",
  fontFamily: "var(--ec-font-mono)",
  fontSize: "var(--ec-text-sm)",
  wordBreak: "break-all",
};

const memberRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-2)",
  borderRadius: "var(--ec-radius-sm)",
};

const roleSelect: CSSProperties = {
  background: "var(--ec-surface-3)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-sm)",
  padding: "0.2rem 0.4rem",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "var(--ec-tracking-wide)",
  cursor: "pointer",
};

export function ServerHubModal({
  server,
  members,
  currentUserId,
  onClose,
  onLeave,
  onDelete,
  onUploadIcon,
  onDeleteIcon,
  onUpdateRole,
  onUploadBanner,
  onDeleteBanner,
  onUpdateIdentity,
  initialTab = "overview",
}: Props) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const isOwner = server.role === "OWNER";
  const isAdminOrOwner = isOwner || server.role === "ADMIN";

  // Edit form state (Настройки tab).
  const [name, setName] = useState(server.name);
  const [mode, setMode] = useState<"ENGINEERING" | "CLIENT">(server.mode ?? "ENGINEERING");
  const [brandColor, setBrandColor] = useState(server.brandColor ?? "");
  const [description, setDescription] = useState(server.description ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(server.welcomeMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Misc state.
  const [iconBusy, setIconBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [copyState, setCopyState] = useState<"code" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const iconFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 80;
  const parsed = parseHsl(brandColor);
  const inviteUrl = buildInviteUrl(server.inviteCode);

  const applyBrandPreview = (hsl: string) => {
    if (/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(hsl)) {
      document.documentElement.style.setProperty("--ec-accent", `hsl(${hsl})`);
    }
  };

  const handleSaveIdentity = async () => {
    if (!nameValid) return;
    setSaving(true);
    setError(null);
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
      } else {
        setError("Не удалось сохранить настройки");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleIconFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadIcon) return;
    setIconBusy(true);
    setError(null);
    const ok = await onUploadIcon(file);
    if (!ok) setError("Не удалось загрузить иконку");
    setIconBusy(false);
  };

  const handleIconDelete = async () => {
    if (!onDeleteIcon) return;
    setIconBusy(true);
    setError(null);
    const ok = await onDeleteIcon();
    if (!ok) setError("Не удалось удалить иконку");
    setIconBusy(false);
  };

  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBannerBusy(true);
    setError(null);
    const ok = await onUploadBanner(file);
    if (!ok) setError("Не удалось загрузить баннер");
    setBannerBusy(false);
  };

  const handleBannerDelete = async () => {
    setBannerBusy(true);
    setError(null);
    const ok = await onDeleteBanner();
    if (!ok) setError("Не удалось удалить баннер");
    setBannerBusy(false);
  };

  const copy = async (text: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(which);
      setTimeout(() => setCopyState(null), 1500);
    } catch {
      setError("Не удалось скопировать (clipboard недоступен)");
    }
  };

  const handleLeave = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await onLeave();
    if (ok) onClose();
    else setError("Не удалось покинуть пространство. Если вы владелец — сначала удалите его.");
    setBusy(false);
  };

  // confirm() — внутри DeleteButton (см. confirmMessage ниже).
  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await onDelete();
    if (ok) onClose();
    else setError("Не удалось удалить пространство");
    setBusy(false);
  };

  // Доступные tabs зависят от role. Non-owner видит Обзор + Боты (если ADMIN).
  const availableTabs: { id: HubTab; label: string; hidden?: boolean }[] = [
    { id: "overview", label: "Обзор" },
    { id: "branding", label: "Оформление", hidden: !isOwner },
    { id: "settings", label: "Настройки", hidden: !isOwner },
    { id: "bots", label: "Боты", hidden: !isAdminOrOwner },
  ];
  const visibleTabs = availableTabs.filter((t) => !t.hidden);

  return (
    <Modal title={server.name} onClose={onClose} width={620}>
      <div
        style={tabBar}
        className="ec-server-hub__tabs"
        role="tablist"
        aria-label="Разделы пространства"
      >
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={tabBtn(tab === t.id)}
            className="ec-hud-tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === Обзор === */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-4)" }}>
          {server.banner && (
            <div
              style={{
                position: "relative",
                aspectRatio: "3 / 1",
                overflow: "hidden",
                borderRadius: "var(--ec-radius-lg)",
                border: "1px solid var(--ec-border-subtle)",
              }}
            >
              <img
                src={resolveAssetUrl(server.banner) ?? ""}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, transparent 40%, hsl(210 22% 4% / 0.85) 100%)",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}

          {/* Icon + identity */}
          <section style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-4)" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "var(--ec-radius-lg)",
                  background: "var(--ec-surface-3)",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                  color: "var(--ec-text-strong)",
                  fontWeight: 600,
                  fontSize: 24,
                  border: "1px solid var(--ec-border-default)",
                }}
              >
                {server.icon ? (
                  <img
                    src={resolveAssetUrl(server.icon) ?? ""}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span>{initials(server.name)}</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)", flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--ec-text-lg)", fontWeight: 700, color: "var(--ec-text-strong)" }}>
                    {server.name}
                  </span>
                  <span className={roleBadgeClass(server.role)}>{server.role}</span>
                </div>
                {isOwner && onUploadIcon && (
                  <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
                    <input
                      ref={iconFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: "none" }}
                      onChange={handleIconFile}
                    />
                    <button
                      type="button"
                      onClick={() => iconFileRef.current?.click()}
                      className="ec-btn ec-btn--ghost ec-btn--sm"
                      disabled={iconBusy}
                    >
                      {server.icon ? "Сменить иконку" : "Загрузить иконку"}
                    </button>
                    {server.icon && onDeleteIcon && (
                      <button
                        type="button"
                        onClick={() => void handleIconDelete()}
                        className="ec-btn ec-btn--ghost ec-btn--sm"
                        disabled={iconBusy}
                      >
                        Убрать
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: "var(--ec-space-2)" }}>
            <div style={stat}>
              <span style={statLabel}>Комнат</span>
              <span style={statValue}>{server.channelCount}</span>
            </div>
            <div style={stat}>
              <span style={statLabel}>Участников</span>
              <span style={statValue}>{server.memberCount}</span>
            </div>
            <div style={stat}>
              <span style={statLabel}>Создан</span>
              <span style={{ ...statValue, fontSize: "var(--ec-text-sm)" }}>
                {new Date(server.createdAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Description preview */}
          {server.description && (
            <section>
              <h3 style={sectionLabel}>Описание</h3>
              <div style={{ ...sectionCard, gap: 0 }}>
                <p
                  style={{
                    margin: 0,
                    color: "var(--ec-text)",
                    fontSize: "var(--ec-text-sm)",
                    lineHeight: "var(--ec-leading-relaxed)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {server.description}
                </p>
              </div>
            </section>
          )}

          {/* Invite */}
          <section>
            <h3 style={sectionLabel}>Приглашение</h3>
            <div style={sectionCard}>
              <div style={codeBox}>{server.inviteCode}</div>
              <div style={{ display: "flex", gap: "var(--ec-space-2)", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void copy(server.inviteCode, "code")}
                  className="ec-btn ec-btn--sm"
                  style={{
                    color: copyState === "code" ? "var(--ec-ok)" : undefined,
                    borderColor: copyState === "code" ? "var(--ec-ok)" : undefined,
                  }}
                >
                  {copyState === "code" ? "✓ Код скопирован" : "Копировать код"}
                </button>
                <button
                  type="button"
                  onClick={() => void copy(inviteUrl, "link")}
                  className="ec-btn ec-btn--sm ec-btn--primary"
                  title={inviteUrl}
                  style={{
                    background: copyState === "link" ? "var(--ec-ok)" : undefined,
                    borderColor: copyState === "link" ? "var(--ec-ok)" : undefined,
                  }}
                >
                  {copyState === "link" ? "✓ Ссылка скопирована" : "Копировать ссылку"}
                </button>
              </div>
            </div>
          </section>

          {/* Members compact */}
          {members && members.length > 0 && (
            <section>
              <h3 style={sectionLabel}>Участники · {members.length}</h3>
              <div
                style={{
                  ...sectionCard,
                  padding: "var(--ec-space-2)",
                  maxHeight: 260,
                  overflowY: "auto",
                  gap: 2,
                }}
              >
                {members.map((m) => {
                  const isMe = currentUserId === m.userId;
                  const isOwnerRow = m.role === "OWNER";
                  return (
                    <div key={m.id} style={memberRowStyle}>
                      <Avatar url={m.user.avatar} name={m.user.displayName} size={28} />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--ec-text)",
                        }}
                      >
                        {m.user.displayName}
                        {isMe && (
                          <span style={{ marginLeft: 6, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
                            (вы)
                          </span>
                        )}
                      </span>
                      {isOwner && !isOwnerRow && !isMe && onUpdateRole ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            void onUpdateRole(
                              m.userId,
                              e.target.value as "ADMIN" | "MODERATOR" | "MEMBER",
                            )
                          }
                          style={roleSelect}
                          title="Изменить роль"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MODERATOR">MOD</option>
                          <option value="MEMBER">MEMBER</option>
                        </select>
                      ) : (
                        <span className={roleBadgeClass(m.role)} style={{ fontSize: "0.6rem" }}>
                          {m.role === "MODERATOR" ? "MOD" : m.role}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* === Оформление === */}
      {tab === "branding" && isOwner && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-4)" }}>
          {/* Banner */}
          <section>
            <h3 style={sectionLabel}>Баннер</h3>
            <div style={sectionCard}>
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
              <div style={{ display: "flex", gap: "var(--ec-space-2)", flexWrap: "wrap" }}>
                <input
                  ref={bannerFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerFile}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={bannerBusy}
                  className="ec-btn ec-btn--primary ec-btn--sm"
                >
                  {bannerBusy ? "Загружаем…" : server.banner ? "Сменить баннер" : "Загрузить баннер"}
                </button>
                {server.banner && (
                  <button
                    type="button"
                    onClick={() => void handleBannerDelete()}
                    className="ec-btn ec-btn--ghost ec-btn--sm"
                  >
                    Удалить
                  </button>
                )}
              </div>
              <p style={fieldHint}>
                1500×500, до 25 MB. Конвертируется в webp. Показывается в шапке
                чата при пустой комнате и в Обзоре пространства.
              </p>
            </div>
          </section>

          {/* Brand color */}
          <section>
            <h3 style={sectionLabel}>Цвет акцента</h3>
            <div style={sectionCard}>
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
                        applyBrandPreview(p.hsl);
                      }}
                      title={p.name}
                      style={{
                        position: "relative",
                        height: 56,
                        borderRadius: "var(--ec-radius-md)",
                        background: `hsl(${p.hsl})`,
                        border: active
                          ? "2px solid var(--ec-text-strong)"
                          : "1px solid var(--ec-border-default)",
                        cursor: "pointer",
                        transition: "transform var(--ec-dur-fast) var(--ec-ease)",
                        boxShadow: active
                          ? `0 0 0 1px hsl(${p.hsl}), 0 0 20px -2px hsl(${p.hsl})`
                          : "none",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          bottom: 4,
                          left: 6,
                          right: 6,
                          fontSize: "0.55rem",
                          color: "var(--ec-accent-text)",
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
                  {(["h", "s", "l"] as const).map((k) => {
                    const max = k === "h" ? 360 : k === "l" ? 90 : 100;
                    const min = k === "l" ? 20 : 0;
                    const v = parsed[k];
                    const label = k === "h" ? "Hue" : k === "s" ? "Sat" : "Light";
                    const suffix = k === "h" ? "°" : "%";
                    return (
                      <label
                        key={k}
                        style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)" }}
                      >
                        <span style={{ minWidth: 56 }}>{label}</span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={v}
                          onChange={(e) => {
                            const next = { ...parsed, [k]: Number(e.target.value) };
                            const hsl = hslString(next.h, next.s, next.l);
                            setBrandColor(hsl);
                            applyBrandPreview(hsl);
                          }}
                          style={{ flex: 1, accentColor: "var(--ec-accent)" }}
                        />
                        <span style={{ minWidth: 32, textAlign: "right", fontFamily: "var(--ec-font-mono)", color: "var(--ec-text)" }}>
                          {v}{suffix}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setBrandColor("");
                    document.documentElement.style.removeProperty("--ec-accent");
                  }}
                  disabled={!brandColor}
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                >
                  Сбросить
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveIdentity()}
                  disabled={saving || !nameValid}
                  className="ec-btn ec-btn--primary ec-btn--sm"
                >
                  {saving ? "Сохраняем…" : savedFlash ? "✓ Сохранено" : "Сохранить цвет"}
                </button>
              </div>
              <p style={fieldHint}>
                Цвет применяется к accent-элементам (кнопки, badges, focus rings,
                glow) для всех участников пространства.
              </p>
            </div>
          </section>
        </div>
      )}

      {/* === Настройки === */}
      {tab === "settings" && isOwner && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-4)" }}>
          <section>
            <h3 style={sectionLabel}>Название пространства</h3>
            <div style={sectionCard}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Название пространства"
                style={{
                  ...inputStyle,
                  borderColor: nameValid ? "var(--ec-border-default)" : "var(--ec-danger)",
                }}
              />
              <p style={fieldHint}>
                Видно всем участникам в списке пространств и в шапке. 1–80 символов.
                <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
                  {trimmedName.length}/80
                </span>
              </p>
            </div>
          </section>

          <section>
            <h3 style={sectionLabel}>Режим работы</h3>
            <div style={sectionCard}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ec-space-2)" }}>
                {([
                  {
                    id: "ENGINEERING" as const,
                    title: "Engineering",
                    desc: "Полный operator-инструментарий — Status Board, slash-commands, сводки. Для внутренних команд.",
                  },
                  {
                    id: "CLIENT" as const,
                    title: "Client",
                    desc: "Calm portal — без developer-chrome, focus на approvals / files / summaries. Для клиентских проектов.",
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
                        boxShadow: active
                          ? "0 0 0 1px var(--ec-accent), 0 0 14px -2px hsl(195 70% 60% / 0.3)"
                          : "none",
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
                В Client-режиме скрыты operator-инструменты (Доска задач, slash-hints).
                Менять можно в любой момент.
              </p>
            </div>
          </section>

          <section>
            <h3 style={sectionLabel}>Описание</h3>
            <div style={sectionCard}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={6}
                placeholder="О чём это пространство. Что обсуждается. Кому подходит."
                style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
              />
              <p style={fieldHint}>
                Видно в «Обзоре» всем участникам. До 1000 символов.
                <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
                  {description.length}/1000
                </span>
              </p>
            </div>
          </section>

          <section>
            <h3 style={sectionLabel}>Приветствие новым участникам</h3>
            <div style={sectionCard}>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Сообщение которое увидит новый участник при первом заходе."
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
              />
              <p style={fieldHint}>
                Показывается один раз в первой текстовой комнате как dismissible
                welcome-card. До 500 символов.
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
              alignItems: "center",
            }}
          >
            {savedFlash && (
              <span style={{ color: "var(--ec-ok)", fontSize: "var(--ec-text-2xs)", marginRight: "auto" }}>
                ✓ Сохранено
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleSaveIdentity()}
              disabled={saving || !nameValid}
              className="ec-btn ec-btn--primary"
            >
              {saving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          </div>
        </div>
      )}

      {/* === Боты === */}
      {tab === "bots" && isAdminOrOwner && <BotsTab serverId={server.id} />}

      {/* === Footer: Опасная зона === */}
      <div
        style={{
          marginTop: "var(--ec-space-4)",
          paddingTop: "var(--ec-space-3)",
          borderTop: "1px solid var(--ec-border-subtle)",
        }}
      >
        <button
          type="button"
          onClick={() => setDangerOpen((v) => !v)}
          aria-expanded={dangerOpen}
          style={{
            background: "transparent",
            border: 0,
            padding: "var(--ec-space-1) 0",
            color: "var(--ec-text-dim)",
            cursor: "pointer",
            fontSize: "var(--ec-text-2xs)",
            fontWeight: 600,
            letterSpacing: "var(--ec-tracking-caps)",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden
            style={{ transform: dangerOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform var(--ec-dur-fast)" }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Опасная зона
        </button>

        {dangerOpen && (
          <div
            style={{
              marginTop: "var(--ec-space-2)",
              padding: "var(--ec-space-3)",
              borderRadius: "var(--ec-radius-md)",
              border: "1px solid var(--ec-danger)",
              background: "var(--ec-danger-soft)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--ec-space-2)",
            }}
          >
            <p style={{ margin: 0, color: "var(--ec-text)", fontSize: "var(--ec-text-sm)", lineHeight: 1.5 }}>
              {isOwner
                ? "Удаление пространства необратимо: все комнаты, сообщения, файлы, задачи будут потеряны навсегда."
                : "Покидание удалит ваш доступ к пространству. Вы сможете вернуться только через новое приглашение."}
            </p>
            <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
              {isOwner ? (
                <DeleteButton
                  label="Удалить"
                  confirmMessage={`Удалить пространство «${server.name}»? Это удалит все комнаты и сообщения. Действие необратимо.`}
                  onDelete={handleDelete}
                  disabled={busy}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => void handleLeave()}
                  disabled={busy}
                  className="ec-btn ec-btn--danger"
                >
                  Покинуть пространство
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p
          style={{
            margin: "var(--ec-space-3) 0 0",
            padding: "var(--ec-space-2) var(--ec-space-3)",
            color: "var(--ec-danger)",
            background: "var(--ec-danger-soft)",
            borderRadius: "var(--ec-radius-md)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          {error}
        </p>
      )}
    </Modal>
  );
}
