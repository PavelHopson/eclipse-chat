import { useEffect, useMemo, useState } from "react";
import type { ChannelRow } from "../hooks/useChannels";
import { apiJson, apiPath } from "../lib/api";
import { useConfirm } from "./ConfirmDialog";

type Integration = {
  id: string;
  type: "TELEGRAM_OUTGOING" | "GITHUB_WEBHOOK";
  name: string;
  channelId: string | null;
  enabled: boolean;
  repository: string | null;
  lastEventAt: string | null;
  eventCount: number;
};

type Setup = {
  integration: Integration;
  github: { webhookPath: string; webhookSecret: string };
};

type Props = { serverId: string; channels: ChannelRow[] };

const REPOSITORY_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

function channelName(channels: ChannelRow[], id: string | null): string {
  return channels.find((channel) => channel.id === id)?.name ?? "Комната недоступна";
}

export function AdminGitHubTab({ serverId, channels }: Props) {
  const confirm = useConfirm();
  const targetChannels = useMemo(
    () => channels.filter((channel) => channel.type !== "VOICE"),
    [channels],
  );
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [repository, setRepository] = useState("");
  const [name, setName] = useState("GitHub Operations");
  const [channelId, setChannelId] = useState(targetChannels[0]?.id ?? "");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [copyState, setCopyState] = useState<"url" | "secret" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setError(null);
    apiJson<{ integrations: Integration[] }>(`/api/servers/${encodeURIComponent(serverId)}/integrations`)
      .then((data) => {
        if (active) setIntegrations(data.integrations.filter((item) => item.type === "GITHUB_WEBHOOK"));
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Не удалось загрузить GitHub Rooms");
      });
    return () => {
      active = false;
    };
  }, [serverId]);

  useEffect(() => {
    if (!channelId && targetChannels[0]) setChannelId(targetChannels[0].id);
  }, [channelId, targetChannels]);

  const webhookUrl = setup
    ? new URL(apiPath(`api/integrations/gh/${setup.github.webhookPath}`), window.location.origin).toString()
    : "";

  const copy = async (value: string, key: "url" | "secret") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(key);
      window.setTimeout(() => setCopyState(null), 1800);
    } catch {
      setError("Браузер не разрешил копирование. Выделите значение вручную.");
    }
  };

  const create = async () => {
    const normalizedRepository = repository.trim();
    if (!REPOSITORY_RE.test(normalizedRepository)) {
      setError("Укажите репозиторий как owner/repository, например PavelHopson/eclipse-chat.");
      return;
    }
    if (!channelId) {
      setError("Выберите комнату для GitHub-событий.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await apiJson<Setup>(`/api/servers/${encodeURIComponent(serverId)}/integrations`, {
        method: "POST",
        body: JSON.stringify({
          type: "GITHUB_WEBHOOK",
          name: name.trim() || "GitHub Operations",
          repository: normalizedRepository,
          channelId,
        }),
      });
      setSetup(result);
      setIntegrations((current) => [result.integration, ...(current ?? [])]);
      setRepository("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать GitHub Room");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (integration: Integration) => {
    setError(null);
    try {
      const result = await apiJson<{ integration: Integration }>(`/api/integrations/${encodeURIComponent(integration.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !integration.enabled }),
      });
      setIntegrations((current) => current?.map((item) => item.id === integration.id ? result.integration : item) ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить GitHub Room");
    }
  };

  const remove = async (integration: Integration) => {
    const accepted = await confirm({
      title: "Удалить GitHub Room?",
      message: "Новые события перестанут поступать. Уже опубликованные карточки останутся в истории.",
      confirmLabel: "Удалить интеграцию",
      danger: true,
    });
    if (!accepted) return;
    try {
      await apiJson(`/api/integrations/${encodeURIComponent(integration.id)}`, { method: "DELETE" });
      setIntegrations((current) => current?.filter((item) => item.id !== integration.id) ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить GitHub Room");
    }
  };

  return (
    <section className="ec-github-admin">
      <div className="ec-github-admin__intro">
        <div>
          <span className="ec-admin-card-label">Verified room events</span>
          <h3>GitHub Rooms</h3>
          <p>Commit, pull request, CI, release и deploy появляются в выбранной комнате как проверенные события со ссылкой на источник.</p>
        </div>
        <span className="ec-github-admin__signal">HMAC · replay guard · repository lock</span>
      </div>

      {error && <div className="ec-github-admin__alert" role="alert">{error}</div>}

      {setup && (
        <div className="ec-github-setup" role="status">
          <div className="ec-github-setup__heading">
            <div>
              <span>Подключение создано</span>
              <h4>Добавьте webhook в GitHub</h4>
            </div>
            <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => setSetup(null)}>Закрыть</button>
          </div>
          <label>
            Payload URL
            <span className="ec-github-setup__value"><code>{webhookUrl}</code><button type="button" onClick={() => void copy(webhookUrl, "url")}>{copyState === "url" ? "Скопировано" : "Копировать URL"}</button></span>
          </label>
          <label>
            Secret · показывается один раз
            <span className="ec-github-setup__value"><code>{setup.github.webhookSecret}</code><button type="button" onClick={() => void copy(setup.github.webhookSecret, "secret")}>{copyState === "secret" ? "Скопировано" : "Копировать Secret"}</button></span>
          </label>
          <div className="ec-github-setup__actions">
            <a className="ec-btn ec-btn--primary" href={`https://github.com/${setup.integration.repository}/settings/hooks/new`} target="_blank" rel="noreferrer noopener">Открыть настройку webhook ↗</a>
            <span>Content type: application/json · выберите Send me everything</span>
          </div>
        </div>
      )}

      <div className="ec-github-admin__grid">
        <div className="ec-github-create">
          <div><span className="ec-admin-card-label">Новое подключение</span><h4>Направить GitHub в комнату</h4></div>
          <label>Репозиторий<input className="ec-input" value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" autoComplete="off" /></label>
          <label>Название<input className="ec-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
          <label>Комната<select className="ec-input" value={channelId} onChange={(event) => setChannelId(event.target.value)} disabled={targetChannels.length === 0}><option value="">Выберите комнату</option>{targetChannels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>)}</select></label>
          <button type="button" className="ec-btn ec-btn--primary" disabled={saving || targetChannels.length === 0} onClick={() => void create()}>{saving ? "Создаём защищённый webhook…" : "Создать GitHub Room"}</button>
          {targetChannels.length === 0 && <p className="ec-github-create__hint">Сначала создайте текстовую или execution-комнату.</p>}
        </div>

        <div className="ec-github-list">
          <div><span className="ec-admin-card-label">Активные подключения</span><h4>{integrations?.length ?? 0} GitHub Rooms</h4></div>
          {integrations === null && !error && <div className="ec-github-list__empty">Загружаем подключения…</div>}
          {integrations?.length === 0 && <div className="ec-github-list__empty"><strong>GitHub пока не подключён</strong><span>Заполните три поля слева. Следующее действие уже выделено.</span></div>}
          {integrations?.map((integration) => (
            <article className="ec-github-integration" key={integration.id}>
              <div className="ec-github-integration__top"><div><strong>{integration.repository ?? integration.name}</strong><span># {channelName(channels, integration.channelId)}</span></div><span className={integration.enabled ? "is-active" : "is-paused"}>{integration.enabled ? "Принимает события" : "На паузе"}</span></div>
              <div className="ec-github-integration__stats"><span>{integration.eventCount} событий</span><span>{integration.lastEventAt ? `Последнее ${new Date(integration.lastEventAt).toLocaleString("ru-RU")}` : "Ждём первое событие"}</span></div>
              <div className="ec-github-integration__actions"><button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => void toggle(integration)}>{integration.enabled ? "Поставить на паузу" : "Возобновить события"}</button><button type="button" className="ec-btn ec-btn--danger ec-btn--sm" onClick={() => void remove(integration)}>Удалить</button></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
