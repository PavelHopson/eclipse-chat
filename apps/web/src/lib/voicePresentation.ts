/** Display only: never mutate the attachment filename or URL. */
export function musicTrackTitle(filename: string): string {
  const title = filename.replace(/\.(mp3|wav|ogg|opus|flac|m4a|aac|webm|mp4)$/i, "")
    .replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return title || "Без названия";
}

export function speechLevel(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function voiceChatWidth(value: number, roomWidth: number): number {
  return Math.round(Math.min(Math.max(300, roomWidth - 380), 620, Math.max(300, Number.isFinite(value) ? value : 380)));
}

export function musicSpeechGain(enabled: boolean, connected: boolean, speaking: boolean): number {
  return enabled && connected && speaking ? .24 : 1;
}
