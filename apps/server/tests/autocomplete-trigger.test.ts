import { describe, expect, it } from "vitest";

/**
 * Тесты для detectTrigger функции из apps/web — copy inline здесь чтобы
 * не зависеть от React import side-effects (vitest runs node env).
 * Если detectTrigger меняется в `apps/web/src/components/AutocompletePopover.tsx`,
 * обнови copy здесь тоже.
 */

type Trigger = {
  kind: "@" | ":";
  startIdx: number;
  word: string;
};

function detectTrigger(text: string, caretIdx: number): Trigger | null {
  let i = caretIdx - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === " " || ch === "\n" || ch === "\t") return null;
    if (ch === "@" || ch === ":") {
      const prev = i > 0 ? text[i - 1] : " ";
      if (prev === " " || prev === "\n" || prev === "\t" || i === 0) {
        const word = text.slice(i + 1, caretIdx);
        if (ch === ":" && word.length === 0) return null;
        return { kind: ch as "@" | ":", startIdx: i, word };
      }
      return null;
    }
    if (!/[\p{L}\p{N}_+-]/u.test(ch)) return null;
    i--;
  }
  return null;
}

describe("detectTrigger (composer @/: autocomplete)", () => {
  it("@ в начале строки", () => {
    expect(detectTrigger("@Pav", 4)).toEqual({ kind: "@", startIdx: 0, word: "Pav" });
  });

  it("@ после пробела", () => {
    expect(detectTrigger("hi @Pav", 7)).toEqual({ kind: "@", startIdx: 3, word: "Pav" });
  });

  it("@ после буквы — не trigger (email-like)", () => {
    expect(detectTrigger("hi@example.com", 14)).toBeNull();
  });

  it("@ с пустым word", () => {
    expect(detectTrigger("hi @", 4)).toEqual({ kind: "@", startIdx: 3, word: "" });
  });

  it(": с пустым word — НЕ trigger (too noisy для colons в коде)", () => {
    expect(detectTrigger("hi :", 4)).toBeNull();
  });

  it(":fire emoji shortcode", () => {
    expect(detectTrigger("yes :fire", 9)).toEqual({ kind: ":", startIdx: 4, word: "fire" });
  });

  it("пробел после triggered word — break trigger", () => {
    expect(detectTrigger("@Pav hello", 10)).toBeNull();
  });

  it("Cyrillic mention", () => {
    expect(detectTrigger("@Павел", 6)).toEqual({ kind: "@", startIdx: 0, word: "Павел" });
  });

  it("caret в середине типаемого word'а", () => {
    expect(detectTrigger("@Pavel", 4)).toEqual({ kind: "@", startIdx: 0, word: "Pav" });
  });
});
