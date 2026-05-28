type Props = {
  pendingCount: number;
  active: boolean;
  onOpen: () => void;
};

export function FriendsPanel({ pendingCount, active, onOpen }: Props) {
  return (
    <button
      type="button"
      className={`ec-friends-panel${active ? " is-active" : ""}${pendingCount > 0 ? " is-pending" : ""}`}
      onClick={onOpen}
      aria-current={active ? "page" : undefined}
    >
      <span className="ec-friends-panel__icon" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 11a4 4 0 1 0-8 0" />
          <path d="M4 21a8 8 0 0 1 16 0" />
          <path d="M20 8v5" />
          <path d="M22.5 10.5h-5" />
        </svg>
      </span>
      <span className="ec-friends-panel__text">
        <strong>Друзья</strong>
        <span>Запросы и контакты</span>
      </span>
      {pendingCount > 0 && (
        <span className="ec-friends-panel__badge" aria-label={`Входящих запросов: ${pendingCount}`}>
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </button>
  );
}
