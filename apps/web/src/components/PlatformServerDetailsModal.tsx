import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { ApiError } from "../lib/api";
import {
  getPlatformServerDetails,
  type PlatformServerDetailsResponse,
} from "../lib/platformAdmin";

/**
 * v1.2.8 Platform Admin (trek P3) — details-view модалка для сервера.
 * Открывается из Servers-таба по клику на строку. Загружает: members
 * role-breakdown (group by role), audit-trail (entries где сервер
 * упомянут в metadata.targetServerId или metadata.serverId).
 */

type Props = {
  serverId: string;
  onClose: () => void;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Порядок ролей для отображения breakdown (от высокой к низкой иерархии).
const ROLE_ORDER = [
  "OWNER",
  "ADMIN",
  "MODERATOR",
  "ARCHITECT",
  "DEVELOPER",
  "OPERATOR",
  "MEMBER",
  "GUEST",
  "CLIENT",
] as const;

export function PlatformServerDetailsModal({ serverId, onClose }: Props) {
  const [data, setData] = useState<PlatformServerDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPlatformServerDetails(serverId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Не удалось загрузить детали сервера.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const totalMembers = data
    ? Object.values(data.roleBreakdown).reduce((a, b) => a + b, 0)
    : 0;
  const orderedRoles = data
    ? [
        ...ROLE_ORDER.filter((r) => data.roleBreakdown[r] !== undefined),
        ...Object.keys(data.roleBreakdown).filter(
          (r) => !ROLE_ORDER.includes(r as (typeof ROLE_ORDER)[number]),
        ),
      ]
    : [];

  return (
    <Modal
      title={data ? `Сервер — ${data.server.name}` : "Сервер"}
      onClose={onClose}
      width={760}
    >
      <div className="ec-platform-admin__details">
        {loading && <div className="ec-cck-empty">Загрузка…</div>}
        {error && (
          <div className="ec-cck-banner ec-cck-banner--error">{error}</div>
        )}
        {data && (
          <>
            <div className="ec-platform-admin__details-head">
              <div
                className="ec-platform-admin__server-icon"
                style={{
                  width: 48,
                  height: 48,
                  fontSize: "1.25rem",
                  background: data.server.brandColor
                    ? `hsl(${data.server.brandColor})`
                    : undefined,
                }}
                aria-hidden
              >
                {(data.server.icon ?? data.server.name.charAt(0))
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
              <div className="ec-platform-admin__details-headtext">
                <div className="ec-platform-admin__details-name">
                  {data.server.name}
                </div>
                <div className="ec-platform-admin__details-sub">
                  Владелец: {data.server.owner.displayName} (
                  {data.server.owner.email})
                  {data.server.owner.deletedAt && " · удалён"}
                </div>
                <div className="ec-platform-admin__details-meta">
                  Создан: {formatDate(data.server.createdAt)} · участников:{" "}
                  {data.server.memberCount} · каналов:{" "}
                  {data.server.channelCount}
                </div>
              </div>
              <div className="ec-platform-admin__details-chips">
                <span
                  className="ec-cck-chip"
                  style={{
                    ["--tone" as string]:
                      data.server.mode === "CLIENT"
                        ? "var(--ec-accent)"
                        : "var(--ec-text-dim)",
                  }}
                >
                  {data.server.mode}
                </span>
                {data.server.suspendedAt ? (
                  <span
                    className="ec-cck-chip"
                    style={{
                      ["--tone" as string]: "var(--ec-status-risk)",
                    }}
                  >
                    Заморожен
                  </span>
                ) : (
                  <span
                    className="ec-cck-chip"
                    style={{
                      ["--tone" as string]: "var(--ec-status-exec)",
                    }}
                  >
                    Активен
                  </span>
                )}
              </div>
            </div>

            {data.server.suspendedAt && (
              <div className="ec-platform-admin__details-section">
                <div className="ec-platform-admin__label">Заморозка</div>
                <p className="ec-platform-admin__sub">
                  С {formatDateTime(data.server.suspendedAt)}
                  {data.server.suspendedBy &&
                    ` админом ${data.server.suspendedBy.displayName}`}
                  .
                  {data.server.suspendedReason && (
                    <>
                      {" "}
                      Причина: <em>{data.server.suspendedReason}</em>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="ec-platform-admin__details-section">
              <div className="ec-platform-admin__label">
                Состав по ролям ({totalMembers})
              </div>
              {orderedRoles.length === 0 ? (
                <div className="ec-cck-empty">Нет участников.</div>
              ) : (
                <div className="ec-platform-admin__role-chips">
                  {orderedRoles.map((role) => (
                    <span
                      key={role}
                      className="ec-cck-chip"
                      style={{
                        ["--tone" as string]:
                          role === "OWNER"
                            ? "var(--ec-accent-gold)"
                            : role === "ADMIN"
                              ? "var(--ec-accent)"
                              : "var(--ec-text-muted)",
                      }}
                    >
                      {role}: {data.roleBreakdown[role]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="ec-platform-admin__details-section">
              <div className="ec-platform-admin__label">
                История событий ({data.auditTrail.length})
              </div>
              {data.auditTrail.length === 0 ? (
                <div className="ec-cck-empty">Событий нет.</div>
              ) : (
                <table className="ec-cck-table">
                  <thead>
                    <tr>
                      <th className="ec-cck-th">Время</th>
                      <th className="ec-cck-th">Type</th>
                      <th className="ec-cck-th">Actor</th>
                      <th className="ec-cck-th">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.auditTrail.map((e) => (
                      <tr key={e.id} className="ec-cck-row">
                        <td className="ec-cck-cell">
                          {formatDateTime(e.createdAt)}
                        </td>
                        <td className="ec-cck-cell ec-platform-admin__email">
                          {e.type}
                        </td>
                        <td className="ec-cck-cell">
                          {e.user ? e.user.displayName : "—"}
                        </td>
                        <td className="ec-cck-cell ec-platform-admin__audit-meta">
                          {e.metadata ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
