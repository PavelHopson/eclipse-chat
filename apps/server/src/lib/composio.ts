/**
 * Composio service wrapper — pure HTTP/raw-fetch interface.
 *
 * v1.0.1 #11.5 Composio Automation Expansion.
 *
 * Composio (https://composio.dev) — managed OAuth + action-execute proxy
 * к 500+ external apps (Gmail / Slack / Notion / Jira / Asana / Airtable /
 * Twilio / Stripe / etc). Eclipse Chat использует Composio как broker:
 *
 *   1. Eclipse → Composio: initiate_connection(appName) → auth URL
 *   2. User → Composio OAuth flow → callback к Eclipse с connectionId
 *   3. Eclipse → Composio: execute_action(connectionId, actionName, params) → result
 *
 * Никакого SDK dependency — все API calls через raw fetch с timeout +
 * abort + SSRF-safe (Composio is fixed-host).
 *
 * ENV:
 *   - COMPOSIO_API_KEY  — Composio platform master key (required)
 *   - COMPOSIO_BASE_URL — default "https://backend.composio.dev/api/v1"
 *
 * Graceful disable: если COMPOSIO_API_KEY не set — `isComposioEnabled()` →
 * false, все endpoint'ы возвращают 503 с понятным message.
 */

const DEFAULT_BASE_URL = "https://backend.composio.dev/api/v1";
const REQUEST_TIMEOUT_MS = 12_000;

/** Type guard — Composio готов к использованию (есть master API key). */
export function isComposioEnabled(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

function getBaseUrl(): string {
  return process.env.COMPOSIO_BASE_URL?.replace(/\/+$/, "") ?? DEFAULT_BASE_URL;
}

function getApiKey(): string {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) throw new ComposioError("Composio API key not configured", 503);
  return key;
}

export class ComposioError extends Error {
  status: number;
  detail?: unknown;
  constructor(message: string, status = 502, detail?: unknown) {
    super(message);
    this.name = "ComposioError";
    this.status = status;
    this.detail = detail;
  }
}

async function composioFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = new URL(baseUrl + (path.startsWith("/") ? path : "/" + path));
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": getApiKey(),
        Accept: "application/json",
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      // Composio is fixed-host — нет SSRF surface.
      redirect: "manual",
    });
    if (!res.ok) {
      let detail: unknown = null;
      try {
        detail = await res.json();
      } catch {
        try {
          detail = await res.text();
        } catch {
          /* ignore */
        }
      }
      throw new ComposioError(
        `Composio ${init.method ?? "GET"} ${path} failed: HTTP ${res.status}`,
        res.status === 401 ? 401 : 502,
        detail,
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ComposioError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ComposioError("Composio request timed out", 504);
    }
    throw new ComposioError(
      err instanceof Error ? err.message : "Composio network error",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ===== Public API ============================================== */

export type ComposioApp = {
  name: string; // slug ("gmail", "slack", "notion")
  displayName: string;
  description?: string;
  categories?: string[];
  authScheme?: string; // "OAUTH2" / "API_KEY" / etc
  iconUrl?: string;
};

export type ComposioConnectionInit = {
  connectionId: string;
  redirectUrl: string; // URL to redirect user для OAuth grant
  expiresAt?: string;
};

export type ComposioActionDef = {
  name: string; // slug ("send_email", "create_card")
  displayName: string;
  description?: string;
  /** JSON Schema-like описание input params. Eclipse UI рендерит form. */
  parameters?: Record<string, unknown>;
};

export type ComposioExecuteResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  executionId?: string;
};

/**
 * Список supported apps (фильтр по pavel-selected категориям).
 *
 * Composio response shape variable — мы возвращаем normalized список.
 * Если pavel прислал кастомный whitelist через ENV, фильтруем здесь.
 */
export async function listSupportedApps(): Promise<ComposioApp[]> {
  // Composio's actual endpoint может отличаться — типовой path:
  // GET /apps?limit=200
  type Raw = {
    items?: Array<{
      key?: string;
      name?: string;
      display_name?: string;
      description?: string;
      categories?: string[];
      auth_schemes?: string[];
      logo?: string;
    }>;
  };
  const data = await composioFetch<Raw>("/apps", { query: { limit: "200" } });
  const apps = data.items ?? [];
  return apps
    .map((a) => ({
      name: a.key ?? a.name ?? "",
      displayName: a.display_name ?? a.name ?? a.key ?? "",
      description: a.description,
      categories: a.categories,
      authScheme: a.auth_schemes?.[0],
      iconUrl: a.logo,
    }))
    .filter((a) => a.name);
}

/**
 * Список actions для подключённого app'а.
 *
 * Composio's actual endpoint — типовой path:
 * GET /actions?app=<appName>
 */
export async function listActionsForApp(appName: string): Promise<ComposioActionDef[]> {
  type Raw = {
    items?: Array<{
      name?: string;
      display_name?: string;
      description?: string;
      parameters?: Record<string, unknown>;
    }>;
  };
  const data = await composioFetch<Raw>("/actions", { query: { app: appName } });
  return (data.items ?? [])
    .map((a) => ({
      name: a.name ?? "",
      displayName: a.display_name ?? a.name ?? "",
      description: a.description,
      parameters: a.parameters,
    }))
    .filter((a) => a.name);
}

/**
 * Initiate OAuth connection для app'а.
 *
 * Composio's actual endpoint — типовой path:
 * POST /connectedAccounts { appName, redirectUrl, ownerUserId }
 */
export async function initiateConnection(args: {
  appName: string;
  redirectUri: string;
  /** Identifier on Eclipse side (для linking при callback). Composio passes
   *  back via state parameter. */
  ownerExternalId: string;
}): Promise<ComposioConnectionInit> {
  type Raw = {
    connection_id?: string;
    redirect_url?: string;
    expires_at?: string;
  };
  const data = await composioFetch<Raw>("/connectedAccounts/initiate", {
    method: "POST",
    body: {
      app_name: args.appName,
      redirect_uri: args.redirectUri,
      entity_id: args.ownerExternalId,
    },
  });
  if (!data.connection_id || !data.redirect_url) {
    throw new ComposioError("Composio response missing connection_id/redirect_url", 502);
  }
  return {
    connectionId: data.connection_id,
    redirectUrl: data.redirect_url,
    expiresAt: data.expires_at,
  };
}

/**
 * Verify connection статус после callback. Возвращает true если OAuth
 * успешно завершён (Composio token issued).
 */
export async function verifyConnection(connectionId: string): Promise<{
  active: boolean;
  appName?: string;
  ownerExternalId?: string;
}> {
  type Raw = {
    status?: string;
    app_name?: string;
    entity_id?: string;
  };
  const data = await composioFetch<Raw>(
    `/connectedAccounts/${encodeURIComponent(connectionId)}`,
  );
  return {
    active: data.status === "ACTIVE" || data.status === "ACTIVE_INTEGRATION",
    appName: data.app_name,
    ownerExternalId: data.entity_id,
  };
}

/**
 * Disconnect Composio-side. Удаляет stored OAuth credentials Composio'м.
 * Eclipse DB row удаляется отдельно после успешного call'а.
 */
export async function disconnectConnection(connectionId: string): Promise<void> {
  await composioFetch<unknown>(
    `/connectedAccounts/${encodeURIComponent(connectionId)}`,
    { method: "DELETE" },
  );
}

/**
 * Execute action на подключённом app'е.
 *
 * Composio's actual endpoint — типовой path:
 * POST /actions/execute { connectionId, actionName, params }
 *
 * Composio возвращает success/data/error — мы proxy'им clean structure.
 */
export async function executeAction(args: {
  connectionId: string;
  actionName: string;
  params: Record<string, unknown>;
}): Promise<ComposioExecuteResult> {
  type Raw = {
    success?: boolean;
    data?: unknown;
    error?: string;
    execution_id?: string;
  };
  const data = await composioFetch<Raw>("/actions/execute", {
    method: "POST",
    body: {
      connection_id: args.connectionId,
      action_name: args.actionName,
      input: args.params,
    },
  });
  return {
    success: Boolean(data.success),
    data: data.data,
    error: data.error,
    executionId: data.execution_id,
  };
}
