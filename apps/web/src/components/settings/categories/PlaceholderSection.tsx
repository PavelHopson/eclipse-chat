type Props = {
  eyebrow: string;
  title: string;
  version: string;
};

export function PlaceholderSection({ eyebrow, title, version }: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>Скоро в {version}</p>
      </header>
      <section className="ec-settings-empty">
        <span>Скоро в {version}</span>
      </section>
    </div>
  );
}
