type Hotkey = {
  keys: string[];
  label: string;
  scope: string;
};

const HOTKEYS: Hotkey[] = [
  { keys: ["Ctrl", "K"], label: "Открыть поиск", scope: "Глобально, также Cmd+K на macOS" },
  { keys: ["Enter"], label: "Отправить сообщение", scope: "Поле ввода сообщения" },
  { keys: ["Shift", "Enter"], label: "Новая строка", scope: "Поле ввода сообщения" },
  { keys: ["@"], label: "Подсказка упоминаний", scope: "Поле ввода сообщения" },
  { keys: [":emoji:"], label: "Подсказка emoji", scope: "Поле ввода сообщения" },
  { keys: ["/task"], label: "Создать задачу из сообщения", scope: "Канал с operator-командами" },
  { keys: ["Esc"], label: "Закрыть модал или popover", scope: "Модальные окна и меню" },
  { keys: ["Ctrl", "Shift", "`"], label: "Сетевая диагностика voice", scope: "Голосовая комната" },
];

export function HotkeysSection() {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Горячие клавиши</span>
        <h2>Подтверждённые сочетания</h2>
        <p>Read-only список: показаны только сочетания, которые уже обрабатываются в коде Eclipse Chat.</p>
      </header>

      <section className="ec-settings-card ec-settings-card--stack">
        <div className="ec-hotkeys-list">
          {HOTKEYS.map((hotkey) => (
            <article className="ec-hotkey-row" key={`${hotkey.keys.join("+")}-${hotkey.label}`}>
              <div className="ec-hotkey-row__keys" aria-label={hotkey.keys.join(" + ")}>
                {hotkey.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </div>
              <div className="ec-settings-card__body">
                <strong>{hotkey.label}</strong>
                <span className="ec-settings-muted">{hotkey.scope}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
