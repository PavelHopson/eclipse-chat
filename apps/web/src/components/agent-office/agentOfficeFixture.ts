export type AgentCapability =
  | "PUBLIC_WEB_RESEARCH"
  | "CLAIM_VERIFICATION"
  | "CONTENT_STRATEGY"
  | "METRICS_ANALYSIS"
  | "ARTIFACT_DRAFTING";

export type RunStatus = "PLANNED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";

export type AgentDefinition = {
  id: string;
  name: string;
  role: string;
  capabilities: AgentCapability[];
};

export type FixtureStep = {
  id: string;
  agentId: string;
  title: string;
  result: string;
};

export type AgentOfficeFixture = {
  contractVersion: "agents.v1";
  runId: string;
  objective: string;
  successCriteria: string[];
  agents: AgentDefinition[];
  steps: FixtureStep[];
  policy: {
    sourceBoundary: string;
    personalData: string;
    connectedApps: string;
  };
  budget: {
    maxCostUsd: number;
    maxDurationMinutes: number;
    maxExternalActions: number;
  };
};

export const growthPilotFixture: AgentOfficeFixture = {
  contractVersion: "agents.v1",
  runId: "run:growth-pilot-demo",
  objective:
    "Подготовить доказательный brief для 30-дневного Growth OS pilot без внешних действий.",
  successCriteria: [
    "Каждый ключевой claim имеет источник или пометку «не подтверждено».",
    "Результат заканчивается review-ready artifact, а не публикацией.",
    "План остаётся в пределах нулевого external-action budget.",
  ],
  policy: {
    sourceBoundary: "Только публичные материалы Eclipse Forge и fixture-источники",
    personalData: "Запрещены",
    connectedApps: "Не подключены",
  },
  budget: {
    maxCostUsd: 0,
    maxDurationMinutes: 20,
    maxExternalActions: 0,
  },
  agents: [
    {
      id: "agent:market-researcher",
      name: "Market Researcher",
      role: "Собирает проверяемый рыночный контекст",
      capabilities: ["PUBLIC_WEB_RESEARCH"],
    },
    {
      id: "agent:claim-verifier",
      name: "Claim Verifier",
      role: "Отделяет факты, выводы и рекламные обещания",
      capabilities: ["CLAIM_VERIFICATION"],
    },
    {
      id: "agent:content-strategist",
      name: "Content Strategist",
      role: "Связывает аудиторию, funnel, proof и CTA",
      capabilities: ["CONTENT_STRATEGY", "ARTIFACT_DRAFTING"],
    },
    {
      id: "agent:metrics-analyst",
      name: "Metrics Analyst",
      role: "Определяет baseline, KPI и weekly review",
      capabilities: ["METRICS_ANALYSIS"],
    },
  ],
  steps: [
    {
      id: "step:inventory",
      agentId: "agent:market-researcher",
      title: "Собрать inventory публичных доказательств",
      result: "Сформирован список доступных страниц продуктов, документации и публичных proof points.",
    },
    {
      id: "step:claims",
      agentId: "agent:claim-verifier",
      title: "Проверить claims и пробелы",
      result: "Неподтверждённые обещания исключены; пробелы отмечены как вопросы к владельцу.",
    },
    {
      id: "step:strategy",
      agentId: "agent:content-strategist",
      title: "Собрать funnel-ready content brief",
      result: "Материалы связаны с аудиторией, проблемой, стадией funnel, proof и CTA.",
    },
    {
      id: "step:metrics",
      agentId: "agent:metrics-analyst",
      title: "Зафиксировать KPI и review cadence",
      result: "Определены baseline-поля, leading indicators и weekly review без выдуманных значений.",
    },
  ],
};
