import type { VoiceActionSoundKind } from "./notificationSounds";
export type VoiceFeedbackState = {
  channelId: string | null; connection: string; micMuted: boolean; deafened: boolean;
  camera: boolean; screen: boolean; pushToTalk: boolean; error: string | null;
};
/** Confirmed SDK state only. A single deafen action must not emit a second mic cue. */
export function voiceFeedback(previous: VoiceFeedbackState, next: VoiceFeedbackState): VoiceActionSoundKind[] {
  if (next.error && next.error !== previous.error) return ["actionError"];
  if (previous.connection !== next.connection) {
    if (next.connection === "reconnecting") return ["callRecover"];
    if (next.connection === "connected") return ["callReady"];
    if (next.connection === "disconnected" && previous.connection === "connected") return ["callEnd"];
    return [];
  }
  if (next.connection !== "connected" || previous.channelId !== next.channelId) return [];
  const cues: VoiceActionSoundKind[] = [];
  if (previous.deafened !== next.deafened) cues.push(next.deafened ? "audioOff" : "audioOn");
  else if (!next.deafened && !next.pushToTalk && previous.micMuted !== next.micMuted)
    cues.push(next.micMuted ? "micOff" : "micOn");
  if (previous.camera !== next.camera) cues.push(next.camera ? "cameraOn" : "cameraOff");
  if (previous.screen !== next.screen) cues.push(next.screen ? "screenOn" : "screenOff");
  return cues;
}
