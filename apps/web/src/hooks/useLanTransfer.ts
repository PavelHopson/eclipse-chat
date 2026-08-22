import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TauriEvent<T> = { event: string; id: number; payload: T };
type TauriInternals = {
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  transformCallback?: <T>(callback: (event: T) => void, once?: boolean) => number;
};

export type LanDevice = {
  fingerprint: string;
  alias: string;
  model: string | null;
  deviceType: string;
  host: string;
  port: number;
  secure: boolean;
};

export type LanSelection = {
  selectionId: string;
  files: Array<{ name: string; size: number; mediaType: string }>;
  totalBytes: number;
};

type LanStatus = {
  supported: boolean;
  protocolVersion: string;
  encrypted: boolean;
  checksumVerification: boolean;
  receivingEnabled: boolean;
  maxFiles: number;
  maxTotalBytes: number;
};

type LanProgress = {
  transferId: string;
  sentBytes: number;
  totalBytes: number;
  phase: "approval" | "upload" | "verified";
};

export type LanReceipt = {
  transferId: string;
  deviceAlias: string;
  filesSent: number;
  bytesSent: number;
  checksumsVerified: boolean;
};

function internals(): TauriInternals | null {
  if (typeof window === "undefined") return null;
  const value = (window as Window & { __TAURI_INTERNALS__?: TauriInternals })
    .__TAURI_INTERNALS__;
  return typeof value?.invoke === "function" ? value : null;
}

function message(error: unknown, fallback: string) {
  return typeof error === "string" && error.trim() ? error : fallback;
}

export function useLanTransfer() {
  const bridge = useMemo(internals, []);
  const [status, setStatus] = useState<LanStatus | null>(null);
  const [devices, setDevices] = useState<LanDevice[]>([]);
  const [device, setDevice] = useState<LanDevice | null>(null);
  const [selection, setSelection] = useState<LanSelection | null>(null);
  const [progress, setProgress] = useState<LanProgress | null>(null);
  const [receipt, setReceipt] = useState<LanReceipt | null>(null);
  const [busy, setBusy] = useState<"scan" | "pick" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const transferId = useRef<string | null>(null);

  useEffect(() => {
    if (!bridge?.invoke) return;
    bridge.invoke<LanStatus>("lan_transfer_status").then(setStatus).catch(() => {
      setError("Обновите Eclipse Desktop, чтобы включить передачу рядом.");
    });
  }, [bridge]);

  useEffect(() => {
    if (!bridge?.invoke || !bridge.transformCallback) return;
    let active = true;
    let eventId: number | null = null;
    const callback = bridge.transformCallback<TauriEvent<LanProgress>>((event) => {
      if (!active) return;
      const next = event.payload;
      if (!transferId.current || next.transferId === transferId.current) {
        transferId.current = next.transferId;
        setProgress(next);
      }
    });
    bridge.invoke<number>("plugin:event|listen", {
      event: "lan-transfer-progress",
      target: { kind: "Any" },
      handler: callback,
    }).then((id) => { eventId = id; }).catch(() => undefined);
    return () => {
      active = false;
      if (eventId !== null) {
        void bridge.invoke?.("plugin:event|unlisten", {
          event: "lan-transfer-progress",
          eventId,
        });
      }
    };
  }, [bridge]);

  const scan = useCallback(async () => {
    if (!bridge?.invoke || busy) return;
    setBusy("scan");
    setError(null);
    setReceipt(null);
    try {
      const found = await bridge.invoke<LanDevice[]>("lan_transfer_scan");
      setDevices(found);
      if (device && !found.some((item) => item.fingerprint === device.fingerprint)) {
        setDevice(null);
      }
    } catch (cause) {
      setError(message(cause, "Не удалось найти устройства в локальной сети."));
    } finally {
      setBusy(null);
    }
  }, [bridge, busy, device]);

  const pickFiles = useCallback(async () => {
    if (!bridge?.invoke || busy) return;
    setBusy("pick");
    setError(null);
    setReceipt(null);
    try {
      const picked = await bridge.invoke<LanSelection | null>("lan_transfer_pick_files");
      if (picked) setSelection(picked);
    } catch (cause) {
      setError(message(cause, "Не удалось выбрать файлы."));
    } finally {
      setBusy(null);
    }
  }, [bridge, busy]);

  const send = useCallback(async (pin: string) => {
    if (!bridge?.invoke || busy || !selection || !device) return;
    const id = crypto.randomUUID();
    transferId.current = id;
    setBusy("send");
    setError(null);
    setReceipt(null);
    setProgress({ transferId: id, sentBytes: 0, totalBytes: selection.totalBytes, phase: "approval" });
    try {
      const result = await bridge.invoke<LanReceipt>("lan_transfer_send", {
        selectionId: selection.selectionId,
        transferId: id,
        fingerprint: device.fingerprint,
        pin: pin.trim() || null,
        confirmed: true,
      });
      setReceipt(result);
      setSelection(null);
      setProgress({ transferId: id, sentBytes: result.bytesSent, totalBytes: result.bytesSent, phase: "verified" });
    } catch (cause) {
      setError(message(cause, "Передача не завершена."));
    } finally {
      setBusy(null);
    }
  }, [bridge, busy, device, selection]);

  const cancel = useCallback(async () => {
    if (!bridge?.invoke || !transferId.current) return;
    await bridge.invoke<boolean>("lan_transfer_cancel", { transferId: transferId.current });
  }, [bridge]);

  return {
    supported: bridge !== null,
    status,
    devices,
    device,
    setDevice,
    selection,
    progress,
    receipt,
    busy,
    error,
    scan,
    pickFiles,
    send,
    cancel,
  };
}
