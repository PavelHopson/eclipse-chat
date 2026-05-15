import { describe, expect, it } from "vitest";
import {
  BOT_ROLES,
  BOT_ROLE_LABELS,
  BOT_ROLE_SYSTEM_PROMPTS,
  botRolePrompt,
  isBotRole,
} from "../src/ai/botRoles.js";

/**
 * Юнит-тесты Bot.role taxonomy. Чистый конфиг — без DB / fetch / fastify.
 * Гарантирует, что enum / labels / prompts взаимно консистентны и что
 * botRolePrompt() корректно fallback'ит на GENERIC для невалидных входов.
 */

describe("BotRole taxonomy", () => {
  it("BOT_ROLES содержит ровно 5 ролей brief'а Pavel'я", () => {
    expect(BOT_ROLES).toEqual([
      "GENERIC",
      "MODERATOR",
      "PM",
      "KNOWLEDGE",
      "SALES",
    ]);
  });

  it("каждой роли соответствует непустой RU-label", () => {
    for (const r of BOT_ROLES) {
      const label = BOT_ROLE_LABELS[r];
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(1);
    }
  });

  it("каждой роли соответствует непустой system-prompt", () => {
    for (const r of BOT_ROLES) {
      const p = BOT_ROLE_SYSTEM_PROMPTS[r];
      expect(p).toBeTruthy();
      expect(p.length).toBeGreaterThan(40);
    }
  });

  it("isBotRole пропускает только enum-значения", () => {
    expect(isBotRole("MODERATOR")).toBe(true);
    expect(isBotRole("KNOWLEDGE")).toBe(true);
    expect(isBotRole("ADMIN")).toBe(false);
    expect(isBotRole("")).toBe(false);
    expect(isBotRole(null)).toBe(false);
    expect(isBotRole(undefined)).toBe(false);
    expect(isBotRole(42)).toBe(false);
  });

  it("botRolePrompt: валидные роли → собственный prompt", () => {
    expect(botRolePrompt("MODERATOR")).toBe(BOT_ROLE_SYSTEM_PROMPTS.MODERATOR);
    expect(botRolePrompt("SALES")).toBe(BOT_ROLE_SYSTEM_PROMPTS.SALES);
  });

  it("botRolePrompt: null / undefined / мусор → GENERIC fallback", () => {
    expect(botRolePrompt(null)).toBe(BOT_ROLE_SYSTEM_PROMPTS.GENERIC);
    expect(botRolePrompt(undefined)).toBe(BOT_ROLE_SYSTEM_PROMPTS.GENERIC);
    // intentionally invalid cast — проверяем рантайм-fallback
    expect(botRolePrompt("UNKNOWN" as unknown as null)).toBe(
      BOT_ROLE_SYSTEM_PROMPTS.GENERIC,
    );
  });
});
