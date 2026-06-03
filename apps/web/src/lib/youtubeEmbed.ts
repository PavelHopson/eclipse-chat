export type YouTubeVideo = {
  videoId: string;
  startSeconds: number | null;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function cleanVideoId(value: string | null): string | null {
  if (!value) return null;
  const id = value.trim().split(/[?&#/]/)[0] ?? "";
  return VIDEO_ID_RE.test(id) ? id : null;
}

function parseStartParam(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Math.min(Number(value), 86400);

  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i.exec(value);
  if (!match) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? Math.min(total, 86400) : null;
}

export function parseYouTubeUrl(rawUrl: string): YouTubeVideo | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const host = normalizeHost(url.hostname);
    if (!YOUTUBE_HOSTS.has(host)) return null;

    let videoId: string | null = null;
    if (host === "youtu.be" || host === "www.youtu.be") {
      videoId = cleanVideoId(url.pathname.replace(/^\/+/, ""));
    } else if (url.pathname === "/watch") {
      videoId = cleanVideoId(url.searchParams.get("v"));
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "")) {
        videoId = cleanVideoId(parts[1] ?? null);
      }
    }

    if (!videoId) return null;

    return {
      videoId,
      startSeconds: parseStartParam(url.searchParams.get("start") ?? url.searchParams.get("t")),
    };
  } catch {
    return null;
  }
}

export function toYouTubeEmbedUrl(video: YouTubeVideo): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });

  if (video.startSeconds) {
    params.set("start", String(video.startSeconds));
  }

  return `https://www.youtube-nocookie.com/embed/${video.videoId}?${params.toString()}`;
}
