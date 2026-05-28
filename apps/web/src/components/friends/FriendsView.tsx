import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { Avatar } from "../Avatar";
import type { FriendRequestInput, FriendshipDto } from "../../types/api";
import { AddFriendDialog } from "./AddFriendDialog";
import type { FriendRequestResponse } from "../../types/api";

type Props = {
  accepted: FriendshipDto[];
  pendingIn: FriendshipDto[];
  pendingOut: FriendshipDto[];
  blocked: FriendshipDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSendRequest: (input: FriendRequestInput) => Promise<FriendRequestResponse>;
  onAccept: (friendshipId: string) => Promise<unknown>;
  onRemove: (friendshipId: string) => Promise<unknown>;
  onUnblock: (userId: string) => Promise<unknown>;
  onOpenDm: (userId: string) => void;
};

type ActionState = {
  id: string;
  kind: "accept" | "remove" | "unblock";
} | null;

type TabId = "friends" | "online" | "all" | "pending";

function statusClass(friendship: FriendshipDto): string {
  const status = friendship.other.manualStatus;
  if (status === "INVISIBLE") return "is-offline";
  return `is-${status.toLowerCase()}`;
}

function sortByName(items: FriendshipDto[]): FriendshipDto[] {
  return [...items].sort((a, b) =>
    a.other.displayName.localeCompare(b.other.displayName, "ru"),
  );
}

function SkeletonRows() {
  return (
    <div className="ec-skeleton-list" aria-label="Загрузка друзей">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="ec-skeleton-row">
          <div className="ec-skeleton-row__avatar" />
          <div className="ec-skeleton-row__bars">
            <div className="ec-skeleton-row__bar" />
            <div className="ec-skeleton-row__bar ec-skeleton-row__bar--sub" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyLine({ children }: { children: string }) {
  return <p className="ec-friend-empty-line">{children}</p>;
}

function ActivityLine({ friendship }: { friendship: FriendshipDto }) {
  const { activityEmoji, activityText } = friendship.other;
  if (!activityEmoji && !activityText) return null;
  return (
    <span
      className="ec-activity-line ec-activity-line--friend"
      title={[activityEmoji, activityText].filter(Boolean).join(" ")}
    >
      {activityEmoji && <span className="ec-activity-line__emoji">{activityEmoji}</span>}
      {activityText && <span className="ec-activity-line__text">{activityText}</span>}
    </span>
  );
}

export function FriendsView({
  accepted,
  pendingIn,
  pendingOut,
  blocked,
  isLoading,
  error,
  onRetry,
  onSendRequest,
  onAccept,
  onRemove,
  onUnblock,
  onOpenDm,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("friends");
  const [addOpen, setAddOpen] = useState(false);
  const [action, setAction] = useState<ActionState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const acceptedSorted = useMemo(() => sortByName(accepted), [accepted]);
  const onlineFriends = useMemo(
    () =>
      acceptedSorted.filter((friendship) =>
        ["ONLINE", "IDLE", "DND"].includes(friendship.other.manualStatus),
      ),
    [acceptedSorted],
  );
  const blockedSorted = useMemo(() => sortByName(blocked), [blocked]);
  const pendingInSorted = useMemo(() => sortByName(pendingIn), [pendingIn]);
  const pendingOutSorted = useMemo(() => sortByName(pendingOut), [pendingOut]);
  const tabHasRows =
    activeTab === "friends"
      ? acceptedSorted.length > 0
      : activeTab === "online"
      ? onlineFriends.length > 0
      : activeTab === "all"
      ? acceptedSorted.length + blockedSorted.length > 0
      : pendingInSorted.length + pendingOutSorted.length > 0;

  const runAction = async (next: NonNullable<ActionState>, fn: () => Promise<unknown>) => {
    setAction(next);
    setActionError(null);
    try {
      await fn();
    } catch {
      setActionError("Действие не выполнено. Повторите.");
    } finally {
      setAction(null);
    }
  };

  const row = (
    friendship: FriendshipDto,
    variant: "accepted" | "pendingIn" | "pendingOut" | "blocked",
  ) => {
    const busy =
      action?.id === friendship.id ||
      (variant === "blocked" && action?.id === friendship.other.id);
    const rowButtonProps =
      variant === "accepted"
        ? {
            role: "button",
            tabIndex: 0,
            onClick: () => onOpenDm(friendship.other.id),
            onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDm(friendship.other.id);
              }
            },
          }
        : {};

    return (
      <div
        key={friendship.id}
        className={`ec-friend-row ${statusClass(friendship)}${variant === "accepted" ? " ec-friend-row--clickable" : ""}`}
        {...rowButtonProps}
      >
        <span className="ec-friend-row__avatar">
          <Avatar url={friendship.other.avatar} name={friendship.other.displayName} size={36} />
          <span className="ec-friend-presence" aria-hidden />
        </span>
        <span className="ec-friend-row__main">
          <strong>{friendship.other.displayName}</strong>
          <ActivityLine friendship={friendship} />
          <span>
            {variant === "accepted"
              ? "Друг"
              : variant === "pendingIn"
              ? "Хочет добавить вас"
              : variant === "pendingOut"
              ? "Ожидает ответа"
              : "Заблокирован вами"}
          </span>
        </span>
        <span className="ec-friend-row__actions" onClick={(e) => e.stopPropagation()}>
          {variant === "pendingIn" && (
            <>
              <button
                type="button"
                className="ec-btn ec-btn--primary ec-btn--sm"
                disabled={busy}
                onClick={() =>
                  void runAction({ id: friendship.id, kind: "accept" }, () =>
                    onAccept(friendship.id),
                  )
                }
              >
                Принять
              </button>
              <button
                type="button"
                className="ec-btn ec-btn--ghost ec-btn--sm"
                disabled={busy}
                onClick={() =>
                  void runAction({ id: friendship.id, kind: "remove" }, () =>
                    onRemove(friendship.id),
                  )
                }
              >
                Отклонить
              </button>
            </>
          )}
          {variant === "pendingOut" && (
            <button
              type="button"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              disabled={busy}
              onClick={() =>
                void runAction({ id: friendship.id, kind: "remove" }, () =>
                  onRemove(friendship.id),
                )
              }
            >
              Отменить
            </button>
          )}
          {variant === "accepted" && (
            <button
              type="button"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              disabled={busy}
              onClick={() =>
                void runAction({ id: friendship.id, kind: "remove" }, () =>
                  onRemove(friendship.id),
                )
              }
            >
              Убрать
            </button>
          )}
          {variant === "blocked" && (
            <button
              type="button"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              disabled={busy}
              onClick={() =>
                void runAction({ id: friendship.other.id, kind: "unblock" }, () =>
                  onUnblock(friendship.other.id),
                )
              }
            >
              Разблокировать
            </button>
          )}
        </span>
        <details className="ec-friend-row__menu" onClick={(e) => e.stopPropagation()}>
          <summary aria-label="Действия">⋯</summary>
          <div>
            {variant === "pendingIn" && (
              <>
                <button type="button" onClick={() => void runAction({ id: friendship.id, kind: "accept" }, () => onAccept(friendship.id))}>
                  Принять
                </button>
                <button type="button" onClick={() => void runAction({ id: friendship.id, kind: "remove" }, () => onRemove(friendship.id))}>
                  Отклонить
                </button>
              </>
            )}
            {variant === "pendingOut" && (
              <button type="button" onClick={() => void runAction({ id: friendship.id, kind: "remove" }, () => onRemove(friendship.id))}>
                Отменить
              </button>
            )}
            {variant === "accepted" && (
              <>
                <button type="button" onClick={() => onOpenDm(friendship.other.id)}>
                  Написать
                </button>
                <button type="button" onClick={() => void runAction({ id: friendship.id, kind: "remove" }, () => onRemove(friendship.id))}>
                  Убрать
                </button>
              </>
            )}
            {variant === "blocked" && (
              <button type="button" onClick={() => void runAction({ id: friendship.other.id, kind: "unblock" }, () => onUnblock(friendship.other.id))}>
                Разблокировать
              </button>
            )}
          </div>
        </details>
      </div>
    );
  };

  const tabs: Array<{ id: TabId | "add"; label: string; count?: number }> = [
    { id: "friends", label: "Друзья", count: acceptedSorted.length },
    { id: "online", label: "В сети", count: onlineFriends.length },
    { id: "all", label: "Все", count: acceptedSorted.length + blockedSorted.length },
    { id: "pending", label: "Ожидание", count: pendingInSorted.length + pendingOutSorted.length },
    { id: "add", label: "Добавить" },
  ];

  const renderActiveTab = () => {
    if (isLoading && !tabHasRows) return <SkeletonRows />;

    if (activeTab === "friends") {
      return (
        <section className="ec-friend-section" role="tabpanel" id="friends-tabpanel-friends" aria-labelledby="friends-tab-friends">
          {acceptedSorted.length ? (
            acceptedSorted.map((f) => row(f, "accepted"))
          ) : (
            <EmptyLine>У вас пока нет друзей. Перейдите на «Добавить».</EmptyLine>
          )}
        </section>
      );
    }

    if (activeTab === "online") {
      return (
        <section className="ec-friend-section" role="tabpanel" id="friends-tabpanel-online" aria-labelledby="friends-tab-online">
          {onlineFriends.length ? (
            onlineFriends.map((f) => row(f, "accepted"))
          ) : (
            <EmptyLine>Сейчас никого из друзей нет в сети.</EmptyLine>
          )}
        </section>
      );
    }

    if (activeTab === "all") {
      if (acceptedSorted.length + blockedSorted.length === 0) {
        return (
          <section className="ec-friend-section" role="tabpanel" id="friends-tabpanel-all" aria-labelledby="friends-tab-all">
            <EmptyLine>У вас пока нет контактов.</EmptyLine>
          </section>
        );
      }
      return (
        <section className="ec-friend-section" role="tabpanel" id="friends-tabpanel-all" aria-labelledby="friends-tab-all">
          {acceptedSorted.map((f) => row(f, "accepted"))}
          {blockedSorted.length > 0 && (
            <>
              <div className="ec-friend-separator" role="separator">
                Заблокированные
              </div>
              {blockedSorted.map((f) => row(f, "blocked"))}
            </>
          )}
        </section>
      );
    }

    if (pendingInSorted.length + pendingOutSorted.length === 0) {
      return (
        <section className="ec-friend-section" role="tabpanel" id="friends-tabpanel-pending" aria-labelledby="friends-tab-pending">
          <EmptyLine>Нет ожидающих запросов.</EmptyLine>
        </section>
      );
    }

    return (
      <section className="ec-friend-section" role="tabpanel" id="friends-tabpanel-pending" aria-labelledby="friends-tab-pending">
        {pendingInSorted.length > 0 && (
          <>
            <div className="ec-friend-separator">Входящие</div>
            {pendingInSorted.map((f) => row(f, "pendingIn"))}
          </>
        )}
        {pendingOutSorted.length > 0 && (
          <>
            <div className="ec-friend-separator">Исходящие</div>
            {pendingOutSorted.map((f) => row(f, "pendingOut"))}
          </>
        )}
      </section>
    );
  };

  return (
    <div className="ec-friends-view">
      <header className="ec-friends-view__hero ec-holo-edge">
        <div>
          <span className="ec-friends-view__eyebrow">Личные связи</span>
          <h2>Друзья</h2>
          <p>Запросы, контакты и блокировки внутри Eclipse Chat.</p>
        </div>
        <button type="button" className="ec-btn ec-btn--primary" onClick={() => setAddOpen(true)}>
          + Добавить друга
        </button>
      </header>

      <nav className="ec-friends-tabs" role="tablist" aria-label="Фильтр друзей">
        {tabs.map((tab) => {
          const isAction = tab.id === "add";
          const active = tab.id === activeTab;
          const pendingPulse = tab.id === "pending" && pendingInSorted.length > 0;
          return (
            <button
              key={tab.id}
              id={isAction ? "friends-tab-add" : `friends-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={isAction ? undefined : `friends-tabpanel-${tab.id}`}
              className={
                "ec-friends-tab" +
                (active ? " ec-friends-tab--active" : "") +
                (isAction ? " ec-friends-tab--action" : "") +
                (pendingPulse ? " ec-friends-tab--pending" : "")
              }
              onClick={() => {
                if (tab.id === "add") {
                  setAddOpen(true);
                  return;
                }
                setActiveTab(tab.id);
              }}
            >
              {isAction && <span aria-hidden>+</span>}
              {tab.label}
              {pendingPulse ? (
                <span className="ec-friends-tab__dot" aria-label={`Входящих запросов: ${pendingInSorted.length}`} />
              ) : typeof tab.count === "number" && tab.count > 0 ? (
                <span className="ec-friends-tab__count">{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="ec-friend-load-error">
          <span>Не удалось загрузить друзей.</span>
          <button type="button" className="ec-btn ec-btn--sm" onClick={onRetry}>
            Повторить
          </button>
        </div>
      )}
      {actionError && <p className="ec-friend-form-error">{actionError}</p>}
      <div className="ec-friends-view__sections">{renderActiveTab()}</div>

      {addOpen && (
        <AddFriendDialog
          onClose={() => setAddOpen(false)}
          onSend={onSendRequest}
        />
      )}
    </div>
  );
}
