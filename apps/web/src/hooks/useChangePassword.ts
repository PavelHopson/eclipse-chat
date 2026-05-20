import { useState } from "react";
import { ApiError, apiJson } from "../lib/api";
import { setTokenPair } from "../lib/storage";

/**
 * Смена пароля из профиля. POST /api/auth/change-password требует
 * текущий пароль; при успехе сервер инвалидирует все сессии и выдаёт
 * свежую token-пару — сохраняем её, чтобы текущее устройство не
 * вылетело.
 */
type ChangePasswordResult = { ok: boolean; error?: string };

export function useChangePassword() {
  const [busy, setBusy] = useState(false);

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> => {
    setBusy(true);
    try {
      const res = await apiJson<{
        accessToken?: string;
        token?: string;
        refreshToken?: string;
      }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const access = res.accessToken ?? res.token;
      if (access && res.refreshToken) {
        setTokenPair(access, res.refreshToken);
      }
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof ApiError ? e.message : "Сетевая ошибка",
      };
    } finally {
      setBusy(false);
    }
  };

  return { changePassword, busy };
}
