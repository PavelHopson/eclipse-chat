import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";

export type UserStatus = "ONLINE" | "IDLE" | "DND" | "INVISIBLE";

export type Profile = {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  activityText: string | null;
  activityEmoji: string | null;
  status?: UserStatus;
  twoFactorEnabled?: boolean;
  createdAt: string;
};

type ProfileResponse = { user: Profile };

/**
 * Профиль текущего пользователя: загрузка + редактирование + аватар.
 *
 * Avatar upload идёт через JSON+base64 (не multipart) — см. комментарий
 * в `apps/server/src/routes/users.ts`. Браузер читает File через FileReader,
 * чистит `data:...;base64,` префикс, отправляет POST JSON.
 *
 * Все ошибки складываются в `error: string | null`. Сетевые ошибки →
 * generic message; ApiError с backend message → как есть.
 */
export function useProfile(enabled: boolean) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<ProfileResponse>("/api/users/me/profile");
      setProfile(data.user);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить профиль");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void reload();
    }
  }, [enabled, reload]);

  const updateProfile = useCallback(
    async (data: { displayName?: string; bio?: string | null }): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await apiJson<ProfileResponse>("/api/users/me/profile", {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        setProfile(res.user);
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось сохранить");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const uploadAvatar = useCallback(async (file: File): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      // Принимаем любой image/*; backend разрулит через sharp + понятный error.
      // HEIC из iPhone иногда приходит с MIME "" или "application/octet-stream" —
      // тоже пропускаем, sharp прочитает magic bytes.
      const isImage =
        /^image\//.test(file.type) ||
        file.type === "" ||
        file.type === "application/octet-stream";
      if (!isImage) {
        setError(`Файл ${file.type} — не изображение`);
        return false;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(
          `Файл ${(file.size / 1024 / 1024).toFixed(1)} MB слишком большой. Максимум 20 MB.`,
        );
        return false;
      }
      const dataBase64 = await fileToBase64(file);
      // Если MIME пустой — даём backend hint что это HEIC (iPhone частый кейс)
      const contentType = file.type || "image/heic";
      const res = await apiJson<ProfileResponse>("/api/users/me/avatar", {
        method: "POST",
        body: JSON.stringify({ contentType, dataBase64 }),
      });
      setProfile(res.user);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить аватар");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteAvatar = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<ProfileResponse>("/api/users/me/avatar", {
        method: "DELETE",
      });
      setProfile(res.user);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось удалить аватар");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const updateStatus = useCallback(async (status: UserStatus): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiJson<ProfileResponse>("/api/users/me/status", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setProfile(res.user);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось изменить статус");
      return false;
    }
  }, []);

  const updateActivity = useCallback(
    async (data: {
      activityText?: string | null;
      activityEmoji?: string | null;
    }): Promise<boolean> => {
      setError(null);
      const previous = profile;
      if (previous) {
        setProfile({
          ...previous,
          activityText:
            data.activityText === undefined ? previous.activityText : data.activityText,
          activityEmoji:
            data.activityEmoji === undefined ? previous.activityEmoji : data.activityEmoji,
        });
      }
      try {
        const res = await apiJson<ProfileResponse>("/api/users/me/activity", {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        setProfile(res.user);
        return true;
      } catch (e) {
        if (previous) setProfile(previous);
        setError(e instanceof ApiError ? e.message : "Не удалось сохранить статус");
        return false;
      }
    },
    [profile],
  );

  return {
    profile,
    loading,
    busy,
    error,
    reload,
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    updateStatus,
    updateActivity,
  };
}

/** FileReader → base64 без префикса `data:...;base64,`. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected FileReader result"));
        return;
      }
      const idx = result.indexOf("base64,");
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.readAsDataURL(file);
  });
}
