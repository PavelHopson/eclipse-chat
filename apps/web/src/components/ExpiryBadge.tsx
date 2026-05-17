import { useEffect, useState } from "react";

/**
 * v0.74 #29 phase 1: countdown-badge для temporary rooms.
 *
 * Канал с заданным expiresAt — авто-удалится cron'ом. Бэдж показывает
 * сколько осталось (через 5 ч / через 12 мин / прямо сейчас), tick'ает
 * раз в 30 секунд (минимально для UX без жора CPU). При passed (delta < 0)
 * показывает «удаляется…» — cron подберёт в следующем проходе ≤ 1 мин.
 */

type Props = {
  expiresAt: string | null | undefined;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "удаляется…";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `через ${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `через ${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 48) {
    const rem = m % 60;
    return rem > 0 ? `через ${h} ч ${rem} мин` : `через ${h} ч`;
  }
  const d = Math.floor(h / 24);
  return `через ${d} д`;
}

export function ExpiryBadge({ expiresAt }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return null;
  const delta = target - now;

  // Меняем тон когда осталось <1ч — visible warning.
  const urgent = delta < 60 * 60 * 1000;
  return (
    <span
      title={`Авто-удаление: ${new Date(expiresAt).toLocaleString()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "0.15rem 0.55rem",
        borderRadius: "var(--ec-radius-full)",
        background: urgent ? "var(--ec-warn-soft)" : "var(--ec-surface-2)",
        color: urgent ? "var(--ec-warn)" : "var(--ec-text-muted)",
        border: `1px solid ${urgent ? "var(--ec-warn-soft)" : "var(--ec-border-subtle)"}`,
        fontSize: "var(--ec-text-2xs)",
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      {formatRemaining(delta)}
    </span>
  );
}
