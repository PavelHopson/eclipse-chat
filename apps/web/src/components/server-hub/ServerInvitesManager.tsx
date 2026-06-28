import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../../lib/api";

/**
 * v1.6.99 — управление одноразовыми / истекающими приглашениями (privacy
 * slice B). Список + создание (TTL/лимит) + отзыв. Бэкенд:
 * GET/POST/DELETE /api/servers/:id/invites; приём — через ?invite=<code>.
 *
 * Рендерится в табе «Приглашение» ServerHubModal под legacy-кодом, только для
 * тех, кто может управлять (бэкенд гейтит permission MEMBER_INVITE).
 */

type InviteRejectReason = "revoked" | "expired" | "exhausted" | null;

type InviteRow = {
  id: string;
  code: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  rejectReason: InviteRejectReason;
};

interface Props {
  serverId: string;
  buildInviteUrl: (code: string) => string;
}

// Пресеты срока жизни (секунды). null = бессрочно.
const TTL_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "Никогда", value: null },
  { label: "1 час", value: 3600 },
  { label: "24 часа", value: 86400 },
  { label: "7 дней", value: 604800 },
];

// Пресеты лимита использований. null = без лимита.
const USES_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "Без лимита", value: null },
  { label: "1 раз", value: 1 },
  { label: "5 раз", value: 5 },
  { label: "25 раз", value: 25 },
  { label: "100 раз", value: 100 },
];

const REJECT_LABEL: Record<NonNullable<InviteRejectReason>, string> = {
  revoked: "отозвано",
  expired: "истекло",
  exhausted: "исчерпано",
};

function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return "бессрочно";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "истекло";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `ещё ${Math.floor(h / 24)} дн.`;
  if (h >= 1) return `ещё ${h} ч.`;
  return `ещё ${Math.max(1, Math.floor(ms / 60_000))} мин.`;
}

export function ServerInvitesManager({ serverId, buildInviteUrl }: Props) {
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ttl, setTtl] = useState<number | null>(86400);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiJson<{ invites: InviteRow[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/invites`,
      );
      setInvites(data.invites);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить приглашения");
      setInvites([]);
    }
  }, [serverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiJson<{ invite: InviteRow }>(
        `/api/servers/${encodeURIComponent(serverId)}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInSeconds: ttl, maxUses }),
        },
      );
      setInvites((prev) => [data.invite, ...(prev ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать приглашение");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      await apiJson(`/api/servers/${encodeURIComponent(serverId)}/invites/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setInvites((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отозвать");
    }
  };

  const copyLink = (inv: InviteRow) => {
    const cb = navigator.clipboard;
    if (!cb) return;
    void cb.writeText(buildInviteUrl(inv.code)).then(() => {
      setCopiedId(inv.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === inv.id ? null : cur)), 2000);
    });
  };

  return (
    <section style={{ marginTop: "var(--ec-space-4)" }}>
      <h3 className="ec-hub-label">Одноразовые приглашения</h3>

      <div className="ec-hub-card" style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
        <div style={{ display: "flex", gap: "var(--ec-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            <span style={{ color: "var(--ec-text-muted)" }}>Срок</span>
            <select
              className="ec-input ec-input--sm"
              value={ttl === null ? "null" : String(ttl)}
              onChange={(e) => setTtl(e.target.value === "null" ? null : Number(e.target.value))}
            >
              {TTL_PRESETS.map((p) => (
                <option key={p.label} value={p.value === null ? "null" : String(p.value)}>{p.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            <span style={{ color: "var(--ec-text-muted)" }}>Лимит</span>
            <select
              className="ec-input ec-input--sm"
              value={maxUses === null ? "null" : String(maxUses)}
              onChange={(e) => setMaxUses(e.target.value === "null" ? null : Number(e.target.value))}
            >
              {USES_PRESETS.map((p) => (
                <option key={p.label} value={p.value === null ? "null" : String(p.value)}>{p.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="ec-btn ec-btn--sm ec-btn--primary" onClick={() => void create()} disabled={busy}>
            {busy ? "Создаю…" : "Создать ссылку"}
          </button>
        </div>

        {error && <div style={{ color: "var(--ec-danger)", fontSize: 12 }}>{error}</div>}

        {invites === null ? (
          <div style={{ color: "var(--ec-text-muted)", fontSize: 13 }}>Загрузка…</div>
        ) : invites.length === 0 ? (
          <div style={{ color: "var(--ec-text-muted)", fontSize: 13 }}>
            Пока нет одноразовых приглашений. Создайте ссылку с лимитом или сроком — удобно для разовых приглашений.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
            {invites.map((inv) => {
              const inactive = inv.rejectReason !== null;
              return (
                <li
                  key={inv.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "var(--ec-space-2)",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--ec-space-2)",
                    border: "1px solid var(--ec-border-subtle)",
                    borderRadius: "var(--ec-radius-sm)",
                    opacity: inactive ? 0.55 : 1,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <code style={{ fontSize: 13 }}>{inv.code}</code>
                    <span style={{ fontSize: 11, color: "var(--ec-text-muted)" }}>
                      {inv.maxUses === null ? `${inv.uses} использований` : `${inv.uses}/${inv.maxUses} использований`}
                      {" · "}
                      {inactive ? REJECT_LABEL[inv.rejectReason as NonNullable<InviteRejectReason>] : expiryLabel(inv.expiresAt)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "var(--ec-space-1)" }}>
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm"
                      onClick={() => copyLink(inv)}
                      disabled={inactive}
                      style={copiedId === inv.id ? { color: "var(--ec-ok)", borderColor: "var(--ec-ok)" } : undefined}
                    >
                      {copiedId === inv.id ? "✓ Скопировано" : "Копировать ссылку"}
                    </button>
                    <button type="button" className="ec-btn ec-btn--sm" onClick={() => void revoke(inv.id)}>
                      Отозвать
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
