import { useState } from "react";
import { AUTH_PROTOCOL_HEADER, apiPath, assertClientCanRequest, enforceClientUpdate } from "../lib/api";
import { captureAuth, captureDisplayedAuth, identityCurrent } from "../lib/storage";
import { commitRotatedSession } from "../lib/accountVault";
type ChangePasswordResult = { ok: boolean; error?: string };
export function useChangePassword() {
  const [busy, setBusy] = useState(false);
  const changePassword = async (currentPassword: string, newPassword: string): Promise<ChangePasswordResult> => {
    setBusy(true);
    try {
      assertClientCanRequest();
      const capture = captureDisplayedAuth();
      if (!capture.account) throw new Error("Необходимо войти в аккаунт");
      let account = capture.account;
      const send = () => fetch(apiPath("api/auth/change-password"), { method: "POST", headers: { "Content-Type": "application/json", [AUTH_PROTOCOL_HEADER]: "2", Authorization: `Bearer ${account.accessToken}` }, body: JSON.stringify({ currentPassword, newPassword }) });
      let response = await send();
      if (response.status === 426) await enforceClientUpdate(response, () => { if (!identityCurrent(capture.identity)) throw new Error("Аккаунт изменился. Повторите действие."); });
      // A rejected password change is never sent twice automatically.
      const data = await response.json().catch(() => ({})) as { accessToken?: string; token?: string; refreshToken?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось изменить пароль");
      const access = data.accessToken ?? data.token;
      if (!access || !data.refreshToken || !await commitRotatedSession(capture.identity, account.refreshToken, access, data.refreshToken, true)) throw new Error("Пароль изменён, но сессию сохранить не удалось. Войдите заново.");
      if (captureAuth().identity.accountId === capture.identity.accountId) window.dispatchEvent(new Event("ec:auth-password-changed"));
      return { ok: true };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Сетевая ошибка" }; }
    finally { setBusy(false); }
  };
  return { changePassword, busy };
}
