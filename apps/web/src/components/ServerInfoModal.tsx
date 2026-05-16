import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Avatar } from "./Avatar";
import type { MemberRole, MemberRow } from "../hooks/useMembers";
import type { ServerRow } from "../hooks/useServers";
import { resolveAssetUrl } from "../lib/assets";
import { Modal } from "./Modal";

type Props = {
  server: ServerRow;
  members?: MemberRow[];
  currentUserId?: string;
  onClose: () => void;
  onLeave: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onUploadIcon?: (file: File) => Promise<boolean>;
  onDeleteIcon?: () => Promise<boolean>;
  onUpdateRole?: (memberUserId: string, role: "ADMIN" | "MODERATOR" | "MEMBER") => Promise<boolean>;
  /** Кнопка «Оформление» — открывает ServerSettingsModal. Только OWNER. */
  onOpenSettings?: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

const iconSection: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-4)",
  padding: "var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
};

const iconBox: CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: "var(--ec-radius-lg)",
  background: "var(--ec-surface-3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  flexShrink: 0,
  color: "var(--ec-text-strong)",
  fontWeight: 600,
  fontSize: 24,
  border: "1px solid var(--ec-border-default)",
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

function buildInviteUrl(code: string): string {
  // ${origin}${BASE_URL}?invite=<code>. BASE_URL заканчивается /,
  // import.meta.env.BASE_URL=/eclipse-chat/ в prod → /eclipse-chat/?invite=...
  if (typeof window === "undefined") return `?invite=${code}`;
  return `${window.location.origin}${import.meta.env.BASE_URL}?invite=${encodeURIComponent(code)}`;
}

const memberRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-2) var(--ec-space-2)",
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

function roleBadgeClass(role: MemberRole | string): string {
  if (role === "OWNER") return "ec-badge ec-badge--owner";
  if (role === "ADMIN" || role === "MODERATOR") return "ec-badge ec-badge--accent";
  return "ec-badge";
}

export function ServerInfoModal({
  server,
  members,
  currentUserId,
  onClose,
  onLeave,
  onDelete,
  onUploadIcon,
  onDeleteIcon,
  onUpdateRole,
  onOpenSettings,
}: Props) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iconBusy, setIconBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isOwner = server.role === "OWNER";

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

  const inviteUrl = buildInviteUrl(server.inviteCode);

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(server.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      setError("Не удалось скопировать (clipboard недоступен)");
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
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
    else setError("Не удалось покинуть сервер. Если вы владелец — сначала удалите сервер.");
    setBusy(false);
  };

  const handleDelete = async () => {
    if (busy) return;
    if (!window.confirm(`Удалить сервер «${server.name}»? Это удалит все каналы и сообщения.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onDelete();
    if (ok) onClose();
    else setError("Не удалось удалить сервер");
    setBusy(false);
  };

  return (
    <Modal
      title={server.name}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn">
            Закрыть
          </button>
          {isOwner && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="ec-btn ec-btn--primary"
              title="Открыть настройки оформления"
            >
              ⚡ Оформление
            </button>
          )}
          {isOwner ? (
            <button type="button" onClick={() => void handleDelete()} disabled={busy} className="ec-btn ec-btn--danger">
              Удалить сервер
            </button>
          ) : (
            <button type="button" onClick={() => void handleLeave()} disabled={busy} className="ec-btn ec-btn--danger">
              Покинуть
            </button>
          )}
        </>
      }
    >
      {server.banner && (
        <div
          style={{
            position: "relative",
            margin: "calc(var(--ec-space-5) * -1) calc(var(--ec-space-5) * -1) var(--ec-space-4)",
            aspectRatio: "3 / 1",
            overflow: "hidden",
            borderBottom: "1px solid var(--ec-border-default)",
          }}
        >
          <img
            src={resolveAssetUrl(server.banner) ?? ""}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
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
      {server.description && (
        <p
          style={{
            margin: 0,
            color: "var(--ec-text-muted)",
            fontSize: "var(--ec-text-sm)",
            lineHeight: "var(--ec-leading-relaxed)",
            padding: "var(--ec-space-3) var(--ec-space-4)",
            background: "var(--ec-surface-2)",
            border: "1px solid var(--ec-border-subtle)",
            borderRadius: "var(--ec-radius-md)",
            whiteSpace: "pre-wrap",
          }}
        >
          {server.description}
        </p>
      )}
      <section style={iconSection}>
        <div style={iconBox} aria-hidden>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)", flex: 1 }}>
          {isOwner ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handleIconFile}
              />
              <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="ec-btn ec-btn--sm"
                  disabled={iconBusy}
                >
                  {server.icon ? "Заменить" : "Загрузить иконку"}
                </button>
                {server.icon && (
                  <button
                    type="button"
                    onClick={() => void handleIconDelete()}
                    className="ec-btn ec-btn--sm ec-btn--danger"
                    disabled={iconBusy}
                  >
                    Удалить
                  </button>
                )}
              </div>
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                JPEG / PNG / WebP · до 5 МБ · обрежется до 256×256
              </span>
            </>
          ) : (
            <span style={{ fontSize: "var(--ec-text-sm)", color: "var(--ec-text-muted)" }}>
              {server.icon ? "Иконку устанавливает владелец сервера." : "Без иконки."}
            </span>
          )}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: "var(--ec-space-2)" }}>
        <div style={stat}>
          <span style={statLabel}>Роль</span>
          <span style={statValue}>{server.role}</span>
        </div>
        <div style={stat}>
          <span style={statLabel}>Каналов</span>
          <span style={statValue}>{server.channelCount}</span>
        </div>
        <div style={stat}>
          <span style={statLabel}>Участников</span>
          <span style={statValue}>{server.memberCount}</span>
        </div>
      </div>

      {members && members.length > 0 && (
        <div>
          <label className="ec-field-label">Участники ({members.length})</label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: 220,
              overflowY: "auto",
              padding: "var(--ec-space-1) 0",
              border: "1px solid var(--ec-border-subtle)",
              borderRadius: "var(--ec-radius-md)",
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
                  {/* OWNER может менять roles на не-OWNER + не-себе */}
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
        </div>
      )}

      <div>
        <label className="ec-field-label">Инвайт-код</label>
        <div style={codeBox}>{server.inviteCode}</div>
        <div style={{ display: "flex", gap: "var(--ec-space-2)", marginTop: "var(--ec-space-2)" }}>
          <button
            type="button"
            onClick={() => void copyInviteCode()}
            className="ec-btn ec-btn--sm"
            style={{
              color: copiedCode ? "var(--ec-ok)" : undefined,
              borderColor: copiedCode ? "var(--ec-ok)" : undefined,
            }}
          >
            {copiedCode ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Код скопирован
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Код
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void copyInviteLink()}
            className="ec-btn ec-btn--sm ec-btn--primary"
            style={{
              background: copiedLink ? "var(--ec-ok)" : undefined,
              borderColor: copiedLink ? "var(--ec-ok)" : undefined,
            }}
            title={inviteUrl}
          >
            {copiedLink ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Ссылка скопирована
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                Ссылка-инвайт
              </>
            )}
          </button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: "var(--ec-text-xs)", color: "var(--ec-text-dim)" }}>
        Создан {new Date(server.createdAt).toLocaleDateString("ru-RU")}
      </p>

      {error && <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>{error}</p>}
    </Modal>
  );
}
