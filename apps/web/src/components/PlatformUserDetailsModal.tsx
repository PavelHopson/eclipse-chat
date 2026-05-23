import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { ApiError } from "../lib/api";
import {
  getPlatformUserDetails,
  type PlatformUser,
  type PlatformUserDetailsResponse,
} from "../lib/platformAdmin";

/**
 * v1.2.8 Platform Admin (trek P3) — details-view модалка для пользователя.
 * Открывается из Users-таба по клику на строку. Загружает по запросу
 * (lazy): owned servers, кол-во memberships, audit-trail (entries где
 * user был actor ИЛИ target в metadata, последние 50).
 */

type Props = {
  userId: string;
  onClose: () => void;
  /**
   * v1.2.17 — action callbacks из parent PlatformAdminPanel. Каждая
   * закрывает details modal и открывает confirm modal с тем же state,
   * что и actions из row table. Если не передан — кнопка скрыта.
   */
  onBan?: (user: PlatformUser) => void;
  onUnban?: (user: PlatformUser) => void;
  onReset?: (user: PlatformUser) => void;
  onDelete?: (user: PlatformUser) => void;
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

export function PlatformUserDetailsModal({
  userId,
  onClose,
  onBan,
  onUnban,
  onReset,
  onDelete,
}: Props) {
  const [data, setData] = useState<PlatformUserDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPlatformUserDetails(userId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Не удалось загрузить детали пользователя.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <Modal
      title={data ? `Пользователь — ${data.user.displayName}` : "Пользователь"}
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
              <Avatar
                name={data.user.displayName}
                url={data.user.avatar}
                size={48}
              />
              <div className="ec-platform-admin__details-headtext">
                <div className="ec-platform-admin__details-name">
                  {data.user.displayName}
                </div>
                <div className="ec-platform-admin__details-sub">
                  {data.user.email}
                </div>
                <div className="ec-platform-admin__details-meta">
                  Создан: {formatDate(data.user.createdAt)} ·
                  серверов в участии: {data.memberCount}
                </div>
              </div>
              <div className="ec-platform-admin__details-chips">
                {data.user.isPlatformOwner && (
                  <span
                    className="ec-cck-chip"
                    style={{
                      ["--tone" as string]: "var(--ec-accent-gold)",
                    }}
                  >
                    Platform Owner
                  </span>
                )}
                {data.user.deletedAt && (
                  <span
                    className="ec-cck-chip"
                    style={{ ["--tone" as string]: "var(--ec-text-dim)" }}
                  >
                    Удалён
                  </span>
                )}
                {data.user.bannedAt && !data.user.deletedAt && (
                  <span
                    className="ec-cck-chip"
                    style={{ ["--tone" as string]: "var(--ec-status-risk)" }}
                  >
                    Забанен
                  </span>
                )}
                {!data.user.bannedAt &&
                  !data.user.deletedAt &&
                  !data.user.isPlatformOwner && (
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

            {!data.user.isPlatformOwner &&
              (onBan || onUnban || onReset || onDelete) && (
                <div
                  style={{
                    display: "flex",
                    gap: "var(--ec-space-2)",
                    flexWrap: "wrap",
                    marginTop: "var(--ec-space-3)",
                  }}
                >
                  {data.user.bannedAt && !data.user.deletedAt && onUnban && (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm"
                      onClick={() => onUnban(data.user)}
                    >
                      Снять бан
                    </button>
                  )}
                  {!data.user.bannedAt && !data.user.deletedAt && onBan && (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm ec-btn--danger"
                      onClick={() => onBan(data.user)}
                    >
                      Забанить
                    </button>
                  )}
                  {!data.user.deletedAt && onReset && (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm"
                      onClick={() => onReset(data.user)}
                    >
                      Сбросить пароль
                    </button>
                  )}
                  {!data.user.deletedAt && onDelete && (
                    <button
                      type="button"
                      className="ec-btn ec-btn--sm ec-btn--danger"
                      onClick={() => onDelete(data.user)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              )}

            {(data.user.bannedAt || data.user.deletedAt) && (
              <div className="ec-platform-admin__details-section">
                <div className="ec-platform-admin__label">Состояние</div>
                {data.user.deletedAt && (
                  <p className="ec-platform-admin__sub">
                    <strong>Удалён</strong>{" "}
                    {formatDateTime(data.user.deletedAt)}
                    {data.user.deletedBy &&
                      ` админом ${data.user.deletedBy.displayName}`}
                    .
                    {data.user.deletedReason && (
                      <>
                        {" "}
                        Причина: <em>{data.user.deletedReason}</em>
                      </>
                    )}
                  </p>
                )}
                {data.user.bannedAt && (
                  <p className="ec-platform-admin__sub">
                    <strong>Забанен</strong>{" "}
                    {formatDateTime(data.user.bannedAt)}
                    {data.user.bannedBy &&
                      ` админом ${data.user.bannedBy.displayName}`}
                    .
                    {data.user.bannedReason && (
                      <>
                        {" "}
                        Причина: <em>{data.user.bannedReason}</em>
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="ec-platform-admin__details-section">
              <div className="ec-platform-admin__label">
                Серверы в собственности ({data.ownedServers.length})
              </div>
              {data.ownedServers.length === 0 ? (
                <div className="ec-cck-empty">Этот юзер не владеет серверами.</div>
              ) : (
                <table className="ec-cck-table">
                  <thead>
                    <tr>
                      <th className="ec-cck-th">Сервер</th>
                      <th className="ec-cck-th">Создан</th>
                      <th className="ec-cck-th">Размер</th>
                      <th className="ec-cck-th">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ownedServers.map((s) => (
                      <tr key={s.id} className="ec-cck-row">
                        <td className="ec-cck-cell">{s.name}</td>
                        <td className="ec-cck-cell">
                          {formatDate(s.createdAt)}
                        </td>
                        <td className="ec-cck-cell">
                          {s.memberCount}&nbsp;уч. · {s.channelCount}&nbsp;кан.
                        </td>
                        <td className="ec-cck-cell">
                          {s.suspendedAt ? (
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
