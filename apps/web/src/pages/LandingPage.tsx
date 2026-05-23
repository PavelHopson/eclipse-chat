import { EclipseGalaxy } from "../components/EclipseGalaxy";

type Props = {
  onOpenAuth: (mode: "login" | "register") => void;
};

const SURFACES = [
  {
    title: "Живые каналы команды",
    body: "Чаты, голос и быстрые сигналы живут в одном ритме, а не разъезжаются по разным сервисам.",
    tone: "voice",
    icon: VoiceIcon,
  },
  {
    title: "Исполнение без потерь",
    body: "Задачи, дедлайны и ответственные всегда рядом с обсуждением, а не теряются между чатами и досками.",
    tone: "ops",
    icon: GridIcon,
  },
  {
    title: "Контекст остаётся в системе",
    body: "История, решения, файлы и поручения собираются в один операционный контур команды.",
    tone: "memory",
    icon: MemoryIcon,
  },
] as const;

const LANES = [
  "Рабочие чаты",
  "Задачи и исполнение",
  "Голосовые комнаты",
  "Клиентские порталы",
] as const;

const FLOW = [
  {
    label: "Шаг 1",
    title: "Команда заходит в единый контур",
    body: "Один вход открывает чат, задачи, голос и общую память без прыжков по вкладкам.",
  },
  {
    label: "Шаг 2",
    title: "Сигнал сразу превращается в действие",
    body: "Из обсуждения появляется задача, владелец и дедлайн — прямо в том же рабочем потоке.",
  },
  {
    label: "Шаг 3",
    title: "Контекст остаётся доступным",
    body: "Новый участник видит не только сообщения, но и весь операционный след решения.",
  },
] as const;

export function LandingPage({ onOpenAuth }: Props) {
  const brandMarkUrl = `${import.meta.env.BASE_URL}brand-mark.svg`;

  return (
    <main className="ec-landing" aria-label="Eclipse Chat — лендинг">
      <EclipseGalaxy variant="home" className="ec-landing__galaxy" />
      <div className="ec-landing__mesh" aria-hidden />

      <header className="ec-landing__nav">
        <div className="ec-landing__brand">
          <span className="ec-landing__brand-mark">
            <img src={brandMarkUrl} alt="" decoding="async" />
          </span>
          <div className="ec-landing__brand-copy">
            <strong>Eclipse Chat</strong>
            <span>операционная платформа команды</span>
          </div>
        </div>

        <div className="ec-landing__nav-actions">
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--ghost"
            onClick={() => onOpenAuth("login")}
          >
            Вход
          </button>
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--primary"
            onClick={() => onOpenAuth("register")}
          >
            Запустить рабочий контур
          </button>
        </div>
      </header>

      <section className="ec-landing__hero">
        <div className="ec-landing__hero-copy">
          <div className="ec-landing__kicker">ECLIPSE CHAT</div>
          <h1>Чат, задачи, голос и клиентские порталы в одной командной консоли.</h1>
          <p>
            Eclipse Chat собирает рабочий ритм команды в единый интерфейс: обсуждение,
            исполнение, память и доступ клиентов больше не живут в разных продуктах.
          </p>

          <div className="ec-landing__hero-actions">
            <button
              type="button"
              className="ec-landing-btn ec-landing-btn--primary"
              onClick={() => onOpenAuth("login")}
            >
              Открыть вход
            </button>
            <button
              type="button"
              className="ec-landing-btn ec-landing-btn--secondary"
              onClick={() => onOpenAuth("register")}
            >
              Создать рабочий аккаунт
            </button>
          </div>

          <div className="ec-landing__lane-row" aria-hidden>
            {LANES.map((lane) => (
              <span key={lane} className="ec-landing__lane-chip">
                {lane}
              </span>
            ))}
          </div>
        </div>

        <aside className="ec-landing__hero-stage" aria-label="Операционный контур Eclipse Chat">
          <div className="ec-landing-stage">
            <div className="ec-landing-stage__hud">
              <span>СЕТЬ ECLIPSE</span>
              <span>операционный протокол</span>
            </div>

            <div className="ec-landing-stage__frame">
              <div className="ec-landing-stage__ring" aria-hidden />
              <div className="ec-landing-stage__core">
                <img src={brandMarkUrl} alt="" decoding="async" />
              </div>
              <div className="ec-landing-stage__beam" aria-hidden />
            </div>

            <div className="ec-landing-stage__board">
              <div className="ec-landing-stage__board-head">
                <span className="ec-landing-stage__board-pill">Контур команды</span>
                <span className="ec-landing-stage__board-status">связь активна</span>
              </div>

              <div className="ec-landing-stage__board-grid">
                <article className="ec-landing-stage__module ec-landing-stage__module--voice">
                  <small>Голос</small>
                  <strong>Сигнал в эфире</strong>
                  <span>быстрый вход в комнату и живой контекст рядом</span>
                </article>

                <article className="ec-landing-stage__module ec-landing-stage__module--ops">
                  <small>Исполнение</small>
                  <strong>Задачи в фокусе</strong>
                  <span>ответственные и статус не выпадают из разговора</span>
                </article>

                <article className="ec-landing-stage__module ec-landing-stage__module--memory">
                  <small>Память</small>
                  <strong>Контекст сохранён</strong>
                  <span>история решений, договорённости и файлы под рукой</span>
                </article>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="ec-landing__surfaces" aria-label="Ключевые поверхности платформы">
        {SURFACES.map(({ title, body, tone, icon: Icon }) => (
          <article key={title} className={`ec-landing-surface ec-landing-surface--${tone}`}>
            <span className="ec-landing-surface__icon" aria-hidden>
              <Icon />
            </span>
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="ec-landing__flow" aria-label="Как работает Eclipse Chat">
        <div className="ec-landing__section-copy">
          <div className="ec-landing__kicker">ОТ СИГНАЛА ДО ИСПОЛНЕНИЯ</div>
          <h2>Лендинг ведёт во вход, а вход сразу раскрывает рабочую форму без лишнего шага.</h2>
          <p>
            Мы оставили выразительный auth-сценарий, но встроили его в нормальный продуктовый вход:
            сначала лендинг объясняет ценность, потом CTA мгновенно раскрывает форму регистрации или входа.
          </p>
        </div>

        <div className="ec-landing__flow-grid">
          {FLOW.map((item) => (
            <article key={item.title} className="ec-landing-flow-card">
              <span className="ec-landing-flow-card__label">{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ec-landing__cta-band">
        <div>
          <div className="ec-landing__kicker">ГОТОВО К ЗАПУСКУ</div>
          <h2>Открой Eclipse Chat и зайди в командный контур уже сейчас.</h2>
        </div>

        <div className="ec-landing__cta-actions">
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--primary"
            onClick={() => onOpenAuth("login")}
          >
            Войти в Eclipse Chat
          </button>
          <button
            type="button"
            className="ec-landing-btn ec-landing-btn--ghost"
            onClick={() => onOpenAuth("register")}
          >
            Регистрация команды
          </button>
        </div>
      </section>
    </main>
  );
}

function VoiceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 4v9" />
      <path d="M8.5 8.5v2.5a3.5 3.5 0 1 0 7 0V8.5" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v3" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="4" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="14" width="7" height="7" rx="1.5" />
      <path d="M13.5 17.5h7" />
      <path d="M17 14v7" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 5.5h12" />
      <path d="M6 18.5h12" />
      <rect x="4" y="8" width="16" height="8" rx="2" />
      <path d="M8 8v8" />
      <path d="M16 8v8" />
      <path d="M10.5 11h3" />
      <path d="M10.5 13h3" />
    </svg>
  );
}
