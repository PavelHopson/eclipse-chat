import { useEffect, useRef } from "react";
import { voiceFeedback, type VoiceFeedbackState } from "../lib/voiceFeedback";
import { playNotificationSound } from "../lib/notificationSounds";
export function useVoiceFeedback(next: VoiceFeedbackState) {
  const previous = useRef(next);
  useEffect(() => {
    for (const cue of voiceFeedback(previous.current, next)) playNotificationSound(cue, { key: "local-controls" });
    previous.current = next;
  }, [next.channelId, next.connection, next.micMuted, next.deafened, next.camera, next.screen, next.pushToTalk, next.error]);
}
