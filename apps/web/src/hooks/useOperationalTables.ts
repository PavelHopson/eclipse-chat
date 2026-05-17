import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../lib/api";

/**
 * Operational Tables phase 1 (v0.59) — два hooks:
 *   useOperationalTables(serverId)  — list для sidebar / Context Tree
 *   useOperationalTable(tableId)    — full detail + CRUD ops
 *
 * Realtime — out of scope phase 1 (manual refresh). Phase 2 — emit
 * `table:*` events, hook subscribes автоматически.
 */

export type TableFieldType = "TEXT" | "NUMBER" | "STATUS" | "DATE";

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

export function useOperationalTables(serverId: string | null) {
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

  return { tables, loading, error, reload, createTable, deleteTable };
}

/** ============================================================
 *  useOperationalTable — full detail of single table
 *  ============================================================
 */

export function useOperationalTable(tableId: string | null) {
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
  };
}
