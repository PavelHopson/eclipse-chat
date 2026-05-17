/**
 * Operational Tables templates (v0.70 phase 2.5a).
 *
 * Pre-configured field sets для типичных use-cases. Backend читает
 * `templateId` из POST body, создаёт таблицу с этими полями (вместо
 * default «Название» single-field, как делает обычный create).
 *
 * Минимум для v0.70:
 *   - blank   — пустая (1 поле «Название»), legacy default
 *   - tasks   — Задачи команды
 *   - leads   — CRM лиды
 *
 * Расширение списка — отдельным commit'ом (явные additions, чтобы
 * было видно в diff). RELATION / FILE field types появятся в phase
 * 2.5b — тогда добавим templates с linked data (например, «Проекты
 * × Задачи» с RELATION-полем).
 */

import type { TableFieldType } from "@prisma/client";

export type TemplateField = {
  name: string;
  type: TableFieldType;
  /** Для STATUS — array значений. Игнорируется для других типов. */
  options?: string[];
};

export type TableTemplate = {
  id: string;
  label: string;
  description: string;
  /** Default name таблицы при create — frontend может override. */
  defaultName: string;
  fields: TemplateField[];
};

export const TABLE_TEMPLATES: TableTemplate[] = [
  {
    id: "blank",
    label: "Пустая",
    description: "Одна колонка «Название» — добавляйте дальше сами.",
    defaultName: "Таблица",
    fields: [{ name: "Название", type: "TEXT" }],
  },
  {
    id: "tasks",
    label: "Задачи",
    description: "Название / Статус / Ответственный / Срок / Приоритет.",
    defaultName: "Задачи команды",
    fields: [
      { name: "Название", type: "TEXT" },
      {
        name: "Статус",
        type: "STATUS",
        options: ["Открыто", "В работе", "Ревью", "Готово"],
      },
      { name: "Ответственный", type: "USER" },
      { name: "Срок", type: "DATE" },
      {
        name: "Приоритет",
        type: "STATUS",
        options: ["Низкий", "Норма", "Высокий", "Срочно"],
      },
    ],
  },
  {
    id: "leads",
    label: "CRM лиды",
    description: "Имя / Этап / Email / Телефон / Заметки.",
    defaultName: "Лиды",
    fields: [
      { name: "Имя", type: "TEXT" },
      {
        name: "Этап",
        type: "STATUS",
        options: ["Новый", "Контакт", "Демо", "Договор", "Оплата"],
      },
      { name: "Email", type: "TEXT" },
      { name: "Телефон", type: "TEXT" },
      { name: "Заметки", type: "TEXT" },
    ],
  },
];

export function getTemplate(id: string): TableTemplate | null {
  return TABLE_TEMPLATES.find((t) => t.id === id) ?? null;
}
