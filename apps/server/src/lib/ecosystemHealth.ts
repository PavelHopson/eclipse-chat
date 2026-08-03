export type EcosystemServiceId =
  | "eclipse-chat"
  | "eclipse-ai-hub"
  | "eclipse-library"
  | "hopson-sentinel"
  | "eclipse-dnd-forge"
  | "eclipse-media";

export type EcosystemMaturity = "live" | "beta" | "prototype";
export type EcosystemRuntimeStatus =
  | "operational"
  | "degraded"
  | "offline"
  | "unconfigured";

export type EcosystemServiceHealth = {
  id: EcosystemServiceId;
  name: string;
  role: string;
  maturity: EcosystemMaturity;
  status: EcosystemRuntimeStatus;
  evidence: string;
  openUrl: string | null;
  latencyMs: number | null;
  checkedAt: string;
};

export type EcosystemIntegrationHealth = {
  id: string;
  from: EcosystemServiceId;
  to: EcosystemServiceId;
  label: string;
  stage: "active" | "experimental" | "planned";
  status: EcosystemRuntimeStatus;
};

export type EcosystemHealthSnapshot = {
  generatedAt: string;
  cacheTtlSeconds: number;
  summary: {
    total: number;
    operational: number;
    attention: number;
    local: number;
  };
  services: EcosystemServiceHealth[];
  integrations: EcosystemIntegrationHealth[];
};

type PublicProbeDefinition = {
  id: Exclude<EcosystemServiceId, "eclipse-chat" | "hopson-sentinel">;
  name: string;
  role: string;
  maturity: EcosystemMaturity;
  openUrl: string;
  probeUrl: string;
};

type GatewayTelemetry =
  | { state: "not_configured" }
  | { state: "unavailable" }
  | {
      state: "ready";
      windows: {
        "24h": { slo: { status: "healthy" | "breached" | "no_data" } };
      };
    };

type CollectorDependencies = {
  checkDatabase: () => Promise<void>;
  getGatewayTelemetry: () => Promise<GatewayTelemetry>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
};

type SnapshotOptions = CollectorDependencies & { force?: boolean };

const CACHE_TTL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 4_000;

// This fixed allowlist is intentionally code-owned. No request parameter or
// database value may become a probe target, which keeps this feature out of
// the SSRF path even for privileged users.
export const ECOSYSTEM_PUBLIC_PROBES: readonly PublicProbeDefinition[] = [
  {
    id: "eclipse-ai-hub",
    name: "Eclipse AI Hub",
    role: "AI gateway, models and research runtime",
    maturity: "beta",
    openUrl: "https://hub.eclipse-forge.ru/",
    probeUrl: "https://hub.eclipse-forge.ru/",
  },
  {
    id: "eclipse-library",
    name: "Eclipse Library",
    role: "Knowledge radar and curated product intelligence",
    maturity: "live",
    openUrl: "https://library.eclipse-forge.ru/",
    probeUrl: "https://library.eclipse-forge.ru/",
  },
  {
    id: "eclipse-dnd-forge",
    name: "Eclipse DnD Forge",
    role: "Campaign planning and game-master workspace",
    maturity: "prototype",
    openUrl: "https://dnd.eclipse-forge.ru/",
    probeUrl: "https://dnd.eclipse-forge.ru/",
  },
  {
    id: "eclipse-media",
    name: "Eclipse Media",
    role: "Media processing and release-video studio",
    maturity: "prototype",
    openUrl: "https://eclipse-media.pages.dev/",
    probeUrl: "https://eclipse-media.pages.dev/",
  },
] as const;

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function statusFromHttp(status: number): EcosystemRuntimeStatus {
  if (status >= 200 && status < 300) return "operational";
  if ((status >= 300 && status < 400) || status === 429) return "degraded";
  return status >= 400 && status < 500 ? "degraded" : "offline";
}

export async function probePublicService(
  definition: PublicProbeDefinition,
  options: { fetchImpl?: typeof fetch; checkedAt: string; timeoutMs?: number },
): Promise<EcosystemServiceHealth> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const startedAt = performance.now();
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const request = (method: "HEAD" | "GET") =>
      fetchImpl(definition.probeUrl, {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/json;q=0.8",
          "User-Agent": "Eclipse-Chat-Ecosystem-Health/1.0",
        },
      });

    let response = await request("HEAD");
    if (response.status === 405 || response.status === 501) {
      response = await request("GET");
      try {
        await response.body?.cancel();
      } catch {
        // Body contents are intentionally ignored; cancellation support varies
        // between fetch implementations and must not change the health result.
      }
    }

    const status = statusFromHttp(response.status);
    const evidence = status === "operational"
      ? `Public surface отвечает HTTP ${response.status}.`
      : status === "degraded"
        ? `Public surface отвечает HTTP ${response.status}; требуется проверка маршрута.`
        : `Public surface отвечает HTTP ${response.status}.`;

    return {
      id: definition.id,
      name: definition.name,
      role: definition.role,
      maturity: definition.maturity,
      status,
      evidence,
      openUrl: definition.openUrl,
      latencyMs: elapsedMs(startedAt),
      checkedAt: options.checkedAt,
    };
  } catch (error) {
    const timedOut = controller.signal.aborted;
    return {
      id: definition.id,
      name: definition.name,
      role: definition.role,
      maturity: definition.maturity,
      status: "offline",
      evidence: timedOut
        ? "Проверка превысила безопасный лимит времени."
        : "Public surface недоступен из production-сети.",
      openUrl: definition.openUrl,
      latencyMs: elapsedMs(startedAt),
      checkedAt: options.checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function applyGatewayState(
  service: EcosystemServiceHealth,
  telemetry: GatewayTelemetry,
): EcosystemServiceHealth {
  if (service.status === "offline") return service;
  if (telemetry.state === "not_configured") {
    return {
      ...service,
      status: "degraded",
      evidence: "Интерфейс доступен, но Chat ещё не подключён к AI gateway.",
    };
  }
  if (telemetry.state === "unavailable") {
    return {
      ...service,
      status: "degraded",
      evidence: "Интерфейс доступен, но gateway diagnostics не отвечает.",
    };
  }
  if (telemetry.windows["24h"].slo.status === "breached") {
    return {
      ...service,
      status: "degraded",
      evidence: "AI gateway подключён, но 24-часовой SLO нарушен.",
    };
  }
  return {
    ...service,
    evidence: telemetry.windows["24h"].slo.status === "no_data"
      ? "AI gateway подключён; данных для 24-часового SLO пока мало."
      : "AI gateway подключён, 24-часовой SLO в норме.",
  };
}

export async function collectEcosystemHealth(
  dependencies: CollectorDependencies,
): Promise<EcosystemHealthSnapshot> {
  const now = dependencies.now?.() ?? new Date();
  const checkedAt = now.toISOString();
  const chatStartedAt = performance.now();

  const [databaseResult, telemetry, publicServices] = await Promise.all([
    dependencies.checkDatabase().then(
      () => ({ ok: true as const, latencyMs: elapsedMs(chatStartedAt) }),
      () => ({ ok: false as const, latencyMs: elapsedMs(chatStartedAt) }),
    ),
    dependencies.getGatewayTelemetry(),
    Promise.all(
      ECOSYSTEM_PUBLIC_PROBES.map((definition) =>
        probePublicService(definition, {
          fetchImpl: dependencies.fetchImpl,
          checkedAt,
          timeoutMs: dependencies.timeoutMs,
        }),
      ),
    ),
  ]);

  const chat: EcosystemServiceHealth = {
    id: "eclipse-chat",
    name: "Eclipse Chat",
    role: "Communication, execution and operational memory",
    maturity: "live",
    status: databaseResult.ok ? "operational" : "degraded",
    evidence: databaseResult.ok
      ? "API и PostgreSQL отвечают из текущего production-процесса."
      : "API отвечает, но PostgreSQL требует внимания.",
    openUrl: "https://app.star-crm.ru/eclipse-chat/",
    latencyMs: databaseResult.latencyMs,
    checkedAt,
  };

  const sentinel: EcosystemServiceHealth = {
    id: "hopson-sentinel",
    name: "Hopson Sentinel",
    role: "Local operator, voice and execution runtime",
    maturity: "beta",
    status: "unconfigured",
    evidence: "Локальный bridge не опубликован и проверяется на устройстве оператора.",
    openUrl: null,
    latencyMs: null,
    checkedAt,
  };

  const services = [chat, ...publicServices, sentinel]
    .map((service) => service.id === "eclipse-ai-hub"
      ? applyGatewayState(service, telemetry)
      : service)
    .sort((left, right) => {
      const order: EcosystemServiceId[] = [
        "eclipse-chat",
        "eclipse-ai-hub",
        "eclipse-library",
        "hopson-sentinel",
        "eclipse-dnd-forge",
        "eclipse-media",
      ];
      return order.indexOf(left.id) - order.indexOf(right.id);
    });

  const aiHub = services.find((service) => service.id === "eclipse-ai-hub");
  const integrations: EcosystemIntegrationHealth[] = [
    {
      id: "chat-ai-gateway",
      from: "eclipse-chat",
      to: "eclipse-ai-hub",
      label: "AI routing and telemetry",
      stage: "experimental",
      status: telemetry.state === "not_configured"
        ? "unconfigured"
        : aiHub?.status ?? "offline",
    },
    {
      id: "library-ai-knowledge",
      from: "eclipse-library",
      to: "eclipse-ai-hub",
      label: "Curated knowledge intake",
      stage: "planned",
      status: "unconfigured",
    },
    {
      id: "chat-sentinel-execution",
      from: "eclipse-chat",
      to: "hopson-sentinel",
      label: "Approved local execution",
      stage: "planned",
      status: "unconfigured",
    },
    {
      id: "chat-dnd-workspace",
      from: "eclipse-chat",
      to: "eclipse-dnd-forge",
      label: "Campaign workspace rooms",
      stage: "planned",
      status: "unconfigured",
    },
    {
      id: "media-shared-runtime",
      from: "eclipse-ai-hub",
      to: "eclipse-media",
      label: "Shared media provider runtime",
      stage: "planned",
      status: "unconfigured",
    },
  ];

  return {
    generatedAt: checkedAt,
    cacheTtlSeconds: CACHE_TTL_MS / 1_000,
    summary: {
      total: services.length,
      operational: services.filter((service) => service.status === "operational").length,
      attention: services.filter((service) => ["degraded", "offline"].includes(service.status)).length,
      local: services.filter((service) => service.status === "unconfigured").length,
    },
    services,
    integrations,
  };
}

let cachedSnapshot: { expiresAt: number; value: EcosystemHealthSnapshot } | null = null;
let inFlightSnapshot: Promise<EcosystemHealthSnapshot> | null = null;

export async function getEcosystemHealthSnapshot(
  options: SnapshotOptions,
): Promise<EcosystemHealthSnapshot> {
  const timestamp = Date.now();
  if (!options.force && cachedSnapshot && cachedSnapshot.expiresAt > timestamp) {
    return cachedSnapshot.value;
  }
  if (!options.force && inFlightSnapshot) return inFlightSnapshot;

  const task = collectEcosystemHealth(options).then((value) => {
    cachedSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  });
  inFlightSnapshot = task;
  try {
    return await task;
  } finally {
    if (inFlightSnapshot === task) inFlightSnapshot = null;
  }
}

export function resetEcosystemHealthCacheForTests(): void {
  cachedSnapshot = null;
  inFlightSnapshot = null;
}
