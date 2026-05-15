import { describe, expect, it } from "vitest";
import {
  detectAiMention,
  resolveAiMention,
  stripAiMention,
} from "../src/ai/assistant.js";

/**
 * Тесты role-aware mention detector в ai/assistant.ts.
 *
 * Покрытие:
 *   - все поддерживаемые keyword'ы (EN + RU)
 *   - case-insensitive
 *   - word-boundary (НЕ матчит mid-word, e.g. `@aimoderator`)
 *   - правильный role resolved при overlapping keywords
 *   - strip убирает все известные mention'ы и lever non-mention текст
 */

describe("detectAiMention", () => {
  it("ловит @ai (английский lowercase)", () => {
    expect(detectAiMention("Hello @ai, что нового?")).toBe(true);
  });

  it("ловит @AI (caps)", () => {
    expect(detectAiMention("@AI прокомментируй")).toBe(true);
  });

  it("ловит @ии (RU)", () => {
    expect(detectAiMention("@ии что думаешь?")).toBe(true);
  });

  it("ловит @moderator", () => {
    expect(detectAiMention("@moderator смотрим что не так")).toBe(true);
  });

  it("ловит @модератор", () => {
    expect(detectAiMention("@модератор зацени")).toBe(true);
  });

  it("ловит @pm", () => {
    expect(detectAiMention("@pm статус по задачам?")).toBe(true);
  });

  it("ловит @менеджер", () => {
    expect(detectAiMention("@менеджер дай сводку")).toBe(true);
  });

  it("ловит @knowledge", () => {
    expect(detectAiMention("@knowledge что у нас по интеграции?")).toBe(true);
  });

  it("ловит @sales", () => {
    expect(detectAiMention("@sales продумай follow-up")).toBe(true);
  });

  it("НЕ ловит mention внутри другого слова", () => {
    expect(detectAiMention("hello@ai.com")).toBe(false);
    expect(detectAiMention("smth@aimoderator")).toBe(false);
  });

  it("НЕ ловит обычный текст без mention'ов", () => {
    expect(detectAiMention("просто текст без упоминаний")).toBe(false);
    expect(detectAiMention("")).toBe(false);
  });

  it("ловит mention в начале сообщения", () => {
    expect(detectAiMention("@ai")).toBe(true);
  });

  it("ловит mention перед пунктуацией", () => {
    expect(detectAiMention("@ai?")).toBe(true);
    expect(detectAiMention("ну @pm, что скажешь?")).toBe(true);
  });
});

describe("resolveAiMention", () => {
  it("@ai → GENERIC", () => {
    expect(resolveAiMention("@ai привет")).toEqual({
      role: "GENERIC",
      keyword: "ai",
    });
  });

  it("@moderator → MODERATOR", () => {
    expect(resolveAiMention("@moderator проверь канал")).toEqual({
      role: "MODERATOR",
      keyword: "moderator",
    });
  });

  it("@мод → MODERATOR (RU short form)", () => {
    expect(resolveAiMention("@мод глянь")).toEqual({
      role: "MODERATOR",
      keyword: "мод",
    });
  });

  it("@pm → PM", () => {
    expect(resolveAiMention("@pm статус?")).toEqual({
      role: "PM",
      keyword: "pm",
    });
  });

  it("@менеджер → PM", () => {
    expect(resolveAiMention("@менеджер дай сводку")).toEqual({
      role: "PM",
      keyword: "менеджер",
    });
  });

  it("@kb → KNOWLEDGE", () => {
    expect(resolveAiMention("@kb где доки?")).toEqual({
      role: "KNOWLEDGE",
      keyword: "kb",
    });
  });

  it("@знания → KNOWLEDGE", () => {
    expect(resolveAiMention("@знания подскажи")).toEqual({
      role: "KNOWLEDGE",
      keyword: "знания",
    });
  });

  it("@sales → SALES", () => {
    expect(resolveAiMention("@sales follow-up?")).toEqual({
      role: "SALES",
      keyword: "sales",
    });
  });

  it("@продажи → SALES", () => {
    expect(resolveAiMention("@продажи приготовь оффер")).toEqual({
      role: "SALES",
      keyword: "продажи",
    });
  });

  it("case-insensitive: @MODERATOR / @Pm / @КБ", () => {
    expect(resolveAiMention("@MODERATOR")?.role).toBe("MODERATOR");
    expect(resolveAiMention("@Pm")?.role).toBe("PM");
    expect(resolveAiMention("@МоДеРаТоР")?.role).toBe("MODERATOR");
  });

  it("первый mention выигрывает при двух подряд", () => {
    expect(resolveAiMention("@pm @moderator оба нужны")?.role).toBe("PM");
  });

  it("null если mention'а нет", () => {
    expect(resolveAiMention("текст")).toBeNull();
    expect(resolveAiMention("")).toBeNull();
    expect(resolveAiMention("user@ai.com")).toBeNull();
  });
});

describe("stripAiMention", () => {
  it("убирает @ai + оставляет остальной текст", () => {
    expect(stripAiMention("Привет @ai, расскажи")).toBe("Привет , расскажи");
  });

  it("убирает все mention'ы (multi)", () => {
    expect(stripAiMention("@pm @moderator статус")).toBe("статус");
  });

  it("убирает RU keyword'ы", () => {
    expect(stripAiMention("@менеджер @знания сводка")).toBe("сводка");
  });

  it("trims trailing/leading whitespace", () => {
    expect(stripAiMention("@ai   ")).toBe("");
    expect(stripAiMention("  @sales offer")).toBe("offer");
  });

  it("не трогает email-подобные строки", () => {
    expect(stripAiMention("user@ai.com")).toBe("user@ai.com");
  });
});
