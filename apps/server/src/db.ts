import { Prisma, PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __basePrisma?: PrismaClient };

const basePrisma =
  g.__basePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  g.__basePrisma = basePrisma;
}

/**
 * Determines если ошибка — про "connection closed" (cold start / idle disconnect),
 * который безопасно retry-ить.
 */
function isRetryableConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1017") {
    return true;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === "string") {
      return (
        msg.includes("ECONNRESET") ||
        msg.includes("Server has closed") ||
        msg.includes("Connection terminated")
      );
    }
  }
  return false;
}

/**
 * Retry wrapper для Neon free tier "Scales to zero".
 *
 * Endpoint Neon усыпляется после 5+ минут idle. Первый запрос «будит»
 * cold start (медленно или с P1017), а Prisma engine видит закрытое
 * соединение и возвращает ошибку. На следующем запросе подключение
 * уже горячее.
 *
 * Стратегия: на P1017 / ECONNRESET / "Connection terminated" —
 * `$disconnect` + повтор query с exponential backoff (200ms, 800ms,
 * 2000ms). После 3 неудач — оригинальная ошибка.
 *
 * На native PG (production / Star CRM сервер) этот retry почти никогда
 * не сработает — там P1017 не приходит. Минимальный overhead в нормал.
 */
/**
 * Только idempotent reads — retry безопасен. Mutations (create/update/delete)
 * НЕ retry'им: после connection reset Prisma может не знать что INSERT уже
 * прошёл на стороне БД, и второй retry даст duplicate (P2002).
 */
const RETRYABLE_OPERATIONS = new Set<string>([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/**
 * Pre-warm connection: дёшёвый retry-safe SELECT 1 для пробуждения Neon
 * endpoint перед mutation. Без этого первая mutation после idle падает
 * на P1017 без возможности retry (см. RETRYABLE_OPERATIONS).
 */
async function ensureConnectionWarm(): Promise<void> {
  const delays = [0, 200, 800, 2000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await new Promise((r) => setTimeout(r, delays[i]));
    }
    try {
      await basePrisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      if (!isRetryableConnectionError(err)) {
        throw err;
      }
      try {
        await basePrisma.$disconnect();
      } catch {
        /* may already be dead */
      }
    }
  }
  // Если 4 раза не получилось — упадёт сама mutation, отдадим её ошибку.
}

export const db = basePrisma.$extends({
  name: "neon-cold-start-retry",
  query: {
    $allModels: {
      async $allOperations({ args, query, operation }) {
        const isRetryable = RETRYABLE_OPERATIONS.has(operation);
        if (!isRetryable) {
          // Mutations — pre-warm connection и пускаем query один раз без retry.
          await ensureConnectionWarm();
          return query(args);
        }
        // Reads — retry до 3 раз
        const maxRetries = 3;
        const delays = [200, 800, 2000];
        let lastErr: unknown = null;
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await query(args);
          } catch (err) {
            lastErr = err;
            if (!isRetryableConnectionError(err)) {
              throw err;
            }
            try {
              await basePrisma.$disconnect();
            } catch {
              /* disconnect can fail if already dead */
            }
            const wait = delays[i] ?? 2000;
            await new Promise((r) => setTimeout(r, wait));
          }
        }
        throw lastErr;
      },
    },
  },
});

/** Прямой доступ к базовому Prisma client для special-case query (e.g. raw SQL без retry). */
export const dbBase = basePrisma;
