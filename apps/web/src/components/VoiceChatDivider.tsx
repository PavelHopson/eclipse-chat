import { useEffect, useRef, type RefObject } from "react";
import { preferredAudioChatWidth } from "../lib/mediaPresentation";
import { voiceChatWidth } from "../lib/voicePresentation";

export function VoiceChatDivider({ roomRef, channelId, visual = false, compactAudio = false }: { roomRef: RefObject<HTMLDivElement | null>; channelId: string; visual?: boolean; compactAudio?: boolean }) {
  const separator = useRef<HTMLDivElement>(null);
  const value = useRef(380);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const customized = useRef(false);
  const desired = useRef(380);
  const key = "ec.voiceRoom.chatWidth." + channelId;
  const apply = (width: number, save = false) => {
    const room = roomRef.current;
    if (!room) return;
    value.current = voiceChatWidth(width, room.clientWidth, compactAudio);
    room.style.setProperty("--ec-voice-chat-width", value.current + "px");
    separator.current?.setAttribute("aria-valuenow", String(value.current));
    separator.current?.setAttribute("aria-valuemax", String(voiceChatWidth(compactAudio ? 820 : 620, room.clientWidth, compactAudio)));
    if (save) { customized.current = true; desired.current = width; try { localStorage.setItem(key, String(value.current)); } catch { /* Optional preference. */ } }
  };
  useEffect(() => {
    const preferred = () => visual ? 380 : preferredAudioChatWidth(roomRef.current?.clientWidth ?? 900, compactAudio);
    let saved = preferred();
    customized.current = false;
    try { const raw = localStorage.getItem(key); if (raw !== null && Number.isFinite(Number(raw))) { saved = Number(raw); customized.current = true; } } catch { /* Optional preference. */ }
    desired.current = saved;
    apply(saved);
    const room = roomRef.current;
    if (!room) return;
    const observer = new ResizeObserver(() => apply(customized.current ? desired.current : preferred()));
    observer.observe(room);
    return () => { observer.disconnect(); drag.current = null; };
  }, [key, roomRef, visual, compactAudio]);
  return <div ref={separator} className="ec-voice-chat-divider" role="separator" tabIndex={0}
    aria-label="Ширина чата" aria-orientation="vertical" aria-valuemin={300} aria-valuemax={compactAudio ? 820 : 620}
    aria-valuenow={380}
    data-native-cursor
    onDoubleClick={() => apply(visual ? 380 : preferredAudioChatWidth(roomRef.current?.clientWidth ?? 900, compactAudio), true)}
    onKeyDown={event => {
      const steps: Record<string, number> = { ArrowLeft: 24, ArrowRight: -24, Home: -10000, End: 10000 };
      if (!(event.key in steps)) return;
      event.preventDefault(); apply(value.current + steps[event.key], true);
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      drag.current = { x: event.clientX, width: value.current };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => { if (drag.current) apply(drag.current.width + drag.current.x - event.clientX); }}
    onPointerUp={event => {
      if (!drag.current) return;
      apply(value.current, true); drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { if (drag.current) apply(drag.current.width); drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}><span /></div>;
}
