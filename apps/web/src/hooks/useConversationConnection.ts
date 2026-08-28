import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

export type ConversationConnection = "connecting" | "online" | "reconnecting" | "offline" | "recovered";
export function useConversationConnection(socket: Socket | null) {
  const [state, setState] = useState<ConversationConnection>(() => navigator.onLine ? "connecting" : "offline");
  useEffect(() => {
    let lost = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const disconnected = () => {
      lost = true;
      clearTimeout(timer);
      setState(navigator.onLine ? "reconnecting" : "offline");
    };
    const connected = () => {
      clearTimeout(timer);
      setState(lost ? "recovered" : "online");
      lost = false;
      timer = setTimeout(() => setState("online"), 3500);
    };
    const online = () => {
      if (socket?.connected) connected();
      else { setState("reconnecting"); socket?.connect(); }
    };
    setState(!navigator.onLine ? "offline" : socket?.connected ? "online" : "connecting");
    socket?.on("connect", connected);
    socket?.on("disconnect", disconnected);
    socket?.on("connect_error", disconnected);
    window.addEventListener("offline", disconnected);
    window.addEventListener("online", online);
    return () => {
      clearTimeout(timer);
      socket?.off("connect", connected);
      socket?.off("disconnect", disconnected);
      socket?.off("connect_error", disconnected);
      window.removeEventListener("offline", disconnected);
      window.removeEventListener("online", online);
    };
  }, [socket]);
  const retry = useCallback(() => {
    if (!navigator.onLine) { setState("offline"); return; }
    if (socket?.connected) { setState("online"); return; }
    setState("reconnecting");
    socket?.connect();
  }, [socket]);
  return { state, retry, connected: state === "online" || state === "recovered" };
}
