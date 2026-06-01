import "../styles/clean-ui.css";
import { resolveAssetUrl } from "../lib/assets";
import type { ServerRow } from "../hooks/useServers";
import type { ChannelRow } from "../hooks/useChannels";
import { ChannelGlyph } from "./icons/ChannelCustomIcons";

/**
 * Server guide («Путеводитель») — показывается когда канал не выбран.
 *
 * Clean redesign (IA reset): баннер — контейнерная шапка (не full-bleed за
 * текстом), иконка + имя + meta, описание читаемой колонкой (max-width),
 * welcome-callout, быстрые входы карточками. Без наслоений и sci-fi-театра.
 * Стили — clean-ui.css (.ec-guide*).
 */

type Props = {
  server: ServerRow;
  channels: ChannelRow[];
  onSelectChannel: (id: string) => void;
};

const MAX_FEATURED = 6;

function pluralMembers(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "участник";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "участника";
  return "участников";
}

export function ServerWelcomeHero({ server, channels, onSelectChannel }: Props) {
  const bannerUrl = server.banner ? resolveAssetUrl(server.banner) : null;
  const iconUrl = server.icon ? resolveAssetUrl(server.icon) : null;
  const featured = channels
    .filter((c) => c.type === "TEXT" || c.type === "BROADCAST" || c.type === "EXECUTION")
    .slice(0, MAX_FEATURED);

  return (
    <section className="ec-guide">
      <div className="ec-guide__inner">
        <div
          className={"ec-guide__banner" + (bannerUrl ? "" : " ec-guide__banner--fallback")}
          style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : undefined}
          aria-hidden
        />
        <div className="ec-guide__head">
          <div className="ec-guide__icon" aria-hidden>
            {iconUrl ? (
              <img
                src={iconUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (server.name?.[0] ?? "•").toUpperCase()
            )}
          </div>
          <div className="ec-guide__title-wrap">
            <h1 className="ec-guide__name">{server.name}</h1>
            <div className="ec-guide__meta">
              <span className="dot" aria-hidden />
              {server.memberCount} {pluralMembers(server.memberCount)}
            </div>
          </div>
        </div>

        <div className="ec-guide__body">
          {server.description && <p className="ec-guide__desc">{server.description}</p>}
          {server.welcomeMessage && (
            <div className="ec-guide__welcome">{server.welcomeMessage}</div>
          )}
          {featured.length > 0 && (
            <div className="ec-guide__quick">
              <div className="ec-guide__quick-label">Быстрые входы</div>
              <div className="ec-guide__quick-grid">
                {featured.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className="ec-guide__card"
                    onClick={() => onSelectChannel(ch.id)}
                  >
                    <span className="ec-guide__card-glyph">
                      <ChannelGlyph type={ch.type} icon={ch.emoji} size={15} />
                    </span>
                    <span>{ch.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
