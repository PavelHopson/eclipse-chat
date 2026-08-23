type Props = {
  onNewMessage: () => void;
};

export function DirectMessageWelcome({ onNewMessage }: Props) {
  return (
    <section className="ec-dm-welcome" aria-labelledby="dm-welcome-title">
      <div className="ec-dm-welcome__mark" aria-hidden>
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 7.5h20v13H13l-7 5v-18Z" />
          <path d="M11 13h10M11 17h6" />
        </svg>
      </div>
      <div className="ec-dm-welcome__copy">
        <p>Личные сообщения</p>
        <h1 id="dm-welcome-title">Продолжите разговор</h1>
        <span>Выберите диалог слева или начните новую переписку.</span>
      </div>
      <button type="button" className="ec-btn ec-btn--primary" onClick={onNewMessage}>
        Написать сообщение
      </button>
    </section>
  );
}
