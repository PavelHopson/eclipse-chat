import type { MessageRow } from "../hooks/useMessages";

export function replyLabel(count: number): string {
  const tail = Math.abs(count) % 100;
  const word = tail >= 11 && tail <= 14 ? "ответов" : tail % 10 === 1 ? "ответ" : tail % 10 >= 2 && tail % 10 <= 4 ? "ответа" : "ответов";
  return count + " " + word;
}

export function isDirectMention(content: string, name?: string): boolean {
  if (!name?.trim()) return false;
  const text = content.toLocaleLowerCase("ru-RU");
  const needle = "@" + name.trim().toLocaleLowerCase("ru-RU");
  let offset = text.indexOf(needle);
  while (offset >= 0) {
    const before = text[offset - 1] ?? "";
    const after = text[offset + needle.length] ?? "";
    if (!/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) return true;
    offset = text.indexOf(needle, offset + needle.length);
  }
  return false;
}

export function incomingAfter(messages: MessageRow[], previousId: string, userId?: string): MessageRow[] {
  const index = messages.findIndex(message => message.id === previousId);
  if (index < 0) return []; // Replaced history window, not new arrivals.
  return messages.slice(index + 1).filter(message => !message.deletedAt && !message.pending && message.user.id !== userId);
}

export function panelWidth(value: number, maximum = 560): number {
  return Math.round(Math.max(320, Math.min(maximum, Number.isFinite(value) ? value : 400)));
}

export function localDateInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function readingAnchor(list: HTMLElement | null): string | null {
  if (!list) return null;
  const top = list.getBoundingClientRect().top;
  return Array.from(list.querySelectorAll<HTMLElement>("[data-message-id]"))
    .find(node => node.getBoundingClientRect().bottom > top)?.dataset.messageId ?? null;
}
