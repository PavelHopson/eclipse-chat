import { Avatar } from "../Avatar";
import type { MemberRole, MemberRow } from "../../hooks/useMembers";
import type { ServerRow } from "../../hooks/useServers";

function roleBadgeClass(role: MemberRole | string): string {
  if (role === "OWNER") return "ec-badge ec-badge--owner";
  if (role === "ADMIN" || role === "MODERATOR") return "ec-badge ec-badge--accent";
  return "ec-badge";
}

export function RolesSection({ members }: { members?: MemberRow[] }) {
  const roles: MemberRole[] = [
    "OWNER", "ADMIN", "MODERATOR", "ARCHITECT", "DEVELOPER",
    "OPERATOR", "MEMBER", "CLIENT", "VIEWER", "GUEST",
  ];

  return (
    <section>
      <h3 className="ec-hub-label">Роли</h3>
      <div className="ec-hub-card">
        <p className="ec-hub-hint">
          Роли меняются в разделе «Участники». Матрица прав сейчас системная и не редактируется вручную.
        </p>
        <div className="ec-server-role-grid">
          {roles.map((role) => (
            <article key={role} className="ec-server-role-card">
              <div className="ec-server-role-card__top">
                <span className={roleBadgeClass(role)}>{role}</span>
                <span>{members?.filter((m) => m.role === role).length ?? 0}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

type MembersSectionProps = {
  members?: MemberRow[];
  currentUserId?: string;
  isOwner: boolean;
  onUpdateRole?: (
    memberUserId: string,
    role: "ADMIN" | "MODERATOR" | "MEMBER",
  ) => Promise<boolean>;
};

export function MembersSection({ members, currentUserId, isOwner, onUpdateRole }: MembersSectionProps) {
  return (
    <section>
      <h3 className="ec-hub-label">Участники · {members?.length ?? 0}</h3>
      <div className="ec-hub-card" style={{ padding: "var(--ec-space-2)", gap: 2 }}>
        {!members || members.length === 0 ? (
          <div className="ec-hub-empty">Участников пока нет.</div>
        ) : (
          members.map((m) => {
            const isMe = currentUserId === m.userId;
            const isOwnerRow = m.role === "OWNER";
            return (
              <div key={m.id} className="ec-hub-member">
                <Avatar url={m.user.avatar} name={m.user.displayName} size={28} />
                <span className="ec-hub-member__name">
                  {m.user.displayName}
                  {isMe && <span className="ec-hub-member__me">(вы)</span>}
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
                    className="ec-hub-role-select"
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
          })
        )}
      </div>
    </section>
  );
}

type IsolationSectionProps = {
  server: ServerRow;
  lockReason: string;
  lockBusy: boolean;
  canUpdate: boolean;
  onReason: (value: string) => void;
  onLock: () => void;
  onUnlock: () => void;
};

export function IsolationSection({
  server,
  lockReason,
  lockBusy,
  canUpdate,
  onReason,
  onLock,
  onUnlock,
}: IsolationSectionProps) {
  return (
    <section>
      <h3 className="ec-hub-label">Изоляция</h3>
      <div className="ec-hub-card">
        <div className="ec-hub-lock-state">
          <span className={server.lockedAt ? "ec-badge ec-badge--danger" : "ec-badge"}>
            {server.lockedAt ? "Включена" : "Отключена"}
          </span>
          {server.lockedAt && (
            <span className="ec-hub-hint">
              С {new Date(server.lockedAt).toLocaleString("ru-RU")}
            </span>
          )}
        </div>
        <textarea
          value={lockReason}
          onChange={(e) => onReason(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Причина изоляции для операторов"
          className="ec-hub-input"
          style={{ resize: "vertical", minHeight: 92 }}
        />
        <p className="ec-hub-hint">
          Изоляция закрывает вступление по invite для новых участников. Existing members продолжают работать.
        </p>
        <div className="ec-hub-actions">
          <button
            type="button"
            className="ec-btn ec-btn--danger"
            disabled={lockBusy || !canUpdate}
            onClick={onLock}
          >
            {server.lockedAt ? "Обновить причину" : "Включить изоляцию"}
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--ghost"
            disabled={lockBusy || !server.lockedAt || !canUpdate}
            onClick={onUnlock}
          >
            Снять изоляцию
          </button>
        </div>
      </div>
    </section>
  );
}

export function AuditPlaceholderSection() {
  return (
    <section>
      <h3 className="ec-hub-label">Audit log</h3>
      <div className="ec-hub-card ec-hub-empty">Скоро в v1.5.56+</div>
    </section>
  );
}

type InviteSectionProps = {
  inviteCode: string;
  inviteUrl: string;
  copyState: "code" | "link" | null;
  onCopy: (text: string, which: "code" | "link") => void;
};

export function InviteSection({ inviteCode, inviteUrl, copyState, onCopy }: InviteSectionProps) {
  return (
    <section>
      <h3 className="ec-hub-label">Приглашение</h3>
      <div className="ec-hub-card">
        <div className="ec-hub-code">{inviteCode}</div>
        <div style={{ display: "flex", gap: "var(--ec-space-2)", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => onCopy(inviteCode, "code")}
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
            onClick={() => onCopy(inviteUrl, "link")}
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
  );
}
