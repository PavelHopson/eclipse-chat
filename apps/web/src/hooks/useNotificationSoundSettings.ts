import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDefaultNotificationSoundSettings,
  installNotificationSoundUnlock,
  playNotificationSound,
  readNotificationSoundSettings,
  subscribeNotificationSoundSettings,
  updateNotificationSoundSettings,
  type NotificationSoundKind,
  type NotificationSoundSettings,
} from "../lib/notificationSounds";

function isAudioSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext,
  );
}

export function useNotificationSoundSettings() {
  const [settings, setSettings] = useState<NotificationSoundSettings>(() =>
    typeof window === "undefined"
      ? getDefaultNotificationSoundSettings()
      : readNotificationSoundSettings(),
  );

  useEffect(() => {
    const cleanupUnlock = installNotificationSoundUnlock();
    const cleanupSubscribe = subscribeNotificationSoundSettings(setSettings);
    return () => {
      cleanupSubscribe();
      cleanupUnlock();
    };
  }, []);

  const update = useCallback((patch: Partial<NotificationSoundSettings>) => {
    setSettings(updateNotificationSoundSettings(patch));
  }, []);

  const test = useCallback((kind: NotificationSoundKind = "dm") => {
    playNotificationSound(kind, { force: true, key: "settings-test" });
  }, []);

  return useMemo(
    () => ({
      settings,
      supported: isAudioSupported(),
      update,
      test,
    }),
    [settings, test, update],
  );
}
