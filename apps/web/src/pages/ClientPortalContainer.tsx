import { useCallback } from "react";
// v1.5.28 — Portal тоже использует ec-* classes из components/responsive/
// cockpit/player — подгружаем shared app.css lazy вместе с этим chunk'ом.
import "../styles/app.css";
import { useClientPortal } from "../hooks/useClientPortal";
import { ClientPortalPage } from "./ClientPortalPage";

/**
 * v0.83 #24 phase 1: ClientPortalContainer.
 *
 * Wrapper, который связывает hook (data fetch) и presentational page. App.tsx
 * рендерит этот контейнер когда URL = `#/portal/<serverId>` и user
 * authenticated.
 */

type Props = {
  serverId: string;
};

export function ClientPortalContainer({ serverId }: Props) {
  const { data, loading, error, reload } = useClientPortal(serverId);

  const handleExit = useCallback(() => {
    // Очистка hash → App.tsx detect'нет смену и переключит обратно на AppShell.
    // pushState вместо `location.hash = ""` — оставляем path/search чистыми.
    if (typeof window !== "undefined") {
      window.history.pushState(
        {},
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      // hashchange не fires при manual pushState — эмитим событие вручную
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, []);

  return (
    <ClientPortalPage
      data={data}
      loading={loading}
      error={error}
      onReload={reload}
      onExit={handleExit}
    />
  );
}
