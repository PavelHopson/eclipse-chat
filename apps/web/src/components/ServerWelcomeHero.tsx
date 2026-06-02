import "../styles/clean-ui.css";
import { resolveAssetUrl } from "../lib/assets";
import { depthTiltProps } from "../lib/tilt";
import { parseServerFeatures } from "../lib/serverFeatures";
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
const KNOWN_HEADINGS = ["созда", "обсуж", "подход", "ссыл", "правил"];

type GuideSection = {
  title: string;
  items: string[];
};

function pluralMembers(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "участник";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "участника";
  return "участников";
}

function normalizeGuideLine(line: string): string {
  return line.replace(/^[—\-•]\s*/, "").trim();
}

function isSectionHeading(line: string): boolean {
  const text = line.trim();
  if (!text.endsWith(":")) return false;
  if (text.length > 64) return false;
  const lower = text.toLowerCase();
  return KNOWN_HEADINGS.some((part) => lower.includes(part)) || /^[\p{L}\s]+:$/u.test(text);
}

function parseGuideDescription(description: string | null | undefined): {
  intro: string[];
  sections: GuideSection[];
} {
  const lines = (description ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const intro: string[] = [];
  const sections: GuideSection[] = [];
  let current: GuideSection | null = null;

  for (const line of lines) {
    if (isSectionHeading(line)) {
      current = { title: line.replace(/:$/, ""), items: [] };
      sections.push(current);
      continue;
    }

    const item = normalizeGuideLine(line);
    if (current) {
      current.items.push(item);
    } else {
      intro.push(item);
    }
  }

  return {
    intro,
    sections: sections.filter((section) => section.items.length > 0),
  };
}

export function ServerWelcomeHero({ server, channels, onSelectChannel }: Props) {
  const bannerUrl = server.banner ? resolveAssetUrl(server.banner) : null;
  const iconUrl = server.icon ? resolveAssetUrl(server.icon) : null;
  const guide = parseGuideDescription(server.description);
  const featureChips = parseServerFeatures(server.features);
  const featured = channels
    .filter((c) => c.type === "TEXT" || c.type === "BROADCAST" || c.type === "EXECUTION")
    .slice(0, MAX_FEATURED);
  const voiceCount = channels.filter((c) => c.type === "VOICE").length;
  const textCount = channels.filter((c) => c.type === "TEXT" || c.type === "BROADCAST").length;

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
          <div className="ec-guide__stats" aria-label="Сводка пространства">
            <span>
              <strong>{server.memberCount}</strong>
              участников
            </span>
            <span>
              <strong>{channels.length}</strong>
              комнат
            </span>
            <span>
              <strong>{textCount}</strong>
              текстовых
            </span>
            <span>
              <strong>{voiceCount}</strong>
              голосовых
            </span>
          </div>
          {featureChips.length > 0 && (
            <div className="ec-guide__features" aria-label="Ключевые особенности">
              {featureChips.map((feature) => (
                <span key={feature} className="ec-guide__feature">
                  {feature}
                </span>
              ))}
            </div>
          )}
          {guide.intro.length > 0 && (
            <div className="ec-guide__desc">
              {guide.intro.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
          {guide.sections.length > 0 && (
            <div className="ec-guide__sections">
              {guide.sections.map((section) => (
                <section key={section.title} className="ec-guide__section">
                  <h2>{section.title}</h2>
                  <div className="ec-guide__chips">
                    {section.items.map((item) => (
                      <span key={item} className="ec-guide__chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
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
                    className="ec-guide__card ec-depth-card"
                    onClick={() => onSelectChannel(ch.id)}
                    {...depthTiltProps}
                  >
                    <span className="ec-guide__card-glyph">
                      <ChannelGlyph type={ch.type} icon={ch.emoji} size={15} />
                    </span>
                    <span className="ec-guide__card-name">{ch.name}</span>
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
