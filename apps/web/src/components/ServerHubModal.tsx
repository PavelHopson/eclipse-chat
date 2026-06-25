import { useRef, useState, type CSSProperties } from "react";
import { AdminEmojisTab } from "./AdminEmojisTab";
import { BotsTab } from "./BotsTab";
import { DeleteButton } from "./DeleteButton";
import { Modal } from "./Modal";
import { ServerWelcomeHero } from "./ServerWelcomeHero";
import {
  InviteSection,
  IsolationSection,
  MembersSection,
  RolesSection,
} from "./server-hub/ServerHubSections";
import { ServerAuditLogSection } from "./server-hub/ServerAuditLogSection";
import type { MemberRole, MemberRow } from "../hooks/useMembers";
import type { ServerRow } from "../hooks/useServers";
import type { ChannelRow } from "../hooks/useChannels";
import { resolveAssetUrl } from "../lib/assets";
import { serverBannerGradient } from "../lib/serverBanner";
import {
  cleanServerFeatures,
  encodeServerFeatures,
  MAX_SERVER_FEATURES,
  MAX_SERVER_FEATURE_LENGTH,
  parseServerFeatures,
} from "../lib/serverFeatures";

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
  channels?: ChannelRow[];
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
    features?: string[] | null;
    mode?: "ENGINEERING" | "CLIENT";
  }) => Promise<boolean>;
  onUpdateLock?: (locked: boolean, reason?: string | null) => Promise<boolean>;
  /** v0.97: open tab напрямую (если триггер — settings icon → Настройки). */
  initialTab?: HubView;
};

type HubView =
  | "overview"
  | "branding"
  | "settings"
  | "emojis"
  | "roles"
  | "members"
  | "bots"
  | "isolation"
  | "audit"
  | "invite";

type NavGroup = {
  label: string;
  items: Array<{ id: HubView; label: string; hidden?: boolean; soon?: boolean }>;
};

// Пресеты ограничены identity-палитрой (design-brief-v2 §2). Каждый
// пресет задаёт серверу --ec-accent — это PRIMARY-акцент, поэтому
// допустимы только violet-семья, gold и холодные/нейтральные тона.
// Запрещены: cyan/teal как primary, warm orange, тропический неон
// (acid green, hot pink). Раньше здесь были Cool sky / Teal mint /
// Amber / Coral / Plasma pink / Lime — прямой откат identity. Не
// возвращать: список — часть контракта визуального языка.
const COLOR_PRESETS: { name: string; hsl: string }[] = [
  { name: "Затмение", hsl: "258 90% 66%" },
  { name: "Аметист", hsl: "272 60% 64%" },
  { name: "Индиго", hsl: "236 56% 66%" },
  { name: "Лазурь", hsl: "212 60% 62%" },
  { name: "Золото", hsl: "46 65% 52%" },
  { name: "Сталь", hsl: "216 20% 56%" },
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

// v1.1.96 slice 7: inline-style консоли ServerHubModal вынесены в
// классы .ec-hub-* (components.css). JS-hover в компоненте не было.

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
  onUpdateLock,
  channels = [],
  initialTab = "overview",
}: Props) {
  const [active, setActive] = useState<HubView>(initialTab);
  const isOwner = server.role === "OWNER";
  const isAdminOrOwner = isOwner || server.role === "ADMIN";

  // Edit form state (Настройки tab).
  const [name, setName] = useState(server.name);
  const [mode, setMode] = useState<"ENGINEERING" | "CLIENT">(server.mode ?? "ENGINEERING");
  const [brandColor, setBrandColor] = useState(server.brandColor ?? "");
  const [description, setDescription] = useState(server.description ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(server.welcomeMessage ?? "");
  const [features, setFeatures] = useState<string[]>(() => {
    const parsed = parseServerFeatures(server.features);
    return parsed.length > 0 ? parsed : [""];
  });
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Misc state.
  const [iconBusy, setIconBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [copyState, setCopyState] = useState<"code" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockReason, setLockReason] = useState(server.lockedReason ?? "");
  const [lockBusy, setLockBusy] = useState(false);

  const iconFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 80;
  const parsed = parseHsl(brandColor);
  const inviteUrl = buildInviteUrl(server.inviteCode);
  const cleanedFeatures = cleanServerFeatures(features);

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
        features: cleanedFeatures.length > 0 ? cleanedFeatures : null,
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

  const handleLock = async (locked: boolean) => {
    if (!onUpdateLock || lockBusy) return;
    setLockBusy(true);
    setError(null);
    const ok = await onUpdateLock(locked, locked ? lockReason : null);
    if (!ok) setError(locked ? "Не удалось включить изоляцию" : "Не удалось снять изоляцию");
    setLockBusy(false);
  };

  const updateFeature = (index: number, value: string) => {
    setFeatures((prev) =>
      prev.map((feature, i) =>
        i === index ? value.slice(0, MAX_SERVER_FEATURE_LENGTH) : feature,
      ),
    );
  };

  const addFeature = () => {
    setFeatures((prev) => (prev.length >= MAX_SERVER_FEATURES ? prev : [...prev, ""]));
  };

  const removeFeature = (index: number) => {
    setFeatures((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
  };

  const navGroups: NavGroup[] = [
    {
      label: "Сервер",
      items: [
        { id: "overview", label: "Обзор" },
        { id: "branding", label: "Оформление", hidden: !isOwner },
        { id: "settings", label: "Настройки", hidden: !isOwner },
      ],
    },
    { label: "Реакции", items: [{ id: "emojis", label: "Эмодзи", hidden: !isAdminOrOwner }] },
    {
      label: "Люди",
      items: [
        { id: "roles", label: "Роли", hidden: !isAdminOrOwner },
        { id: "members", label: "Участники" },
      ],
    },
    { label: "Приложения", items: [{ id: "bots", label: "Боты", hidden: !isAdminOrOwner }] },
    {
      label: "Модерация",
      items: [
        { id: "isolation", label: "Изоляция", hidden: !isAdminOrOwner },
        { id: "audit", label: "Audit log", hidden: !isAdminOrOwner },
      ],
    },
    { label: "Сообщество", items: [{ id: "invite", label: "Приглашение" }] },
  ];
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden) }))
    .filter((group) => group.items.length > 0);

  return (
    <Modal title={server.name} onClose={onClose} width={980}>
      <div className="ec-server-hub-panel">
        <aside className="ec-server-hub-tree-nav" aria-label="Разделы настроек сервера">
          {visibleGroups.map((group) => (
            <section key={group.label} className="ec-server-hub-tree-nav__group">
              <span className="ec-server-hub-tree-nav__label">{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    "ec-server-hub-category-item" +
                    (active === item.id ? " ec-server-hub-category-item--active" : "")
                  }
                  aria-current={active === item.id ? "page" : undefined}
                  onClick={() => setActive(item.id)}
                >
                  <span>{item.label}</span>
                  {item.soon && <span className="ec-server-hub-category-item__soon">Скоро</span>}
                </button>
              ))}
            </section>
          ))}
        </aside>
        <main className="ec-server-hub-panel__main">

      {/* === Обзор === */}
      {active === "overview" && (
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
          <section className="ec-hub-card">
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
            <div className="ec-hub-stat">
              <span className="ec-hub-stat__label">Комнат</span>
              <span className="ec-hub-stat__value">{server.channelCount}</span>
            </div>
            <div className="ec-hub-stat">
              <span className="ec-hub-stat__label">Участников</span>
              <span className="ec-hub-stat__value">{server.memberCount}</span>
            </div>
            <div className="ec-hub-stat">
              <span className="ec-hub-stat__label">Создан</span>
              <span className="ec-hub-stat__value" style={{ fontSize: "var(--ec-text-sm)" }}>
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
              <h3 className="ec-hub-label">Описание</h3>
              <div className="ec-hub-card" style={{ gap: 0 }}>
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

        </div>
      )}

      {/* === Оформление === */}
      {active === "branding" && isOwner && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-4)" }}>
          {/* Banner */}
          <section>
            <h3 className="ec-hub-label">Баннер</h3>
            <div className="ec-hub-card">
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
                    position: "relative",
                    aspectRatio: "3 / 1",
                    borderRadius: "var(--ec-radius-lg)",
                    border: "1px solid var(--ec-border-default)",
                    overflow: "hidden",
                    backgroundImage: serverBannerGradient({
                      id: server.id,
                      brandColor: brandColor.trim() || null,
                    }),
                    backgroundSize: "cover",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <span
                    style={{
                      padding: "var(--ec-space-1) var(--ec-space-3)",
                      borderRadius: "999px",
                      background: "var(--ec-overlay-bg)",
                      color: "var(--ec-text-strong)",
                      fontSize: "var(--ec-text-sm)",
                    }}
                  >
                    Авто-градиент — нет изображения
                  </span>
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
              <p className="ec-hub-hint">
                1500×500, до 25 MB. Конвертируется в webp. Показывается в шапке
                чата при пустой комнате и в Обзоре пространства. Без изображения
                сервер показывает авто-градиент по цвету акцента.
              </p>
            </div>
          </section>

          {/* Brand color */}
          <section>
            <h3 className="ec-hub-label">Цвет акцента</h3>
            <div className="ec-hub-card">
              <div className="ec-hub-swatch-grid">
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
                      aria-pressed={active}
                      className="ec-hub-swatch"
                      style={{ "--sw": `hsl(${p.hsl})` } as CSSProperties}
                    >
                      <span className="ec-hub-swatch__name">{p.name}</span>
                    </button>
                  );
                })}
              </div>

              {parsed && (
                <div className="ec-hub-hsl">
                  {(["h", "s", "l"] as const).map((k) => {
                    const max = k === "h" ? 360 : k === "l" ? 90 : 100;
                    const min = k === "l" ? 20 : 0;
                    const v = parsed[k];
                    const label = k === "h" ? "Hue" : k === "s" ? "Sat" : "Light";
                    const suffix = k === "h" ? "°" : "%";
                    return (
                      <label key={k} className="ec-hub-hsl__row">
                        <span className="ec-hub-hsl__label">{label}</span>
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
                          className="ec-hub-hsl__range"
                        />
                        <span className="ec-hub-hsl__value">
                          {v}{suffix}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="ec-hub-actions">
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
              <p className="ec-hub-hint">
                Цвет применяется к accent-элементам (кнопки, badges, focus rings,
                glow) для всех участников пространства.
              </p>
            </div>
          </section>
        </div>
      )}

      {/* === Настройки === */}
      {active === "settings" && isOwner && (
        <div className="ec-hub-settings-layout">
          <div className="ec-hub-settings-form">
          <section>
            <h3 className="ec-hub-label">Название пространства</h3>
            <div className="ec-hub-card">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Название пространства"
                className="ec-hub-input"
                style={nameValid ? undefined : { borderColor: "var(--ec-danger)" }}
              />
              <p className="ec-hub-hint">
                Видно всем участникам в списке пространств и в шапке. 1–80 символов.
                <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
                  {trimmedName.length}/80
                </span>
              </p>
            </div>
          </section>

          <section>
            <h3 className="ec-hub-label">Режим работы</h3>
            <div className="ec-hub-card">
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
                        boxShadow: active ? "0 0 0 1px var(--ec-accent)" : "none",
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
              <p className="ec-hub-hint">
                В Client-режиме скрыты operator-инструменты (Доска задач, slash-hints).
                Менять можно в любой момент.
              </p>
            </div>
          </section>

          <section>
            <h3 className="ec-hub-label">Описание</h3>
            <div className="ec-hub-card">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={6}
                placeholder="О чём это пространство. Что обсуждается. Кому подходит."
                className="ec-hub-input"
                style={{ resize: "vertical", minHeight: 120 }}
              />
              <p className="ec-hub-hint">
                Видно в «Обзоре» всем участникам. До 1000 символов.
                <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
                  {description.length}/1000
                </span>
              </p>
            </div>
          </section>

          <section>
            <h3 className="ec-hub-label">Ключевые особенности</h3>
            <div className="ec-hub-card">
              <div className="ec-hub-feature-editor">
                {features.map((feature, index) => (
                  <div key={index} className="ec-hub-feature-row">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      maxLength={MAX_SERVER_FEATURE_LENGTH}
                      placeholder={index === 0 ? "Например: строгие правила" : "Ещё тезис"}
                      className="ec-hub-input ec-hub-feature-input"
                    />
                    <span className="ec-hub-feature-count">
                      {feature.trim().length}/{MAX_SERVER_FEATURE_LENGTH}
                    </span>
                    <button
                      type="button"
                      className="ec-hub-feature-remove"
                      onClick={() => removeFeature(index)}
                      aria-label="Удалить особенность"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="ec-hub-actions">
                <p className="ec-hub-hint">
                  До {MAX_SERVER_FEATURES} коротких тезисов. Показываются чипами в путеводителе.
                </p>
                <button
                  type="button"
                  onClick={addFeature}
                  disabled={features.length >= MAX_SERVER_FEATURES}
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                >
                  + Добавить
                </button>
              </div>
            </div>
          </section>

          <section>
            <h3 className="ec-hub-label">Приветствие новым участникам</h3>
            <div className="ec-hub-card">
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Сообщение которое увидит новый участник при первом заходе."
                className="ec-hub-input"
                style={{ resize: "vertical", minHeight: 80 }}
              />
              <p className="ec-hub-hint">
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
          <aside className="ec-hub-preview-card" aria-label="Предпросмотр путеводителя">
            <span className="ec-hub-label">Предпросмотр</span>
            <ServerWelcomeHero
              server={{
                ...server,
                name: trimmedName || server.name,
                description: description.trim() || null,
                welcomeMessage: welcomeMessage.trim() || null,
                features: encodeServerFeatures(features),
                brandColor: brandColor.trim() || null,
                mode,
              }}
              channels={channels}
              onSelectChannel={() => undefined}
            />
          </aside>
        </div>
      )}

      {/* === Боты === */}
      {active === "emojis" && isAdminOrOwner && <AdminEmojisTab serverId={server.id} />}

      {active === "roles" && isAdminOrOwner && <RolesSection members={members} />}

      {active === "members" && (
        <MembersSection
          members={members}
          currentUserId={currentUserId}
          isOwner={isOwner}
          onUpdateRole={onUpdateRole}
        />
      )}

      {active === "isolation" && isAdminOrOwner && (
        <IsolationSection
          server={server}
          lockReason={lockReason}
          lockBusy={lockBusy}
          canUpdate={Boolean(onUpdateLock)}
          onReason={setLockReason}
          onLock={() => void handleLock(true)}
          onUnlock={() => void handleLock(false)}
        />
      )}

      {active === "audit" && isAdminOrOwner && (
        <ServerAuditLogSection serverId={server.id} members={members} />
      )}

      {active === "invite" && (
        <InviteSection
          inviteCode={server.inviteCode}
          inviteUrl={inviteUrl}
          copyState={copyState}
          onCopy={(text, which) => void copy(text, which)}
        />
      )}

      {active === "bots" && isAdminOrOwner && <BotsTab serverId={server.id} />}

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
        </main>
      </div>
    </Modal>
  );
}
