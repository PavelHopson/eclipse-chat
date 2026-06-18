/**
 * v1.6.37 — детерминированный on-brand градиент-фолбэк для серверов без
 * banner-картинки. Раньше все bannerless-серверы показывали один и тот же
 * плоский `--fallback`; теперь каждый сервер получает осмысленный cover-градиент:
 *   - есть brandColor (HSL-тройка "H S% L%") → градиент строится вокруг этого
 *     тона, и баннер совпадает с уже выбранным акцентом сервера;
 *   - нет brandColor → детерминированно по hash(serverId) одна из 10
 *     курированных тёмных палитр (фиолетово-индиго-золото-вино; без случайной
 *     радуги, cyan/teal не используем декоративно — это статусные цвета).
 *
 * Чисто визуальный fallback (нет изображения), без хранения и schema-изменений.
 * Градиенты намеренно тёмные/глубокие — точки отображения добавляют overlay и
 * text-shadow, поэтому светлый текст остаётся читаемым поверх любого пресета.
 */

export interface BannerGradientSource {
  id: string;
  brandColor: string | null;
}

// Курированные cover-градиенты (замена фото 1500×500). Глубокие, не неон.
const PRESETS: readonly string[] = [
  "linear-gradient(135deg, #3a2766 0%, #1a1130 58%, #0c0a1c 100%)", // аметист
  "linear-gradient(135deg, #26305f 0%, #141a3a 60%, #0b0e22 100%)", // индиго-ночь
  "linear-gradient(135deg, #4a2a4f 0%, #241531 60%, #120b1e 100%)", // слива
  "linear-gradient(135deg, #5a3320 0%, #2c1a16 58%, #160d10 100%)", // амбра
  "linear-gradient(135deg, #1f3a44 0%, #13242e 60%, #0a151c 100%)", // тёмный петроль
  "linear-gradient(135deg, #3f2150 0%, #211138 55%, #0e0a1f 100%)", // королевский фиолет
  "linear-gradient(135deg, #542433 0%, #2a131f 60%, #150a12 100%)", // вино
  "linear-gradient(135deg, #2b2f63 0%, #191a3d 55%, #0c0c20 100%)", // сапфир
  "linear-gradient(135deg, #4d3a1f 0%, #271d13 60%, #13100a 100%)", // бронза
  "linear-gradient(135deg, #332a5e 0%, #1b1638 58%, #0c0a1e 100%)", // лаванда-ноктюрн
];

/** Стабильный беззнаковый хеш строки (FNV-подобный), для детерминированного выбора пресета. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// brandColor хранится как HSL-тройка "262 80% 60%" (см. COLOR_PRESETS в ServerHubModal).
function parseBrandHsl(raw: string): { h: number; s: number } | null {
  const m = raw.trim().match(/^(\d{1,3})\s+(\d{1,3})%?\s+(\d{1,3})%?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const s = Number(m[2]);
  if (h > 360 || s > 100) return null;
  return { h, s };
}

/**
 * CSS `background-image` градиент для cover-области сервера без banner-картинки.
 * Детерминирован: один и тот же сервер всегда получает один и тот же градиент
 * во всех точках отображения (rail header / welcome hero / превью настроек).
 */
export function serverBannerGradient(server: BannerGradientSource): string {
  const bc = server.brandColor?.trim();
  if (bc) {
    const hsl = parseBrandHsl(bc);
    if (hsl) {
      // Держим насыщенность в cinematic-диапазоне, тон уводим вниз к почти-чёрному.
      const s = Math.min(70, Math.max(35, hsl.s));
      const h2 = (hsl.h + 22) % 360;
      return `linear-gradient(135deg, hsl(${hsl.h} ${s}% 24%) 0%, hsl(${h2} ${s}% 12%) 58%, hsl(${hsl.h} ${Math.round(s * 0.65)}% 6%) 100%)`;
    }
  }
  return PRESETS[hashId(server.id) % PRESETS.length];
}
