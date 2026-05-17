import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import { SocketEvents } from "../lib/socket";

/**
 * Operational Tables — два hooks:
 *   useOperationalTables(serverId, socket)  — list для sidebar / Context Tree
 *   useOperationalTable(tableId, socket)    — full detail + CRUD ops
 *
 * v0.62 phase 2: оба subscribe на socket-events `table:*`, обновляют
 * локальный state без manual reload.
 */

export type TableFieldType =
  | "TEXT"
  | "NUMBER"
  | "STATUS"
  | "DATE"
  | "USER"
  | "CHECKBOX";

export type TableSummary = {
  id: string;
  name: string;
  description: string | null;
  channelId: string | null;
  createdAt: string;
  updatedAt: string;
  fieldCount: number;
  rowCount: number;
};

export type TableField = {
  id: string;
  name: string;
  type: TableFieldType;
  /** Для STATUS — массив доступных значений. Null для остальных. */
  options: string[] | null;
  position: number;
};

export type TableCell = {
  fieldId: string;
  value: string;
};

export type TableRow = {
  id: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  cells: TableCell[];
};

export type TableDetail = {
  id: string;
  serverId: string;
  channelId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; displayName: string; avatar: string | null };
  fields: TableField[];
  rows: TableRow[];
};

/** ============================================================
 *  useOperationalTables — list для active server
 *  ============================================================
 */

export function useOperationalTables(
  serverId: string | null,
  socket: Socket | null = null,
) {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setTables([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ tables: TableSummary[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/tables`,
      );
      setTables(data.tables);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить таблицы");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // v0.62: subscribe на server-wide table events — list invalidate'ится
  // через reload (full state легче чем patch'ить counts).
  useEffect(() => {
    if (!socket || !serverId) return;
    const onChanged = () => {
      void reload();
    };
    socket.on(SocketEvents.TableUpdated, onChanged);
    socket.on(SocketEvents.TableDeleted, onChanged);
    // Row/field events тоже trigger reload — fieldCount/rowCount меняются.
    socket.on(SocketEvents.TableFieldAdded, onChanged);
    socket.on(SocketEvents.TableFieldDeleted, onChanged);
    socket.on(SocketEvents.TableRowAdded, onChanged);
    socket.on(SocketEvents.TableRowDeleted, onChanged);
    return () => {
      socket.off(SocketEvents.TableUpdated, onChanged);
      socket.off(SocketEvents.TableDeleted, onChanged);
      socket.off(SocketEvents.TableFieldAdded, onChanged);
      socket.off(SocketEvents.TableFieldDeleted, onChanged);
      socket.off(SocketEvents.TableRowAdded, onChanged);
      socket.off(SocketEvents.TableRowDeleted, onChanged);
    };
  }, [socket, serverId, reload]);

  const createTable = useCallback(
    async (name: string, description?: string): Promise<string | null> => {
      if (!serverId) return null;
      try {
        const data = await apiJson<{ table: TableDetail }>(
          `/api/servers/${encodeURIComponent(serverId)}/tables`,
          {
            method: "POST",
            body: JSON.stringify({ name, description }),
            headers: { "Content-Type": "application/json" },
          },
        );
        await reload();
        return data.table.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось создать таблицу");
        return null;
      }
    },
    [serverId, reload],
  );

  /**
   * v0.70: создать таблицу из template. Возвращает id новой таблицы
   * (или null при failure). Frontend сразу switch'нется на детальный view.
   */
  const createFromTemplate = useCallback(
    async (templateId: string, name?: string): Promise<string | null> => {
      if (!serverId) return null;
      try {
        const data = await apiJson<{ table: TableDetail }>(
          `/api/servers/${encodeURIComponent(serverId)}/tables/from-template`,
          {
            method: "POST",
            body: JSON.stringify({ templateId, name }),
            headers: { "Content-Type": "application/json" },
          },
        );
        await reload();
        return data.table.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось создать таблицу по шаблону");
        return null;
      }
    },
    [serverId, reload],
  );

  const deleteTable = useCallback(
    async (tableId: string): Promise<boolean> => {
      try {
        await apiJson(`/api/tables/${encodeURIComponent(tableId)}`, {
          method: "DELETE",
        });
        setTables((prev) => prev.filter((t) => t.id !== tableId));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить таблицу");
        return false;
      }
    },
    [],
  );

  return { tables, loading, error, reload, createTable, createFromTemplate, deleteTable };
}

/** v0.70: shared template descriptor (server-driven, in case добавим больше). */
export type TableTemplateDescriptor = {
  id: string;
  label: string;
  description: string;
  fieldCount: number;
  fieldNames: string[];
};

/** Lazy-fetched один раз: список доступных templates (статика, кэшируем). */
let cachedTemplates: TableTemplateDescriptor[] | null = null;

export async function loadTableTemplates(): Promise<TableTemplateDescriptor[]> {
  if (cachedTemplates) return cachedTemplates;
  try {
    const data = await apiJson<{ templates: TableTemplateDescriptor[] }>(
      "/api/tables/templates",
    );
    cachedTemplates = data.templates;
    return cachedTemplates;
  } catch {
    return [];
  }
}

/** ============================================================
 *  useOperationalTable — full detail of single table
 *  ============================================================
 */

export function useOperationalTable(
  tableId: string | null,
  socket: Socket | null = null,
) {
  const [table, setTable] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tableId) {
      setTable(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ table: TableDetail }>(
        `/api/tables/${encodeURIComponent(tableId)}`,
      );
      setTable(data.table);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить таблицу");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // v0.62: subscribe — apply patches к local state. Каждый event имеет
  // tableId, фильтруем по совпадению с currently-open table.
  useEffect(() => {
    if (!socket || !tableId) return;
    const onTableUpdated = (p: { id: string; name?: string; description?: string | null; channelId?: string | null }) => {
      if (p.id !== tableId) return;
      setTable((prev) =>
        prev
          ? {
              ...prev,
              name: p.name ?? prev.name,
              description: p.description !== undefined ? p.description : prev.description,
              channelId: p.channelId !== undefined ? p.channelId : prev.channelId,
            }
          : prev,
      );
    };
    const onTableDeleted = (p: { id: string }) => {
      if (p.id === tableId) setTable(null);
    };
    const onFieldAdded = (p: { tableId: string; field: TableField }) => {
      if (p.tableId !== tableId) return;
      setTable((prev) =>
        prev && !prev.fields.some((f) => f.id === p.field.id)
          ? { ...prev, fields: [...prev.fields, p.field] }
          : prev,
      );
    };
    const onFieldUpdated = (p: { tableId: string; field: TableField }) => {
      if (p.tableId !== tableId) return;
      setTable((prev) =>
        prev
          ? {
              ...prev,
              fields: prev.fields.map((f) => (f.id === p.field.id ? p.field : f)),
            }
          : prev,
      );
    };
    const onFieldDeleted = (p: { tableId: string; fieldId: string }) => {
      if (p.tableId !== tableId) return;
      setTable((prev) =>
        prev
          ? {
              ...prev,
              fields: prev.fields.filter((f) => f.id !== p.fieldId),
              rows: prev.rows.map((r) => ({
                ...r,
                cells: r.cells.filter((c) => c.fieldId !== p.fieldId),
              })),
            }
          : prev,
      );
    };
    const onRowAdded = (p: { tableId: string; row: TableRow }) => {
      if (p.tableId !== tableId) return;
      setTable((prev) =>
        prev && !prev.rows.some((r) => r.id === p.row.id)
          ? { ...prev, rows: [...prev.rows, p.row] }
          : prev,
      );
    };
    const onRowUpdated = (p: { tableId: string; row: TableRow }) => {
      if (p.tableId !== tableId) return;
      setTable((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) => (r.id === p.row.id ? p.row : r)),
            }
          : prev,
      );
    };
    const onRowDeleted = (p: { tableId: string; rowId: string }) => {
      if (p.tableId !== tableId) return;
      setTable((prev) =>
        prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== p.rowId) } : prev,
      );
    };

    socket.on(SocketEvents.TableUpdated, onTableUpdated);
    socket.on(SocketEvents.TableDeleted, onTableDeleted);
    socket.on(SocketEvents.TableFieldAdded, onFieldAdded);
    socket.on(SocketEvents.TableFieldUpdated, onFieldUpdated);
    socket.on(SocketEvents.TableFieldDeleted, onFieldDeleted);
    socket.on(SocketEvents.TableRowAdded, onRowAdded);
    socket.on(SocketEvents.TableRowUpdated, onRowUpdated);
    socket.on(SocketEvents.TableRowDeleted, onRowDeleted);
    return () => {
      socket.off(SocketEvents.TableUpdated, onTableUpdated);
      socket.off(SocketEvents.TableDeleted, onTableDeleted);
      socket.off(SocketEvents.TableFieldAdded, onFieldAdded);
      socket.off(SocketEvents.TableFieldUpdated, onFieldUpdated);
      socket.off(SocketEvents.TableFieldDeleted, onFieldDeleted);
      socket.off(SocketEvents.TableRowAdded, onRowAdded);
      socket.off(SocketEvents.TableRowUpdated, onRowUpdated);
      socket.off(SocketEvents.TableRowDeleted, onRowDeleted);
    };
  }, [socket, tableId]);

  const rename = useCallback(
    async (name: string): Promise<boolean> => {
      if (!tableId) return false;
      try {
        await apiJson(`/api/tables/${encodeURIComponent(tableId)}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
          headers: { "Content-Type": "application/json" },
        });
        setTable((prev) => (prev ? { ...prev, name } : prev));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось переименовать");
        return false;
      }
    },
    [tableId],
  );

  const addField = useCallback(
    async (
      name: string,
      type: TableFieldType,
      options?: string[],
    ): Promise<boolean> => {
      if (!tableId) return false;
      try {
        const data = await apiJson<{ field: TableField }>(
          `/api/tables/${encodeURIComponent(tableId)}/fields`,
          {
            method: "POST",
            body: JSON.stringify({ name, type, options }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setTable((prev) =>
          prev ? { ...prev, fields: [...prev.fields, data.field] } : prev,
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось добавить колонку");
        return false;
      }
    },
    [tableId],
  );

  const updateField = useCallback(
    async (
      fieldId: string,
      patch: { name?: string; options?: string[] | null },
    ): Promise<boolean> => {
      if (!tableId) return false;
      try {
        const data = await apiJson<{ field: TableField }>(
          `/api/tables/${encodeURIComponent(tableId)}/fields/${encodeURIComponent(fieldId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(patch),
            headers: { "Content-Type": "application/json" },
          },
        );
        setTable((prev) =>
          prev
            ? {
                ...prev,
                fields: prev.fields.map((f) =>
                  f.id === fieldId ? data.field : f,
                ),
              }
            : prev,
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось обновить колонку");
        return false;
      }
    },
    [tableId],
  );

  const removeField = useCallback(
    async (fieldId: string): Promise<boolean> => {
      if (!tableId) return false;
      try {
        await apiJson(
          `/api/tables/${encodeURIComponent(tableId)}/fields/${encodeURIComponent(fieldId)}`,
          { method: "DELETE" },
        );
        setTable((prev) =>
          prev
            ? {
                ...prev,
                fields: prev.fields.filter((f) => f.id !== fieldId),
                rows: prev.rows.map((r) => ({
                  ...r,
                  cells: r.cells.filter((c) => c.fieldId !== fieldId),
                })),
              }
            : prev,
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить колонку");
        return false;
      }
    },
    [tableId],
  );

  const addRow = useCallback(async (): Promise<boolean> => {
    if (!tableId) return false;
    try {
      const data = await apiJson<{ row: TableRow }>(
        `/api/tables/${encodeURIComponent(tableId)}/rows`,
        { method: "POST" },
      );
      setTable((prev) =>
        prev ? { ...prev, rows: [...prev.rows, data.row] } : prev,
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось добавить строку");
      return false;
    }
  }, [tableId]);

  const updateRow = useCallback(
    async (
      rowId: string,
      cells: Array<{ fieldId: string; value: string }>,
    ): Promise<boolean> => {
      if (!tableId || cells.length === 0) return false;
      try {
        const data = await apiJson<{ row: TableRow }>(
          `/api/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ cells }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setTable((prev) =>
          prev
            ? {
                ...prev,
                rows: prev.rows.map((r) => (r.id === rowId ? data.row : r)),
              }
            : prev,
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось обновить строку");
        return false;
      }
    },
    [tableId],
  );

  const removeRow = useCallback(
    async (rowId: string): Promise<boolean> => {
      if (!tableId) return false;
      try {
        await apiJson(
          `/api/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}`,
          { method: "DELETE" },
        );
        setTable((prev) =>
          prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== rowId) } : prev,
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить строку");
        return false;
      }
    },
    [tableId],
  );

  /**
   * v0.70: bulk re-position полей. orderedFieldIds — все поля таблицы в
   * новом порядке. Оптимистично применяем порядок локально + PATCH
   * на бэкенд; на failure — reload(). Backend emit'ит N
   * `table:field:updated` events, useEffect handler выше apply'нет
   * новые positions у остальных клиентов.
   */
  const reorderFields = useCallback(
    async (orderedFieldIds: string[]): Promise<boolean> => {
      if (!tableId) return false;
      setTable((prev) => {
        if (!prev) return prev;
        const byId = new Map(prev.fields.map((f) => [f.id, f]));
        const reordered = orderedFieldIds
          .map((id, idx) => {
            const f = byId.get(id);
            return f ? { ...f, position: idx } : null;
          })
          .filter((f): f is TableField => f !== null);
        // Поля которых нет в orderedIds — сохраняем в хвосте (защита).
        const missing = prev.fields.filter((f) => !orderedFieldIds.includes(f.id));
        return { ...prev, fields: [...reordered, ...missing] };
      });
      try {
        await apiJson(
          `/api/tables/${encodeURIComponent(tableId)}/fields/reorder`,
          {
            method: "POST",
            body: JSON.stringify({ orderedIds: orderedFieldIds }),
            headers: { "Content-Type": "application/json" },
          },
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось переупорядочить колонки");
        await reload();
        return false;
      }
    },
    [tableId, reload],
  );

  /** v0.70: bulk re-position строк, тот же pattern что и reorderFields. */
  const reorderRows = useCallback(
    async (orderedRowIds: string[]): Promise<boolean> => {
      if (!tableId) return false;
      setTable((prev) => {
        if (!prev) return prev;
        const byId = new Map(prev.rows.map((r) => [r.id, r]));
        const reordered = orderedRowIds
          .map((id, idx) => {
            const r = byId.get(id);
            return r ? { ...r, position: idx } : null;
          })
          .filter((r): r is TableRow => r !== null);
        const missing = prev.rows.filter((r) => !orderedRowIds.includes(r.id));
        return { ...prev, rows: [...reordered, ...missing] };
      });
      try {
        await apiJson(
          `/api/tables/${encodeURIComponent(tableId)}/rows/reorder`,
          {
            method: "POST",
            body: JSON.stringify({ orderedIds: orderedRowIds }),
            headers: { "Content-Type": "application/json" },
          },
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось переупорядочить строки");
        await reload();
        return false;
      }
    },
    [tableId, reload],
  );

  return {
    table,
    loading,
    error,
    reload,
    rename,
    addField,
    updateField,
    removeField,
    addRow,
    updateRow,
    removeRow,
    reorderFields,
    reorderRows,
  };
}
