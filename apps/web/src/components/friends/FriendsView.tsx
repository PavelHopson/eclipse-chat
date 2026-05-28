import { useState } from "react";
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

function statusClass(friendship: FriendshipDto): string {
  const status = friendship.other.manualStatus;
  if (status === "INVISIBLE") return "is-offline";
  return `is-${status.toLowerCase()}`;
}

function sectionTitle(count: number, label: string): string {
  return count > 0 ? `${label} · ${count}` : label;
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
  const [addOpen, setAddOpen] = useState(false);
  const [action, setAction] = useState<ActionState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const total = accepted.length + pendingIn.length + pendingOut.length + blocked.length;

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

      {error && (
        <div className="ec-friend-load-error">
          <span>Не удалось загрузить друзей.</span>
          <button type="button" className="ec-btn ec-btn--sm" onClick={onRetry}>
            Повторить
          </button>
        </div>
      )}
      {actionError && <p className="ec-friend-form-error">{actionError}</p>}
      {isLoading && total === 0 ? (
        <SkeletonRows />
      ) : (
        <div className="ec-friends-view__sections">
          <section className="ec-friend-section">
            <h3>{sectionTitle(pendingIn.length, "Входящие запросы")}</h3>
            {pendingIn.length ? pendingIn.map((f) => row(f, "pendingIn")) : <EmptyLine>Новых запросов нет.</EmptyLine>}
          </section>
          <section className="ec-friend-section">
            <h3>{sectionTitle(accepted.length, "Друзья")}</h3>
            {accepted.length ? accepted.map((f) => row(f, "accepted")) : <EmptyLine>У вас пока нет друзей. Добавьте первого.</EmptyLine>}
          </section>
          <section className="ec-friend-section">
            <h3>{sectionTitle(pendingOut.length, "Исходящие")}</h3>
            {pendingOut.length ? pendingOut.map((f) => row(f, "pendingOut")) : <EmptyLine>Нет отправленных запросов.</EmptyLine>}
          </section>
          <section className="ec-friend-section">
            <h3>{sectionTitle(blocked.length, "Заблокированные")}</h3>
            {blocked.length ? blocked.map((f) => row(f, "blocked")) : <EmptyLine>Список блокировок пуст.</EmptyLine>}
          </section>
        </div>
      )}

      {addOpen && (
        <AddFriendDialog
          onClose={() => setAddOpen(false)}
          onSend={onSendRequest}
        />
      )}
    </div>
  );
}
