import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { ApiError } from "../lib/api";
import {
  banPlatformUser,
  listPlatformUsers,
  resetPlatformUserPassword,
  unbanPlatformUser,
  type ListUsersParams,
  type PlatformUser,
} from "../lib/platformAdmin";

/**
 * v1.2.6 Platform Admin (trek P1) — глобальная super-admin панель для
 * владельца платформы. P1 scope: Users-таба (список / бан / снять бан /
 * сброс пароля). Servers/suspend + audit-view — P2.
 *
 * Доступ: только если currentUser.isPlatformOwner === true. Гейтится в
 * AppShell (топбар-кнопка не появляется без флага).
 *
 * Все mutating-действия идут через confirm-модалки. Reset-password
 * возвращает temp pw один раз — показываем в отдельной модалке с
 * copy-to-clipboard и понятным warning.
 *
 * Визуальный язык — cockpit-system (общий с StatusBoard /
 * OperationalTablePanel / ActionItemDrawer): .ec-cck-table / row / cell /
 * chip / banner. SOLAR совместима — все цвета через токены.
 */

type Props = {
  onClose: () => void;
  /** ID текущего platform-owner'а (для disable действий над собой). */
  currentUserId: string;
};

type Filter = "all" | "active" | "banned";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PlatformAdminPanel({ onClose, currentUserId }: Props) {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Confirm-state per action.
  const [banTarget, setBanTarget] = useState<PlatformUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banBusy, setBanBusy] = useState(false);
  const [unbanTarget, setUnbanTarget] = useState<PlatformUser | null>(null);
  const [unbanBusy, setUnbanBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<PlatformUser | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
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
      const params: ListUsersParams = {};
      const q = search.trim();
      if (q) params.q = q;
      if (filter === "banned") params.banned = "true";
      if (filter === "active") params.banned = "false";
      const res = await listPlatformUsers(params);
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить список пользователей.");
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const replaceUser = useCallback((u: PlatformUser) => {
    setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));
  }, []);

  // === Actions ===
  const submitBan = async () => {
    if (!banTarget) return;
    const reason = banReason.trim();
    if (reason.length === 0) {
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

  const copyTempPw = async () => {
    if (!tempPwShown) return;
    try {
      await navigator.clipboard.writeText(tempPwShown.pw);
      setTempPwCopied(true);
    } catch {
      setTempPwCopied(false);
    }
  };

  // === Render ===
  return (
    <Modal title="Platform Admin — пользователи" onClose={onClose} width={920}>
      <div className="ec-platform-admin">
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
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              className="ec-cck-filter"
              onClick={() => setFilter("all")}
            >
              Все
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "active"}
              className="ec-cck-filter"
              onClick={() => setFilter("active")}
            >
              Активные
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "banned"}
              className="ec-cck-filter"
              onClick={() => setFilter("banned")}
            >
              Забанены
            </button>
          </div>
          <div className="ec-platform-admin__meta">
            {loading ? "Загрузка…" : `${total} пользователей`}
          </div>
        </div>

        {error && <div className="ec-cck-banner">{error}</div>}

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
                  const isBanned = u.bannedAt !== null;
                  const isOtherOwner = u.isPlatformOwner && !isSelf;
                  return (
                    <tr key={u.id} className="ec-cck-row">
                      <td className="ec-cck-cell">
                        <div className="ec-platform-admin__user">
                          <Avatar
                            name={u.displayName}
                            url={u.avatar}
                            size={28}
                          />
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
                        {isBanned ? (
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
                        {isBanned ? (
                          <button
                            type="button"
                            className="ec-btn ec-btn--sm"
                            onClick={() => {
                              setActionError(null);
                              setUnbanTarget(u);
                            }}
                            disabled={isSelf || isOtherOwner}
                          >
                            Снять бан
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ec-btn ec-btn--sm ec-btn--danger"
                            onClick={() => {
                              setActionError(null);
                              setBanReason("");
                              setBanTarget(u);
                            }}
                            disabled={isSelf || isOtherOwner}
                            title={
                              isSelf
                                ? "Нельзя забанить себя"
                                : isOtherOwner
                                  ? "Нельзя забанить другого platform-owner'а"
                                  : undefined
                            }
                          >
                            Забанить
                          </button>
                        )}
                        <button
                          type="button"
                          className="ec-btn ec-btn--sm"
                          onClick={() => {
                            setActionError(null);
                            setResetTarget(u);
                          }}
                          disabled={isSelf || isOtherOwner}
                          title={
                            isSelf
                              ? "Используй обычный flow смены пароля"
                              : isOtherOwner
                                ? "Нельзя сбросить пароль другого platform-owner'а"
                                : undefined
                          }
                        >
                          Сбросить пароль
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
            Login будет отклоняться. Активные WS-сессии будут закрыты, refresh-
            токены отозваны. Действие обратимо через «Снять бан».
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
            покажется один раз — передашь юзеру вне платформы (Telegram /
            звонок / лично).
          </p>
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
    </Modal>
  );
}
