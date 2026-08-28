import { useEffect, useState, type RefObject } from "react";

export type VoiceRoomLayout = "split" | "stage" | "chat";
const layoutKey = (channelId: string) => `ec.voiceRoom.layout.${channelId}`;
function readLayout(channelId: string): VoiceRoomLayout {
  try {
    const saved = localStorage.getItem(layoutKey(channelId));
    if (saved === "stage" || saved === "chat") return saved;
  } catch { /* Storage is optional. */ }
  return "split";
}

export function resolveVoiceRoomLayout(preferred: VoiceRoomLayout, compact: boolean, hasChat: boolean): VoiceRoomLayout {
  return !hasChat ? "stage" : compact && preferred === "split" ? "stage" : preferred;
}

/** Respond to the room's available width, including open workspace side panels. */
export function useVoiceRoomLayout(channelId: string, ref: RefObject<HTMLDivElement | null>, hasChat: boolean) {
  const [choice, setChoice] = useState(() => ({ channelId, layout: readLayout(channelId) }));
  const [compact, setCompact] = useState(false);
  const preferred = choice.channelId === channelId ? choice.layout : readLayout(channelId);
  useEffect(() => {
    const room = ref.current;
    if (!room) return;
    const update = () => setCompact(room.clientWidth < 760);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(room);
    return () => observer.disconnect();
  }, [ref]);
  const selectLayout = (layout: VoiceRoomLayout) => {
    setChoice({ channelId, layout });
    try { localStorage.setItem(layoutKey(channelId), layout); } catch { /* In-memory fallback. */ }
  };
  // Never overwrite the desktop preference when space becomes constrained.
  const layout = resolveVoiceRoomLayout(preferred, compact, hasChat);
  return { layout, compact, selectLayout };
}
