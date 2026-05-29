import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "../Avatar";
import type { MemberRow } from "../../hooks/useMembers";
import { ApiError, apiJson } from "../../lib/api";

type AuditEventType =
  | "SERVER_CREATED"
  | "SERVER_DELETED"
  | "SERVER_BANNER_CHANGED"
  | "SERVER_IDENTITY_CHANGED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_KICKED"
  | "MESSAGE_DELETED_BY_MOD"
  | "CHANNEL_CREATED"
  | "CHANNEL_DELETED"
  | "BOT_CREATED"
  | "BOT_DELETED"
  | "BOT_KEY_REGENERATED";

type AuditActor = {
  id: string;
  displayName: string;
  avatar: string | null;
};

type AuditEvent = {
  id: string;
  type: AuditEventType | string;
  createdAt: string;
  metadata: string | null;
  user: AuditActor | null;
};

type AuditLogResponse = {
  events: AuditEvent[];
  total: number;
  take: number;
  skip: number;
};

type Metadata = Record<string, unknown>;

const TAKE = 25;

const AUDIT_TYPES: Array<{ id: AuditEventType; label: string }> = [
  { id: "SERVER_CREATED", label: "Сервер создан" },
  { id: "SERVER_DELETED", label: "Сервер удалён" },
  { id: "SERVER_BANNER_CHANGED", label: "Баннер изменён" },
  { id: "SERVER_IDENTITY_CHANGED", label: "Идентичность изменена" },
  { id: "MEMBER_ROLE_CHANGED", label: "Роль участника изменена" },
  { id: "MEMBER_KICKED", label: "Участник исключён" },
  { id: "MESSAGE_DELETED_BY_MOD", label: "Сообщение удалено модератором" },
  { id: "CHANNEL_CREATED", label: "Канал создан" },
  { id: "CHANNEL_DELETED", label: "Канал удалён" },
  { id: "BOT_CREATED", label: "Бот создан" },
  { id: "BOT_DELETED", label: "Бот удалён" },
  { id: "BOT_KEY_REGENERATED", label: "Ключ бота обновлён" },
];

const TYPE_LABELS = Object.fromEntries(AUDIT_TYPES.map((item) => [item.id, item.label]));

function parseMetadata(value: string | null): Metadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Metadata)
      : null;
  } catch {
    return null;
  }
}

function stringField(metadata: Metadata | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArrayField(metadata: Metadata | null, key: string): string[] {
  const value = metadata?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "только что";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} д назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function formatAbsoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function channelTarget(metadata: Metadata | null): string {
  const name = stringField(metadata, "name");
  const channelType = stringField(metadata, "type");
  const channelId = stringField(metadata, "channelId");
  if (name && channelType) return `#${name} · ${channelType}`;
  if (name) return `#${name}`;
  if (channelId) return `channel:${channelId}`;
  return "Канал не указан";
}

function botTarget(metadata: Metadata | null): string {
  const name = stringField(metadata, "name");
  const role = stringField(metadata, "role");
  const botId = stringField(metadata, "botId");
  if (name && role) return `${name} · ${role}`;
  if (name) return name;
  if (botId) return `bot:${botId}`;
  return "Бот не указан";
}

function eventTarget(event: AuditEvent, metadata: Metadata | null): string {
  switch (event.type) {
    case "CHANNEL_CREATED":
    case "CHANNEL_DELETED":
      return channelTarget(metadata);
    case "MEMBER_ROLE_CHANGED": {
      const target = stringField(metadata, "targetUserId") ?? "Участник";
      const fromRole = stringField(metadata, "fromRole");
      const toRole = stringField(metadata, "toRole");
      return fromRole && toRole ? `${target}: ${fromRole} → ${toRole}` : target;
    }
    case "MEMBER_KICKED":
      return stringField(metadata, "targetUserId") ?? "Участник не указан";
    case "SERVER_IDENTITY_CHANGED": {
      const changed = stringArrayField(metadata, "changed");
      return changed.length > 0 ? `Поля: ${changed.join(", ")}` : "Поля не указаны";
    }
    case "SERVER_BANNER_CHANGED": {
      const action = stringField(metadata, "action");
      if (action === "set") return "Баннер установлен";
      if (action === "clear") return "Баннер очищен";
      return "Баннер изменён";
    }
    case "BOT_CREATED":
    case "BOT_DELETED":
    case "BOT_KEY_REGENERATED":
      return botTarget(metadata);
    case "MESSAGE_DELETED_BY_MOD": {
      const channelId = stringField(metadata, "channelId");
      const targetUserId = stringField(metadata, "targetUserId");
      return [channelId ? `channel:${channelId}` : null, targetUserId ? `user:${targetUserId}` : null]
        .filter(Boolean)
        .join(" · ") || "Сообщение не указано";
    }
    default:
      return stringField(metadata, "serverId") ? "Сервер" : "Детали недоступны";
  }
}

function buildSinceIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildUntilIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type Props = {
  serverId: string;
  members?: MemberRow[];
};

export function ServerAuditLogSection({ serverId, members }: Props) {
  const [type, setType] = useState<AuditEventType | "">("");
  const [actorId, setActorId] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const actorOptions = useMemo(
    () =>
      (members ?? [])
        .map((member) => ({
          id: member.userId,
          name: member.user.displayName,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [members],
  );

  const load = useCallback(
    async (nextSkip: number) => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (actorId) params.set("userId", actorId);
      const sinceIso = buildSinceIso(since);
      const untilIso = buildUntilIso(until);
      if (sinceIso) params.set("since", sinceIso);
      if (untilIso) params.set("until", untilIso);
      params.set("take", String(TAKE));
      params.set("skip", String(nextSkip));

      if (nextSkip === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      const requestId = requestSeq.current + 1;
      requestSeq.current = requestId;
      try {
        const data = await apiJson<AuditLogResponse>(
          `/api/servers/${encodeURIComponent(serverId)}/audit-log?${params.toString()}`,
        );
        if (requestSeq.current !== requestId) return;
        setTotal(data.total);
        setEvents((prev) => (nextSkip === 0 ? data.events : [...prev, ...data.events]));
      } catch (err) {
        if (requestSeq.current !== requestId) return;
        if (err instanceof ApiError && err.status === 403) {
          setError("Недостаточно прав: audit-log доступен только OWNER / ADMIN.");
        } else {
          setError(err instanceof Error ? err.message : "Не удалось загрузить audit-log.");
        }
      } finally {
        if (requestSeq.current === requestId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [actorId, serverId, since, type, until],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const hasMore = events.length < total;

  return (
    <section className="ec-server-audit">
      <div className="ec-server-audit__header">
        <div>
          <h3 className="ec-hub-label">Audit log</h3>
          <p className="ec-hub-hint">
            Реальные server-scoped события. Типы без продюсеров остаются пустыми, без синтетических строк.
          </p>
        </div>
        <span className="ec-server-audit__total">{total} событий</span>
      </div>

      <div className="ec-server-audit__filters" aria-label="Фильтры audit-log">
        <label>
          <span>Тип</span>
          <select value={type} onChange={(event) => setType(event.target.value as AuditEventType | "")}>
            <option value="">Все события</option>
            {AUDIT_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Actor</span>
          <select value={actorId} onChange={(event) => setActorId(event.target.value)}>
            <option value="">Любой участник</option>
            {actorOptions.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>С даты</span>
          <input type="date" value={since} onChange={(event) => setSince(event.target.value)} />
        </label>
        <label>
          <span>По дату</span>
          <input type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
        </label>
      </div>

      {error && (
        <div className="ec-server-audit__error">
          <span>{error}</span>
          <button type="button" className="ec-btn ec-btn--sm" onClick={() => void load(0)}>
            Повторить
          </button>
        </div>
      )}

      {loading && events.length === 0 ? (
        <div className="ec-server-audit__list" aria-label="Загрузка audit-log">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="ec-server-audit-row ec-server-audit-row--skeleton" />
          ))}
        </div>
      ) : events.length === 0 && !error ? (
        <div className="ec-hub-card ec-hub-empty">
          Событий по выбранным фильтрам нет.
        </div>
      ) : (
        <div className="ec-server-audit__list">
          {events.map((event) => {
            const metadata = parseMetadata(event.metadata);
            const target = eventTarget(event, metadata);
            return (
              <article key={event.id} className="ec-server-audit-row">
                <div className="ec-server-audit-row__time" title={formatAbsoluteTime(event.createdAt)}>
                  {formatRelativeTime(event.createdAt)}
                </div>
                <div className="ec-server-audit-row__actor">
                  {event.user ? (
                    <Avatar url={event.user.avatar} name={event.user.displayName} size={28} />
                  ) : (
                    <span className="ec-server-audit-row__system" aria-hidden>
                      Σ
                    </span>
                  )}
                  <span>{event.user?.displayName ?? "Система"}</span>
                </div>
                <div className="ec-server-audit-row__main">
                  <strong>{typeLabel(event.type)}</strong>
                  <span>{target}</span>
                </div>
                <code className="ec-server-audit-row__type">{event.type}</code>
              </article>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          className="ec-btn ec-btn--ghost ec-server-audit__more"
          disabled={loadingMore}
          onClick={() => void load(events.length)}
        >
          {loadingMore ? "Загружаем…" : `Загрузить ещё · ${total - events.length}`}
        </button>
      )}
    </section>
  );
}
