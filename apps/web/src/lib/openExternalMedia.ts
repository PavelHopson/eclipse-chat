import type { MouseEvent } from "react";

type TauriInternals = {
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

function desktopInvoke(): TauriInternals["invoke"] | null {
  if (typeof window === "undefined") return null;
  const internals = (
    window as Window & { __TAURI_INTERNALS__?: TauriInternals }
  ).__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function"
    ? internals.invoke.bind(internals)
    : null;
}

function isOfficialYouTubeUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && YOUTUBE_HOSTS.has(url.hostname.toLowerCase().replace(/\.$/, ""));
  } catch {
    return false;
  }
}

/**
 * Browser links keep native anchor behaviour. The desktop shell opens the
 * same validated URL in the system browser, where a user's network tooling
 * and media settings are available. Older shells fall back to same-window
 * navigation instead of leaving the control looking unresponsive.
 */
export function openExternalYouTube(
  event: MouseEvent<HTMLAnchorElement>,
  url: string,
): void {
  const invoke = desktopInvoke();
  if (!invoke || !isOfficialYouTubeUrl(url)) return;

  event.preventDefault();
  void invoke("open_external_media", { url }).catch(() => {
    window.location.assign(url);
  });
}
