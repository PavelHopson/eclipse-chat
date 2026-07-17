import "../styles/clean-ui.css";
import { resolveAssetUrl } from "../lib/assets";
import { serverBannerGradient } from "../lib/serverBanner";
import { depthTiltProps } from "../lib/tilt";
import { parseServerFeatures } from "../lib/serverFeatures";
import type { ServerRow } from "../hooks/useServers";
import type { ChannelRow } from "../hooks/useChannels";
import type { MemberRow } from "../hooks/useMembers";
import type { ActionItemPayload } from "../lib/socket";
import { Avatar } from "./Avatar";
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
  unread?: Record<string, number>;
  voiceByChannel?: Record<string, string[]>;
  members?: MemberRow[];
  actions?: ActionItemPayload[];
  actionsLoading?: boolean;
  currentUserId?: string;
  onOpenStatusBoard?: () => void;
  onOpenMembers?: () => void;
  onOpenSearch?: () => void;
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

function isActionOpen(action: ActionItemPayload): boolean {
  return action.status !== "DONE";
}

function isActionHot(action: ActionItemPayload, now: number): boolean {
  if (action.priority === "URGENT" || action.priority === "HIGH") return true;
  if (!action.dueAt) return false;
  return new Date(action.dueAt).getTime() < now + 1000 * 60 * 60 * 24;
}

function actionTypeLabel(type: ActionItemPayload["type"]): string {
  if (type === "DECISION") return "решение";
  if (type === "FOLLOW_UP") return "follow-up";
  return "задача";
}

export function ServerWelcomeHero({
  server,
  channels,
  onSelectChannel,
  unread = {},
  voiceByChannel = {},
  members = [],
  actions = [],
  actionsLoading = false,
  currentUserId,
  onOpenStatusBoard,
  onOpenMembers,
  onOpenSearch,
}: Props) {
  const bannerUrl = server.banner ? resolveAssetUrl(server.banner) : null;
  const iconUrl = server.icon ? resolveAssetUrl(server.icon) : null;
  const guide = parseGuideDescription(server.description);
  const featureChips = parseServerFeatures(server.features);
  const now = Date.now();
  const memberByUserId = new Map(members.map((member) => [member.userId, member]));
  const featured = channels
    .filter((c) => c.type === "TEXT" || c.type === "BROADCAST" || c.type === "EXECUTION")
    .slice(0, MAX_FEATURED);
  const activeVoiceRooms = channels
    .filter((channel) => channel.type === "VOICE")
    .map((channel) => ({
      channel,
      userIds: voiceByChannel[channel.id] ?? [],
    }))
    .filter((room) => room.userIds.length > 0)
    .sort((a, b) => b.userIds.length - a.userIds.length || a.channel.position - b.channel.position)
    .slice(0, 3);
  const currentVoiceRoom = currentUserId
    ? activeVoiceRooms.find((room) => room.userIds.includes(currentUserId))
    : null;
  const unreadRooms = channels
    .map((channel) => ({ channel, count: unread[channel.id] ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.channel.position - b.channel.position)
    .slice(0, 4);
  const openActions = actions.filter(isActionOpen);
  const myActions = currentUserId
    ? openActions.filter((action) => action.assignee?.id === currentUserId)
    : [];
  const hotActions = openActions.filter((action) => isActionHot(action, now));
  const nextChannel =
    currentVoiceRoom?.channel ??
    activeVoiceRooms[0]?.channel ??
    unreadRooms[0]?.channel ??
    featured[0] ??
    channels.find((channel) => channel.type !== "VOICE") ??
    channels[0] ??
    null;
  const primaryLabel = currentVoiceRoom
    ? "Вернуться в эфир"
    : activeVoiceRooms.length > 0
    ? "Зайти в активный голос"
    : unreadRooms.length > 0
    ? "Открыть непрочитанное"
    : nextChannel
    ? `Открыть ${nextChannel.name}`
    : "Создать первую комнату";
  const primaryHint = currentVoiceRoom
    ? `Ты уже в комнате «${currentVoiceRoom.channel.name}».`
    : activeVoiceRooms.length > 0
    ? `${activeVoiceRooms[0].userIds.length} в «${activeVoiceRooms[0].channel.name}».`
    : unreadRooms.length > 0
    ? `${unreadRooms[0].count} новых в «${unreadRooms[0].channel.name}».`
    : nextChannel
    ? "Без выбора из десяти пунктов — начни отсюда."
    : "Пространство пустое. Нужна первая комната.";

  return (
    <section className="ec-guide">
      <div className="ec-guide__inner">
        <div
          className={"ec-guide__banner" + (bannerUrl ? "" : " ec-guide__banner--fallback")}
          style={{
            backgroundImage: bannerUrl
              ? `url("${bannerUrl}")`
              : serverBannerGradient(server),
          }}
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
          <div className="ec-guide__main">
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
                <strong>{openActions.length}</strong>
                открыто
              </span>
              <span>
                <strong>{activeVoiceRooms.length}</strong>
                эфиров
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
          </div>

          <aside className="ec-guide__quick" aria-label="Быстрые действия пространства">
            <div className="ec-guide__operator">
              <div>
                <div className="ec-guide__quick-label">Следующий шаг</div>
                <h2>{primaryLabel}</h2>
                <p>{primaryHint}</p>
              </div>
              {nextChannel ? (
                <button
                  type="button"
                  className="ec-guide__primary"
                  onClick={() => onSelectChannel(nextChannel.id)}
                >
                  {primaryLabel}
                </button>
              ) : (
                <button type="button" className="ec-guide__primary" disabled>
                  Нет комнат
                </button>
              )}
            </div>

            <div className="ec-guide__signal-grid">
              <button type="button" onClick={onOpenStatusBoard} disabled={!onOpenStatusBoard} className="ec-guide__signal">
                <strong>{actionsLoading ? "…" : openActions.length}</strong>
                <span>дел в работе</span>
              </button>
              <button type="button" onClick={onOpenStatusBoard} disabled={!onOpenStatusBoard} className="ec-guide__signal">
                <strong>{hotActions.length}</strong>
                <span>срочных</span>
              </button>
              <button type="button" onClick={onOpenMembers} disabled={!onOpenMembers} className="ec-guide__signal">
                <strong>{members.length || server.memberCount}</strong>
                <span>людей</span>
              </button>
              <button type="button" onClick={onOpenSearch} disabled={!onOpenSearch} className="ec-guide__signal">
                <strong>⌘K</strong>
                <span>найти всё</span>
              </button>
            </div>

            {activeVoiceRooms.length > 0 && (
              <div className="ec-guide__panel">
                <div className="ec-guide__panel-head">
                  <span>Сейчас говорят</span>
                  <span>{activeVoiceRooms.reduce((sum, room) => sum + room.userIds.length, 0)}</span>
                </div>
                <div className="ec-guide__voice-list">
                  {activeVoiceRooms.map(({ channel, userIds }) => (
                    <button
                      key={channel.id}
                      type="button"
                      className="ec-guide__voice-room"
                      onClick={() => onSelectChannel(channel.id)}
                    >
                      <span className="ec-guide__voice-main">
                        <ChannelGlyph type={channel.type} icon={channel.emoji} size={14} />
                        <span>{channel.name}</span>
                      </span>
                      <span className="ec-guide__voice-avatars" aria-hidden>
                        {userIds.slice(0, 4).map((userId) => {
                          const member = memberByUserId.get(userId);
                          const name = member?.user.displayName ?? userId;
                          return (
                            <Avatar
                              key={userId}
                              url={member?.user.avatar ?? null}
                              name={name}
                              size={22}
                            />
                          );
                        })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {unreadRooms.length > 0 && (
              <div className="ec-guide__panel">
                <div className="ec-guide__panel-head">
                  <span>Нужно посмотреть</span>
                  <span>{unreadRooms.reduce((sum, item) => sum + item.count, 0)}</span>
                </div>
                <div className="ec-guide__todo-list">
                  {unreadRooms.map(({ channel, count }) => (
                    <button
                      key={channel.id}
                      type="button"
                      className="ec-guide__todo-row"
                      onClick={() => onSelectChannel(channel.id)}
                    >
                      <span>
                        <ChannelGlyph type={channel.type} icon={channel.emoji} size={14} />
                        {channel.name}
                      </span>
                      <strong>{count > 99 ? "99+" : count}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(myActions.length > 0 || openActions.length > 0) && (
              <div className="ec-guide__panel">
                <div className="ec-guide__panel-head">
                  <span>Рабочий контур</span>
                  <span>{myActions.length > 0 ? `${myActions.length} мои` : `${openActions.length} открыто`}</span>
                </div>
                <div className="ec-guide__todo-list">
                  {(myActions.length > 0 ? myActions : openActions).slice(0, 3).map((action) => {
                    const channel = channels.find((item) => item.id === action.channelId);
                    return (
                      <button
                        key={action.id}
                        type="button"
                        className="ec-guide__todo-row ec-guide__todo-row--action"
                        onClick={onOpenStatusBoard}
                        disabled={!onOpenStatusBoard}
                      >
                        <span>
                          <small>{actionTypeLabel(action.type)}</small>
                          {action.title}
                        </span>
                        <em>{channel?.name ?? "доска"}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {featured.length > 0 && (
              <>
                <div className="ec-guide__quick-label">Комнаты для старта</div>
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
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
