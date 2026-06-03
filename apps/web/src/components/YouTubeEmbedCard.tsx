import { parseYouTubeUrl, toYouTubeEmbedUrl } from "../lib/youtubeEmbed";

type Props = {
  url: string;
};

export function YouTubeEmbedCard({ url }: Props) {
  const video = parseYouTubeUrl(url);
  if (!video) return null;

  return (
    <section className="ec-youtube-embed" aria-label="Видео YouTube">
      <div className="ec-youtube-embed__header">
        <span className="ec-youtube-embed__label">Видео YouTube</span>
        <a
          className="ec-youtube-embed__link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть на YouTube
        </a>
      </div>
      <div className="ec-youtube-embed__frame">
        <iframe
          title="Плеер YouTube"
          src={toYouTubeEmbedUrl(video)}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allowFullScreen
        />
      </div>
    </section>
  );
}
