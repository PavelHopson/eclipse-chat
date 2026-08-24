import type { FastifyInstance } from "fastify";

const SAFE_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/;

function errorField(error: unknown, field: "code" | "statusCode"): unknown {
  return typeof error === "object" && error !== null && field in error
    ? (error as Record<string, unknown>)[field]
    : undefined;
}

function safeErrorCode(error: unknown): string {
  const code = errorField(error, "code");
  return typeof code === "string" && SAFE_CODE_PATTERN.test(code)
    ? code
    : "UNKNOWN";
}

function clientErrorMessage(statusCode: number): string {
  if (statusCode === 400) return "Invalid request";
  if (statusCode === 401) return "Unauthorized";
  if (statusCode === 403) return "Forbidden";
  if (statusCode === 404) return "Not found";
  if (statusCode === 409) return "Conflict";
  if (statusCode === 413) return "Request body too large";
  if (statusCode === 429) return "Too many requests";
  return "Request failed";
}

export function registerSafeErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const candidate = Number(errorField(error, "statusCode"));
    const statusCode = Number.isInteger(candidate) && candidate >= 400 && candidate < 500
      ? candidate
      : 500;
    const code = safeErrorCode(error);

    if (statusCode < 500) {
      return reply.status(statusCode).send({
        error: clientErrorMessage(statusCode),
        code: code === "UNKNOWN" ? "request_failed" : code,
      });
    }

    request.log.error(
      { requestId: request.id, code },
      "Unhandled request failed",
    );
    return reply.status(500).send({
      error: "Internal Server Error",
      code: "internal_error",
    });
  });
}