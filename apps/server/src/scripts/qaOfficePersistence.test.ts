import { describe, expect, it } from "vitest";
import { assertOfficePersistenceQaEnvironment } from "./qaOfficePersistence.js";

const isolated = {
  OFFICE_QA_ACK: "isolated-database",
  DATABASE_URL: "postgresql://qa:temporary@127.0.0.1:5433/eclipse_chat_office_qa_test?schema=public",
} as NodeJS.ProcessEnv;

describe("Office persistence QA environment guard", () => {
  it("accepts only an explicitly acknowledged loopback QA database", () => {
    expect(() => assertOfficePersistenceQaEnvironment(isolated)).not.toThrow();
    expect(() => assertOfficePersistenceQaEnvironment({
      ...isolated,
      DATABASE_URL: "postgresql://qa:temporary@localhost:5433/eclipse_chat_office_qa_test",
    })).not.toThrow();
  });

  it("rejects missing acknowledgement before any database query", () => {
    expect(() => assertOfficePersistenceQaEnvironment({
      DATABASE_URL: isolated.DATABASE_URL,
    })).toThrow(/OFFICE_QA_ACK/);
  });

  it("rejects remote hosts and non-QA database names", () => {
    expect(() => assertOfficePersistenceQaEnvironment({
      ...isolated,
      DATABASE_URL: "postgresql://qa:temporary@db.example.com:5432/eclipse_chat_office_qa_test",
    })).toThrow(/non-isolated/);
    expect(() => assertOfficePersistenceQaEnvironment({
      ...isolated,
      DATABASE_URL: "postgresql://qa:temporary@127.0.0.1:5433/eclipse_chat",
    })).toThrow(/non-isolated/);
  });
});
