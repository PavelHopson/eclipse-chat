import { resolveAssetUrl } from "../lib/assets";
import type { ServerRow } from "../hooks/useServers";
import type { ChannelRow } from "../hooks/useChannels";
import { ChannelGlyph } from "./icons/ChannelCustomIcons";

/**
 * v1.5.34 — Server banners trek #2. Welcome hero для активного сервера
 * когда канал не выбран (раньше показывался plain EmptyState «Выберите
 * комнату»). Cinematic full-width hero с banner background (если есть),
 * gradient overlay, server name + description + welcome message + featured
 * channels grid для быстрого старта.
 *
 * Без banner'а — fallback на solid radial-gradient brand-color (читается
 * не хуже, без визуального шума).
 */

type Props = {
  server: ServerRow;
  channels: ChannelRow[];
  onSelectChannel: (id: string) => void;
};

const MAX_FEATURED = 6;

export function ServerWelcomeHero({ server, channels, onSelectChannel }: Props) {
  const bannerUrl = server.banner ? resolveAssetUrl(server.banner) : null;
  // Featured = первые 6 TEXT/BROADCAST/EXECUTION каналов (voice/audio пропускаем —
  // welcome hero рассчитан на «начать общение», голос — отдельная action).
  const featured = channels
    .filter((c) => c.type === "TEXT" || c.type === "BROADCAST" || c.type === "EXECUTION")
    .slice(0, MAX_FEATURED);

  return (
    <section
      className={`ec-server-welcome${bannerUrl ? " ec-server-welcome--with-banner" : ""}`}
    >
      {bannerUrl && (
        <div
          className="ec-server-welcome__banner"
          style={{ backgroundImage: `url("${bannerUrl}")` }}
          aria-hidden
        />
      )}
      <div className="ec-server-welcome__content">
        <span className="ec-server-welcome__eyebrow">Пространство</span>
        <h1 className="ec-server-welcome__title">{server.name}</h1>
        {server.description && (
          <p className="ec-server-welcome__desc">{server.description}</p>
        )}
        {server.welcomeMessage && (
          <div className="ec-server-welcome__welcome">
            {server.welcomeMessage}
          </div>
        )}
        {featured.length > 0 && (
          <div className="ec-server-welcome__channels">
            <span className="ec-server-welcome__channels-label">
              Быстрые входы
            </span>
            <div className="ec-server-welcome__channels-grid">
              {featured.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  className="ec-server-welcome__channel-card"
                  onClick={() => onSelectChannel(ch.id)}
                >
                  <ChannelGlyph type={ch.type} icon={ch.emoji} size={14} />
                  <span>{ch.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
