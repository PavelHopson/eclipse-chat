import type { ReactNode } from "react";
import { Modal } from "./Modal";

/**
 * DownloadAppModal (v1.6.79) — окно «Скачать приложение»: десктоп-установщики
 * (Win/Mac/Linux), Android-APK, инструкция для iPhone/iPad (PWA через Safari).
 * Открывается из топбара (шапки) и из профиль-меню. Все приложения — тонкие
 * обёртки над прод-вебом → всегда актуальный Eclipse Chat + уведомления.
 *
 * Стиль — на токенах (`var(--ec-*)`), значит автоматически верен и в OBSIDIAN,
 * и в SOLAR. Кнопки — общий класс `.ec-btn`.
 */

const REPO = "https://github.com/PavelHopson/eclipse-chat";
// Десктоп — страница последнего (non-prerelease) релиза: Win/Mac/Linux установщики.
const DESKTOP_URL = `${REPO}/releases/latest`;
// Android — прямой APK последнего android-пререлиза.
// ⚠️ Обновлять при каждом новом теге android-v* (пререлизы НЕ попадают в /latest).
const ANDROID_APK = `${REPO}/releases/download/android-v1.0.1/eclipse-chat-android-v1.0.1.apk`;

type Platform = "windows" | "mac" | "linux" | "android" | "ios" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "other";
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function Row({
  icon,
  title,
  subtitle,
  recommended,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  recommended?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--ec-radius-lg, 12px)",
        background: "var(--ec-surface-2)",
        border: recommended
          ? "1px solid var(--ec-border-accent)"
          : "1px solid var(--ec-border-subtle)",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
          width: 38,
          height: 38,
          borderRadius: "var(--ec-radius-md, 10px)",
          background: "var(--ec-accent-soft)",
          color: "var(--ec-accent)",
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ec-text)",
          }}
        >
          {title}
          {recommended && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 0.2,
                padding: "1px 7px",
                borderRadius: "var(--ec-radius-full, 999px)",
                background: "var(--ec-accent-soft)",
                color: "var(--ec-accent)",
                whiteSpace: "nowrap",
              }}
            >
              ваше устройство
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--ec-text-muted)", marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      {action}
    </div>
  );
}

export function DownloadAppModal({ onClose }: { onClose: () => void }) {
  const platform = detectPlatform();
  const isDesktopHere =
    platform === "windows" || platform === "mac" || platform === "linux";

  return (
    <Modal title="Скачать приложение" onClose={onClose} width={460}>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--ec-text-muted)",
        }}
      >
        Нативные приложения — лёгкие обёртки над веб-версией: открывают актуальный
        Eclipse Chat и шлют уведомления. Выберите устройство.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Row
          recommended={isDesktopHere}
          title="Компьютер"
          subtitle="Windows · macOS · Linux"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
          action={
            <button
              type="button"
              className="ec-btn ec-btn--primary ec-btn--sm"
              onClick={() => openExternal(DESKTOP_URL)}
            >
              Скачать
            </button>
          }
        />

        <Row
          recommended={platform === "android"}
          title="Android"
          subtitle="APK · установка вручную"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
          }
          action={
            <button
              type="button"
              className="ec-btn ec-btn--primary ec-btn--sm"
              onClick={() => openExternal(ANDROID_APK)}
            >
              Скачать APK
            </button>
          }
        />

        <Row
          recommended={platform === "ios"}
          title="iPhone · iPad"
          subtitle="Safari → Поделиться → На экран «Домой»"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="7" y="2" width="10" height="20" rx="2.5" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
          }
        />
      </div>
    </Modal>
  );
}
