import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { PlatformUserDetailsModal } from "./PlatformUserDetailsModal";
import { PlatformServerDetailsModal } from "./PlatformServerDetailsModal";
import { ApiError } from "../lib/api";
import {
  banPlatformUser,
  deletePlatformUser,
  listPlatformAuditLog,
  listPlatformServers,
  listPlatformUsers,
  resetPlatformUserPassword,
  suspendPlatformServer,
  unbanPlatformUser,
  unsuspendPlatformServer,
  type AuditLogEntry,
  type ListServersParams,
  type ListUsersParams,
  type PlatformServer,
  type PlatformUser,
  type ServerStatusFilter,
  type UserStatusFilter,
} from "../lib/platformAdmin";

/**
 * v1.2.6 Platform Admin (trek P1) — глобальная super-admin панель для
 * владельца платформы.
 *
 * v1.2.7 (trek P2) — расширение: 3 табы (Users / Servers / Audit),
 * delete-user (soft) в Users, suspend/unsuspend в Servers, audit-view
 * read-only feed.
 *
 * v1.2.8 (trek P3) — polish: pagination footer (prev/next + range),
 * search debounce 300ms, row-click → details-view модалка с историей
 * банов / owned servers / audit-trail.
 *
 * Доступ: только если currentUser.isPlatformOwner === true. Гейтится в
 * AppShell (топбар-кнопка не появляется без флага).
 */

// Page-size const-ы — общие для всех табов; serverside max=200.
const USERS_PAGE_SIZE = 50;
const SERVERS_PAGE_SIZE = 50;
const AUDIT_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

/** v1.2.8 trek P3 — debounce value, чтобы запросы не летели на каждую клавишу. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Pagination footer — общий для всех табов. */
type PaginationProps = {
  total: number;
  offset: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  /** v1.2.19 — jump-to-page: на Enter/blur input'а переходим к нужной странице. */
  onJumpToPage?: (page: number) => void;
  loading: boolean;
};
function PaginationFooter({
  total,
  offset,
  pageSize,
  onPrev,
  onNext,
  onJumpToPage,
  loading,
}: PaginationProps) {
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jumpInput, setJumpInput] = useState("");

  if (total === 0) return null;
  const start = offset + 1;
  const end = Math.min(offset + pageSize, total);
  const canPrev = offset > 0 && !loading;
  const canNext = end < total && !loading;
  // Jump показываем только если > 2 страниц — иначе prev/next хватает.
  const showJump = onJumpToPage && totalPages > 2;

  const submitJump = () => {
    const trimmed = jumpInput.trim();
    if (trimmed === "") return;
    const n = parseInt(trimmed, 10);
    setJumpInput("");
    if (Number.isNaN(n) || n < 1 || n > totalPages) return;
    if (n === currentPage) return;
    onJumpToPage?.(n);
  };

  return (
    <div className="ec-platform-admin__pagination">
      <span className="ec-platform-admin__pagination-range">
        {start}–{end} из {total}
      </span>
      <button
        type="button"
        className="ec-btn ec-btn--sm"
        onClick={onPrev}
        disabled={!canPrev}
      >
        ← Назад
      </button>
      {showJump && (
        <span className="ec-platform-admin__pagination-jump">
          <span className="ec-platform-admin__pagination-jump-label">Стр.</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpInput}
            placeholder={`${currentPage}`}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitJump();
              }
            }}
            onBlur={submitJump}
            disabled={loading}
            aria-label={`Перейти к странице, всего ${totalPages}`}
            className="ec-platform-admin__pagination-jump-input"
          />
          <span className="ec-platform-admin__pagination-jump-label">
            / {totalPages}
          </span>
        </span>
      )}
      <button
        type="button"
        className="ec-btn ec-btn--sm"
        onClick={onNext}
        disabled={!canNext}
      >
        Вперёд →
      </button>
    </div>
  );
}

type Props = {
  onClose: () => void;
  currentUserId: string;
};

type Tab = "users" | "servers" | "audit";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlatformAdminPanel({ onClose, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <Modal title="Platform Admin" onClose={onClose} width={1040}>
      <div className="ec-platform-admin">
        <div className="ec-platform-admin__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "users"}
            className="ec-platform-admin__tab"
            onClick={() => setTab("users")}
          >
            Пользователи
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "servers"}
            className="ec-platform-admin__tab"
            onClick={() => setTab("servers")}
          >
            Серверы
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "audit"}
            className="ec-platform-admin__tab"
            onClick={() => setTab("audit")}
          >
            Аудит
          </button>
        </div>

        {tab === "users" && <UsersTab currentUserId={currentUserId} />}
        {tab === "servers" && <ServersTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </Modal>
  );
}

// =============================================================================
// Users tab
// =============================================================================

function UsersTab({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const [filter, setFilter] = useState<UserStatusFilter>("all");
  // v1.2.8 trek P3 — pagination state. При смене search/filter сбрасываем
  // offset в 0 (useEffect ниже).
  const [offset, setOffset] = useState(0);
  // v1.2.8 trek P3 — клик по строке → details modal.
  const [detailsTargetId, setDetailsTargetId] = useState<string | null>(null);

  const [banTarget, setBanTarget] = useState<PlatformUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banBusy, setBanBusy] = useState(false);
  const [unbanTarget, setUnbanTarget] = useState<PlatformUser | null>(null);
  const [unbanBusy, setUnbanBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<PlatformUser | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatformUser | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [tempPwShown, setTempPwShown] = useState<{
    user: PlatformUser;
    pw: string;
  } | null>(null);
  const [tempPwCopied, setTempPwCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: ListUsersParams = {
        limit: USERS_PAGE_SIZE,
        offset,
      };
      const q = debouncedSearch.trim();
      if (q) params.q = q;
      if (filter !== "all") params.status = filter;
      const res = await listPlatformUsers(params);
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Не удалось загрузить список пользователей.",
      );
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, offset]);

  // v1.2.8 trek P3 — при смене search / filter сбрасываем offset в 0,
  // чтобы не оказаться на пустой странице.
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const replaceUser = useCallback((u: PlatformUser) => {
    setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));
  }, []);

  const submitBan = async () => {
    if (!banTarget) return;
    const reason = banReason.trim();
    if (!reason) {
      setActionError("Укажи причину бана.");
      return;
    }
    setBanBusy(true);
    setActionError(null);
    try {
      const res = await banPlatformUser(banTarget.id, reason);
      replaceUser(res.user);
      setBanTarget(null);
      setBanReason("");
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Не удалось забанить.");
    } finally {
      setBanBusy(false);
    }
  };

  const submitUnban = async () => {
    if (!unbanTarget) return;
    setUnbanBusy(true);
    setActionError(null);
    try {
      const res = await unbanPlatformUser(unbanTarget.id);
      replaceUser(res.user);
      setUnbanTarget(null);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Не удалось снять бан.");
    } finally {
      setUnbanBusy(false);
    }
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    setResetBusy(true);
    setActionError(null);
    try {
      const res = await resetPlatformUserPassword(resetTarget.id);
      replaceUser(res.user);
      setTempPwShown({ user: res.user, pw: res.tempPassword });
      setResetTarget(null);
      setTempPwCopied(false);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Не удалось сбросить пароль.");
    } finally {
      setResetBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    const reason = deleteReason.trim();
    if (!reason) {
      setActionError("Укажи причину удаления.");
      return;
    }
    if (deleteConfirmText.trim().toLowerCase() !== "удалить") {
      setActionError("Введи «удалить» для подтверждения.");
      return;
    }
    setDeleteBusy(true);
    setActionError(null);
    try {
      const res = await deletePlatformUser(deleteTarget.id, reason);
      replaceUser(res.user);
      setDeleteTarget(null);
      setDeleteReason("");
      setDeleteConfirmText("");
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Не удалось удалить.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const copyTempPw = async () => {
    if (!tempPwShown) return;
    try {
      await navigator.clipboard.writeText(tempPwShown.pw);
      setTempPwCopied(true);
    } catch {
      setTempPwCopied(false);
    }
  };

  const filters: { value: UserStatusFilter; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "active", label: "Активные" },
    { value: "banned", label: "Забанены" },
    { value: "deleted", label: "Удалены" },
  ];

  return (
    <>
      <div className="ec-platform-admin__toolbar">
        <form
          className="ec-platform-admin__search"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по email / имени…"
            className="ec-field"
            aria-label="Поиск пользователей"
          />
          <button type="submit" className="ec-btn ec-btn--sm">
            Найти
          </button>
        </form>
        <div className="ec-platform-admin__filters" role="tablist">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className="ec-cck-filter"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ec-platform-admin__meta">
          {loading ? "Загрузка…" : `${total} пользователей`}
        </div>
      </div>

      {error && <div className="ec-cck-banner ec-cck-banner--error">{error}</div>}

      {!loading && users.length === 0 && !error && (
        <div className="ec-cck-empty">Никого не найдено.</div>
      )}

      {users.length > 0 && (
        <div className="ec-platform-admin__tablewrap">
          <table className="ec-cck-table ec-platform-admin__table">
            <thead>
              <tr>
                <th className="ec-cck-th">Пользователь</th>
                <th className="ec-cck-th">Email</th>
                <th className="ec-cck-th">Регистрация</th>
                <th className="ec-cck-th">Статус</th>
                <th className="ec-cck-th ec-platform-admin__th-actions">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const isDeleted = u.deletedAt !== null;
                const isBanned = u.bannedAt !== null;
                const isOtherOwner = u.isPlatformOwner && !isSelf;
                const locked = isSelf || isOtherOwner || isDeleted;
                return (
                  <tr
                    key={u.id}
                    className="ec-cck-row ec-platform-admin__row--clickable"
                    onClick={() => setDetailsTargetId(u.id)}
                    title="Открыть детали"
                  >
                    <td className="ec-cck-cell">
                      <div className="ec-platform-admin__user">
                        <Avatar name={u.displayName} url={u.avatar} size={28} />
                        <div className="ec-platform-admin__user-text">
                          <span className="ec-platform-admin__user-name">
                            {u.displayName}
                            {isSelf && (
                              <span className="ec-platform-admin__self-mark">
                                (ты)
                              </span>
                            )}
                          </span>
                          {u.isPlatformOwner && (
                            <span
                              className="ec-cck-chip"
                              style={{
                                ["--tone" as string]: "var(--ec-accent-gold)",
                              }}
                            >
                              Platform Owner
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="ec-cck-cell ec-platform-admin__email">
                      {u.email}
                    </td>
                    <td className="ec-cck-cell">{formatDate(u.createdAt)}</td>
                    <td className="ec-cck-cell">
                      {isDeleted ? (
                        <span
                          className="ec-cck-chip"
                          style={{
                            ["--tone" as string]: "var(--ec-text-dim)",
                          }}
                          title={u.deletedReason ?? undefined}
                        >
                          Удалён
                        </span>
                      ) : isBanned ? (
                        <span
                          className="ec-cck-chip"
                          style={{
                            ["--tone" as string]: "var(--ec-status-risk)",
                          }}
                          title={u.bannedReason ?? undefined}
                        >
                          Забанен
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
                    <td className="ec-cck-cell ec-platform-admin__actions">
                      {isBanned && !isDeleted ? (
                        <button
                          type="button"
                          className="ec-btn ec-btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionError(null);
                            setUnbanTarget(u);
                          }}
                          disabled={isSelf || isOtherOwner}
                        >
                          Снять бан
                        </button>
                      ) : !isDeleted ? (
                        <button
                          type="button"
                          className="ec-btn ec-btn--sm ec-btn--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionError(null);
                            setBanReason("");
                            setBanTarget(u);
                          }}
                          disabled={locked}
                        >
                          Забанить
                        </button>
                      ) : null}
                      {!isDeleted && (
                        <button
                          type="button"
                          className="ec-btn ec-btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionError(null);
                            setResetTarget(u);
                          }}
                          disabled={locked}
                        >
                          Сбросить пароль
                        </button>
                      )}
                      {!isDeleted && (
                        <button
                          type="button"
                          className="ec-btn ec-btn--sm ec-btn--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionError(null);
                            setDeleteReason("");
                            setDeleteConfirmText("");
                            setDeleteTarget(u);
                          }}
                          disabled={locked}
                          title={
                            isSelf
                              ? "Нельзя удалить себя"
                              : isOtherOwner
                                ? "Нельзя удалить другого platform-owner'а"
                                : undefined
                          }
                        >
                          Удалить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationFooter
        total={total}
        offset={offset}
        pageSize={USERS_PAGE_SIZE}
        onPrev={() => setOffset(Math.max(0, offset - USERS_PAGE_SIZE))}
        onNext={() => setOffset(offset + USERS_PAGE_SIZE)}
        onJumpToPage={(page) => setOffset((page - 1) * USERS_PAGE_SIZE)}
        loading={loading}
      />

      {detailsTargetId && (
        <PlatformUserDetailsModal
          userId={detailsTargetId}
          onClose={() => setDetailsTargetId(null)}
          onBan={(u) => {
            setActionError(null);
            setBanReason("");
            setBanTarget(u);
            setDetailsTargetId(null);
          }}
          onUnban={(u) => {
            setActionError(null);
            setUnbanTarget(u);
            setDetailsTargetId(null);
          }}
          onReset={(u) => {
            setActionError(null);
            setResetTarget(u);
            setDetailsTargetId(null);
          }}
          onDelete={(u) => {
            setActionError(null);
            setDeleteReason("");
            setDeleteConfirmText("");
            setDeleteTarget(u);
            setDetailsTargetId(null);
          }}
        />
      )}

      {/* Confirm: ban */}
      {banTarget && (
        <Modal
          title={`Забанить ${banTarget.displayName}?`}
          onClose={() => {
            if (!banBusy) setBanTarget(null);
          }}
          width={480}
          footer={
            <>
              <button
                type="button"
                className="ec-btn"
                onClick={() => setBanTarget(null)}
                disabled={banBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="ec-btn ec-btn--danger"
                onClick={() => void submitBan()}
                disabled={banBusy || banReason.trim().length === 0}
              >
                {banBusy ? "Баню…" : "Забанить"}
              </button>
            </>
          }
        >
          <p className="ec-platform-admin__warn">
            Login будет отклоняться. Активные WS-сессии будут закрыты,
            refresh-токены отозваны. Действие обратимо через «Снять бан».
          </p>
          <label className="ec-platform-admin__label" htmlFor="ban-reason">
            Причина (видна юзеру при попытке логина)
          </label>
          <textarea
            id="ban-reason"
            className="ec-field"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Напр. «Нарушение правил, спам в #общий»"
          />
          {actionError && (
            <div className="ec-cck-banner ec-cck-banner--error">{actionError}</div>
          )}
        </Modal>
      )}

      {/* Confirm: unban */}
      {unbanTarget && (
        <Modal
          title={`Снять бан с ${unbanTarget.displayName}?`}
          onClose={() => {
            if (!unbanBusy) setUnbanTarget(null);
          }}
          width={440}
          footer={
            <>
              <button
                type="button"
                className="ec-btn"
                onClick={() => setUnbanTarget(null)}
                disabled={unbanBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="ec-btn ec-btn--primary"
                onClick={() => void submitUnban()}
                disabled={unbanBusy}
              >
                {unbanBusy ? "Снимаю…" : "Снять бан"}
              </button>
            </>
          }
        >
          <p className="ec-platform-admin__warn">
            Пользователь сможет логиниться. Прошлый пароль остаётся в силе.
          </p>
          {unbanTarget.bannedReason && (
            <p className="ec-platform-admin__sub">
              Причина бана: <em>{unbanTarget.bannedReason}</em>
            </p>
          )}
          {actionError && (
            <div className="ec-cck-banner ec-cck-banner--error">{actionError}</div>
          )}
        </Modal>
      )}

      {/* Confirm: reset password */}
      {resetTarget && (
        <Modal
          title={`Сбросить пароль для ${resetTarget.displayName}?`}
          onClose={() => {
            if (!resetBusy) setResetTarget(null);
          }}
          width={460}
          footer={
            <>
              <button
                type="button"
                className="ec-btn"
                onClick={() => setResetTarget(null)}
                disabled={resetBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="ec-btn ec-btn--danger"
                onClick={() => void submitReset()}
                disabled={resetBusy}
              >
                {resetBusy ? "Сбрасываю…" : "Сбросить пароль"}
              </button>
            </>
          }
        >
          <p className="ec-platform-admin__warn">
            Будет сгенерирован новый временный пароль. Текущий пароль
            перестанет работать, refresh-токены отозваны. Временный пароль
            покажется один раз — передашь юзеру вне платформы.
          </p>
          {actionError && (
            <div className="ec-cck-banner ec-cck-banner--error">{actionError}</div>
          )}
        </Modal>
      )}

      {/* Confirm: delete (double-confirm с введением слова «удалить») */}
      {deleteTarget && (
        <Modal
          title={`Удалить ${deleteTarget.displayName}?`}
          onClose={() => {
            if (!deleteBusy) setDeleteTarget(null);
          }}
          width={500}
          footer={
            <>
              <button
                type="button"
                className="ec-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="ec-btn ec-btn--danger"
                onClick={() => void submitDelete()}
                disabled={
                  deleteBusy ||
                  deleteReason.trim().length === 0 ||
                  deleteConfirmText.trim().toLowerCase() !== "удалить"
                }
              >
                {deleteBusy ? "Удаляю…" : "Удалить навсегда"}
              </button>
            </>
          }
        >
          <p className="ec-platform-admin__warn">
            Soft-delete: login и WS блокируются «навсегда», refresh-токены
            отозваны, сокеты разорваны. Данные пользователя (сообщения,
            задачи, комментарии) остаются в БД — UI рисует их как
            «удалённый пользователь». Обратимо вручную через SQL
            (см. ROADMAP). Серверы, которыми владел этот юзер, остаются —
            используй «Заморозить» в табe Серверы при необходимости.
          </p>
          <label className="ec-platform-admin__label" htmlFor="delete-reason">
            Причина (для аудита)
          </label>
          <textarea
            id="delete-reason"
            className="ec-field"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Напр. «По запросу пользователя, GDPR»"
          />
          <label
            className="ec-platform-admin__label"
            htmlFor="delete-confirm"
          >
            Введи «удалить» для подтверждения
          </label>
          <input
            id="delete-confirm"
            type="text"
            className="ec-field"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            autoComplete="off"
          />
          {actionError && (
            <div className="ec-cck-banner ec-cck-banner--error">{actionError}</div>
          )}
        </Modal>
      )}

      {/* Temp password display — show-once */}
      {tempPwShown && (
        <Modal
          title="Временный пароль создан"
          onClose={() => setTempPwShown(null)}
          width={480}
          footer={
            <button
              type="button"
              className="ec-btn ec-btn--primary"
              onClick={() => setTempPwShown(null)}
            >
              Готово
            </button>
          }
        >
          <p className="ec-platform-admin__sub">
            Пользователь: <strong>{tempPwShown.user.displayName}</strong> (
            {tempPwShown.user.email})
          </p>
          <div className="ec-cck-banner ec-cck-banner--warn">
            ⚠ Пароль больше не появится. Скопируй сейчас и передай юзеру
            вне платформы.
          </div>
          <div className="ec-platform-admin__temppw">
            <code className="ec-platform-admin__temppw-value">
              {tempPwShown.pw}
            </code>
            <button
              type="button"
              className="ec-btn ec-btn--sm"
              onClick={() => void copyTempPw()}
            >
              {tempPwCopied ? "Скопировано" : "Скопировать"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// =============================================================================
// Servers tab
// =============================================================================

function ServersTab() {
  const [servers, setServers] = useState<PlatformServer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const [filter, setFilter] = useState<ServerStatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [detailsServerId, setDetailsServerId] = useState<string | null>(null);

  const [suspendTarget, setSuspendTarget] = useState<PlatformServer | null>(
    null,
  );
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendBusy, setSuspendBusy] = useState(false);
  const [unsuspendTarget, setUnsuspendTarget] = useState<PlatformServer | null>(
    null,
  );
  const [unsuspendBusy, setUnsuspendBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: ListServersParams = {
        limit: SERVERS_PAGE_SIZE,
        offset,
      };
      const q = debouncedSearch.trim();
      if (q) params.q = q;
      if (filter !== "all") params.status = filter;
      const res = await listPlatformServers(params);
      setServers(res.servers);
      setTotal(res.total);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Не удалось загрузить серверы.",
      );
      setServers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, offset]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const replaceServer = useCallback((s: PlatformServer) => {
    setServers((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }, []);

  const submitSuspend = async () => {
    if (!suspendTarget) return;
    const reason = suspendReason.trim();
    if (!reason) {
      setActionError("Укажи причину заморозки.");
      return;
    }
    setSuspendBusy(true);
    setActionError(null);
    try {
      const res = await suspendPlatformServer(suspendTarget.id, reason);
      replaceServer(res.server);
      setSuspendTarget(null);
      setSuspendReason("");
    } catch (e) {
      setActionError(
        e instanceof ApiError ? e.message : "Не удалось заморозить.",
      );
    } finally {
      setSuspendBusy(false);
    }
  };

  const submitUnsuspend = async () => {
    if (!unsuspendTarget) return;
    setUnsuspendBusy(true);
    setActionError(null);
    try {
      const res = await unsuspendPlatformServer(unsuspendTarget.id);
      replaceServer(res.server);
      setUnsuspendTarget(null);
    } catch (e) {
      setActionError(
        e instanceof ApiError ? e.message : "Не удалось разморозить.",
      );
    } finally {
      setUnsuspendBusy(false);
    }
  };

  const filters: { value: ServerStatusFilter; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "active", label: "Активные" },
    { value: "suspended", label: "Заморожены" },
  ];

  return (
    <>
      <div className="ec-platform-admin__toolbar">
        <form
          className="ec-platform-admin__search"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по name / owner email…"
            className="ec-field"
            aria-label="Поиск серверов"
          />
          <button type="submit" className="ec-btn ec-btn--sm">
            Найти
          </button>
        </form>
        <div className="ec-platform-admin__filters" role="tablist">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className="ec-cck-filter"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ec-platform-admin__meta">
          {loading ? "Загрузка…" : `${total} серверов`}
        </div>
      </div>

      {error && <div className="ec-cck-banner ec-cck-banner--error">{error}</div>}

      {!loading && servers.length === 0 && !error && (
        <div className="ec-cck-empty">Серверы не найдены.</div>
      )}

      {servers.length > 0 && (
        <div className="ec-platform-admin__tablewrap">
          <table className="ec-cck-table ec-platform-admin__table">
            <thead>
              <tr>
                <th className="ec-cck-th">Сервер</th>
                <th className="ec-cck-th">Владелец</th>
                <th className="ec-cck-th">Размер</th>
                <th className="ec-cck-th">Создан</th>
                <th className="ec-cck-th">Статус</th>
                <th className="ec-cck-th ec-platform-admin__th-actions">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => {
                const isSuspended = s.suspendedAt !== null;
                return (
                  <tr
                    key={s.id}
                    className="ec-cck-row ec-platform-admin__row--clickable"
                    onClick={() => setDetailsServerId(s.id)}
                    title="Открыть детали"
                  >
                    <td className="ec-cck-cell">
                      <div className="ec-platform-admin__server-name">
                        <span
                          className="ec-platform-admin__server-icon"
                          style={
                            s.brandColor
                              ? {
                                  background: `hsl(${s.brandColor})`,
                                }
                              : undefined
                          }
                          aria-hidden
                        >
                          {(s.icon ?? s.name.charAt(0)).slice(0, 1).toUpperCase()}
                        </span>
                        <span className="ec-platform-admin__user-name">
                          {s.name}
                        </span>
                        <span
                          className="ec-cck-chip"
                          style={{
                            ["--tone" as string]:
                              s.mode === "CLIENT"
                                ? "var(--ec-accent)"
                                : "var(--ec-text-dim)",
                          }}
                        >
                          {s.mode}
                        </span>
                      </div>
                    </td>
                    <td className="ec-cck-cell ec-platform-admin__email">
                      {s.owner.displayName}
                      <br />
                      <span style={{ opacity: 0.7 }}>{s.owner.email}</span>
                      {s.owner.deletedAt && (
                        <span
                          className="ec-cck-chip"
                          style={{
                            ["--tone" as string]: "var(--ec-text-dim)",
                          }}
                        >
                          owner удалён
                        </span>
                      )}
                    </td>
                    <td className="ec-cck-cell">
                      {s.memberCount}&nbsp;уч. · {s.channelCount}&nbsp;кан.
                    </td>
                    <td className="ec-cck-cell">{formatDate(s.createdAt)}</td>
                    <td className="ec-cck-cell">
                      {isSuspended ? (
                        <span
                          className="ec-cck-chip"
                          style={{
                            ["--tone" as string]: "var(--ec-status-risk)",
                          }}
                          title={s.suspendedReason ?? undefined}
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
                    <td className="ec-cck-cell ec-platform-admin__actions">
                      {isSuspended ? (
                        <button
                          type="button"
                          className="ec-btn ec-btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionError(null);
                            setUnsuspendTarget(s);
                          }}
                        >
                          Разморозить
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ec-btn ec-btn--sm ec-btn--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionError(null);
                            setSuspendReason("");
                            setSuspendTarget(s);
                          }}
                        >
                          Заморозить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationFooter
        total={total}
        offset={offset}
        pageSize={SERVERS_PAGE_SIZE}
        onPrev={() => setOffset(Math.max(0, offset - SERVERS_PAGE_SIZE))}
        onNext={() => setOffset(offset + SERVERS_PAGE_SIZE)}
        onJumpToPage={(page) => setOffset((page - 1) * SERVERS_PAGE_SIZE)}
        loading={loading}
      />

      {detailsServerId && (
        <PlatformServerDetailsModal
          serverId={detailsServerId}
          onClose={() => setDetailsServerId(null)}
          onSuspend={(s) => {
            setActionError(null);
            setSuspendTarget(s);
            setDetailsServerId(null);
          }}
          onUnsuspend={(s) => {
            setActionError(null);
            setUnsuspendTarget(s);
            setDetailsServerId(null);
          }}
        />
      )}

      {suspendTarget && (
        <Modal
          title={`Заморозить «${suspendTarget.name}»?`}
          onClose={() => {
            if (!suspendBusy) setSuspendTarget(null);
          }}
          width={500}
          footer={
            <>
              <button
                type="button"
                className="ec-btn"
                onClick={() => setSuspendTarget(null)}
                disabled={suspendBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="ec-btn ec-btn--danger"
                onClick={() => void submitSuspend()}
                disabled={suspendBusy || suspendReason.trim().length === 0}
              >
                {suspendBusy ? "Замораживаю…" : "Заморозить"}
              </button>
            </>
          }
        >
          <p className="ec-platform-admin__warn">
            Write-операции (постинг сообщений, создание каналов, изменение
            settings, создание задач) блокируются 403. Чтение остаётся —
            история не пропадает. Обратимо через «Разморозить».
          </p>
          <label className="ec-platform-admin__label" htmlFor="suspend-reason">
            Причина (для аудита; владелец сервера её не видит автоматически)
          </label>
          <textarea
            id="suspend-reason"
            className="ec-field"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Напр. «Жалоба на спам от участников»"
          />
          {actionError && (
            <div className="ec-cck-banner ec-cck-banner--error">{actionError}</div>
          )}
        </Modal>
      )}

      {unsuspendTarget && (
        <Modal
          title={`Разморозить «${unsuspendTarget.name}»?`}
          onClose={() => {
            if (!unsuspendBusy) setUnsuspendTarget(null);
          }}
          width={440}
          footer={
            <>
              <button
                type="button"
                className="ec-btn"
                onClick={() => setUnsuspendTarget(null)}
                disabled={unsuspendBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="ec-btn ec-btn--primary"
                onClick={() => void submitUnsuspend()}
                disabled={unsuspendBusy}
              >
                {unsuspendBusy ? "Размораживаю…" : "Разморозить"}
              </button>
            </>
          }
        >
          <p className="ec-platform-admin__warn">
            Write-режим включится обратно.
          </p>
          {unsuspendTarget.suspendedReason && (
            <p className="ec-platform-admin__sub">
              Причина заморозки: <em>{unsuspendTarget.suspendedReason}</em>
            </p>
          )}
          {actionError && (
            <div className="ec-cck-banner ec-cck-banner--error">{actionError}</div>
          )}
        </Modal>
      )}
    </>
  );
}

// =============================================================================
// Audit tab
// =============================================================================

function AuditTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPlatformAuditLog({
        type: typeFilter.trim() || undefined,
        userId: userIdFilter.trim() || undefined,
        limit: AUDIT_PAGE_SIZE,
        offset,
      });
      setEntries(res.entries);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить аудит.");
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, userIdFilter, offset]);

  useEffect(() => {
    setOffset(0);
  }, [typeFilter, userIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="ec-platform-admin__toolbar">
        <form
          className="ec-platform-admin__search"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <input
            type="text"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="Type (e.g. PLATFORM_USER_BANNED)"
            className="ec-field"
            aria-label="Фильтр type"
          />
          <input
            type="text"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            placeholder="User ID"
            className="ec-field"
            aria-label="Фильтр userId"
          />
          <button type="submit" className="ec-btn ec-btn--sm">
            Найти
          </button>
        </form>
        <div className="ec-platform-admin__meta">
          {loading ? "Загрузка…" : `${total} событий`}
        </div>
      </div>

      {error && <div className="ec-cck-banner ec-cck-banner--error">{error}</div>}

      {!loading && entries.length === 0 && !error && (
        <div className="ec-cck-empty">Событий нет.</div>
      )}

      {entries.length > 0 && (
        <div className="ec-platform-admin__tablewrap">
          <table className="ec-cck-table ec-platform-admin__table">
            <thead>
              <tr>
                <th className="ec-cck-th">Время</th>
                <th className="ec-cck-th">Type</th>
                <th className="ec-cck-th">Actor</th>
                <th className="ec-cck-th">IP</th>
                <th className="ec-cck-th">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="ec-cck-row">
                  <td className="ec-cck-cell">{formatDateTime(e.createdAt)}</td>
                  <td className="ec-cck-cell ec-platform-admin__email">
                    {e.type}
                  </td>
                  <td className="ec-cck-cell">
                    {e.user
                      ? `${e.user.displayName} (${e.user.email})`
                      : "—"}
                  </td>
                  <td className="ec-cck-cell ec-platform-admin__email">
                    {e.ipAddress ?? "—"}
                  </td>
                  <td className="ec-cck-cell ec-platform-admin__audit-meta">
                    {e.metadata ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationFooter
        total={total}
        offset={offset}
        pageSize={AUDIT_PAGE_SIZE}
        onPrev={() => setOffset(Math.max(0, offset - AUDIT_PAGE_SIZE))}
        onJumpToPage={(page) => setOffset((page - 1) * AUDIT_PAGE_SIZE)}
        onNext={() => setOffset(offset + AUDIT_PAGE_SIZE)}
        loading={loading}
      />
    </>
  );
}
