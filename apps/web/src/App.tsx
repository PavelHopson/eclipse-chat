import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { io, type Socket } from "socket.io-client";

const LS_ACCESS = "eclipse_chat_access";
const LS_REFRESH = "eclipse_chat_refresh";
const LS_LEGACY = "eclipse_chat_token";

type PublicUser = { id: string; email: string; displayName: string; createdAt: string };
type ChannelRow = { id: string; name: string; slug: string; _count: { messages: number } };
type MessageRow = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; displayName: string };
};

type Health = { ok: boolean; service: string; database?: boolean } | null;

function migrationLegacy() {
  try {
    const legacy = localStorage.getItem(LS_LEGACY);
    if (legacy) {
      if (!localStorage.getItem(LS_ACCESS)) {
        localStorage.setItem(LS_ACCESS, legacy);
      }
      localStorage.removeItem(LS_LEGACY);
    }
  } catch {
    /* нет localStorage (редко) */
  }
}

function getAccess() {
  return localStorage.getItem(LS_ACCESS);
}

function getRefresh() {
  return localStorage.getItem(LS_REFRESH);
}

function setTokenPair(access: string | null, refresh: string | null) {
  if (access) {
    localStorage.setItem(LS_ACCESS, access);
  } else {
    localStorage.removeItem(LS_ACCESS);
  }
  if (refresh) {
    localStorage.setItem(LS_REFRESH, refresh);
  } else {
    localStorage.removeItem(LS_REFRESH);
  }
}

function clearAllTokens() {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_LEGACY);
}

type RefreshState = { promise: Promise<string | null> | null };

export function App() {
  const refreshRef = useRef<RefreshState>({ promise: null });
  const [health, setHealth] = useState<Health>(null);
  const [err, setErr] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketLog, setSocketLog] = useState<string | null>(null);
  const [authSocketRev, setAuthSocketRev] = useState(0);

  const [view, setView] = useState<"auth" | "app">("auth");
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [user, setUser] = useState<PublicUser | null>(null);

  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshRef.current.promise) {
      return refreshRef.current.promise;
    }
    const r0 = getRefresh();
    if (!r0) {
      return null;
    }
    const p = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: r0 }),
        });
        if (!res.ok) {
          clearAllTokens();
          return null;
        }
        const d = (await res.json()) as { accessToken?: string; token?: string; refreshToken: string };
        const access = d.accessToken ?? d.token;
        if (!access) {
          clearAllTokens();
          return null;
        }
        setTokenPair(access, d.refreshToken);
        setAuthSocketRev((v) => v + 1);
        return access;
      } finally {
        refreshRef.current.promise = null;
      }
    })();
    refreshRef.current.promise = p;
    return p;
  }, []);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const build = (access: string | null) => {
        const headers = new Headers(init?.headers);
        headers.set("Content-Type", "application/json");
        if (access) {
          headers.set("Authorization", `Bearer ${access}`);
        }
        return fetch(path, { ...init, headers });
      };
      const access0 = getAccess();
      let res = await build(access0);
      if (res.status === 401) {
        const r = getRefresh();
        if (r) {
          const next = await doRefresh();
          if (next) {
            res = await build(next);
          }
        }
      }
      return res;
    },
    [doRefresh],
  );

  const loadMe = useCallback(async () => {
    migrationLegacy();
    if (!getAccess() && getRefresh()) {
      const ok = await doRefresh();
      if (!ok) {
        setView("auth");
        return;
      }
    }
    const t = getAccess();
    if (!t) {
      setView("auth");
      return;
    }
    const r = await api("/api/auth/me");
    if (!r.ok) {
      setTokenPair(null, null);
      setView("auth");
      return;
    }
    const d = (await r.json()) as { user: PublicUser | null };
    if (d.user) {
      setUser(d.user);
      setView("app");
    } else {
      setTokenPair(null, null);
      setView("auth");
    }
  }, [api, doRefresh]);

  const loadChannels = useCallback(async () => {
    const r = await api("/api/channels");
    if (!r.ok) {
      return;
    }
    const d = (await r.json()) as { channels: ChannelRow[] };
    setChannels(d.channels);
  }, [api]);

  const loadMessages = useCallback(
    async (id: string) => {
      const r = await api(`/api/channels/${id}/messages?take=80`);
      if (!r.ok) {
        return;
      }
      const d = (await r.json()) as { messages: MessageRow[] };
      setMessages(d.messages);
    },
    [api],
  );

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    migrationLegacy();
    const t = getAccess() ?? undefined;
    const s: Socket = io({ path: "/socket.io", auth: t ? { token: t } : {} });
    s.on("connect", () => {
      setSocketLog("WebSocket: подключено");
    });
    s.on("server:hello", (p: { t: number; msg: string }) => {
      setSocketLog(`Socket: ${p.msg} @ ${new Date(p.t).toLocaleTimeString()}`);
    });
    s.on(
      "message:new",
      (p: { messageId: string; content: string; channelId: string; userId: string; displayName: string; createdAt: string }) => {
        if (p.channelId !== selectedIdRef.current) {
          return;
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === p.messageId)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: p.messageId,
              content: p.content,
              createdAt: p.createdAt,
              user: { id: p.userId, displayName: p.displayName },
            },
          ];
        });
        setChannels((ch) =>
          ch.map((c) => (c.id === p.channelId ? { ...c, _count: { messages: c._count.messages + 1 } } : c)),
        );
      },
    );
    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.close();
    };
  }, [authSocketRev]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (view !== "app" || !getAccess()) {
      return;
    }
    void (async () => {
      const r = await api("/api/channels");
      if (r.ok) {
        const d = (await r.json()) as { channels: ChannelRow[] };
        setChannels(d.channels);
        setSelectedId((cur) => cur ?? d.channels[0]?.id ?? null);
      }
    })();
  }, [view, api]);

  useEffect(() => {
    if (!socket || !selectedId) {
      return;
    }
    socket.emit("channel:join", selectedId);
    return () => {
      socket.emit("channel:leave", selectedId);
    };
  }, [socket, selectedId]);

  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId, loadMessages]);

  async function submitAuth() {
    setErr(null);
    const path = authTab === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      authTab === "login" ? { email, password } : { email, password, displayName: displayName || "User" };
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await r.json().catch(() => ({}))) as {
      error?: string;
      accessToken?: string;
      refreshToken?: string;
      token?: string;
      user?: PublicUser;
    };
    if (!r.ok) {
      setErr(d.error ?? "Ошибка");
      return;
    }
    const acc = d.accessToken ?? d.token;
    if (acc && d.refreshToken) {
      setTokenPair(acc, d.refreshToken);
    } else if (d.token) {
      setTokenPair(d.token, null);
    }
    if (d.user) {
      setUser(d.user);
    }
    setView("app");
    setPassword("");
    setAuthSocketRev((v) => v + 1);
    await loadChannels();
  }

  async function createChannel() {
    const name = newChannelName.trim();
    if (!name) {
      return;
    }
    setErr(null);
    const r = await api("/api/channels", { method: "POST", body: JSON.stringify({ name }) });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Не удалось создать канал");
      return;
    }
    setNewChannelName("");
    await loadChannels();
  }

  async function sendMessage() {
    if (!selectedId) {
      return;
    }
    const content = draft.trim();
    if (!content) {
      return;
    }
    setErr(null);
    const r = await api(`/api/channels/${selectedId}/messages`, { method: "POST", body: JSON.stringify({ content }) });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Не удалось отправить");
      return;
    }
    setDraft("");
  }

  async function logout() {
    const acc = getAccess();
    if (acc) {
      void (await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }));
    }
    clearAllTokens();
    setUser(null);
    setChannels([]);
    setSelectedId(null);
    setMessages([]);
    setView("auth");
    setAuthSocketRev((v) => v + 1);
  }

  const fieldBase: CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.65rem",
    borderRadius: 8,
    border: "1px solid #2a2a32",
    background: "#1a1a20",
    color: "#e8e8ed",
  };

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        background: "#0f0f12",
        color: "#e8e8ed",
        padding: "1.5rem",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <h1 style={{ margin: "0 0 0.5rem" }}>Eclipse Chat</h1>
      <p style={{ opacity: 0.6, fontSize: "0.9rem", margin: "0 0 1rem" }}>
        {err && <span style={{ color: "#f88" }}>{err} · </span>}
        {health && (
          <>
            API: {health.database === false ? "БД: ошибка" : "БД: ok"} · {socketLog}
          </>
        )}
      </p>

      {view === "auth" && (
        <section style={{ maxWidth: 400 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setAuthTab("login")}
              style={{ flex: 1, padding: 8, background: authTab === "login" ? "#2a2a3a" : "transparent" }}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("register")}
              style={{ flex: 1, padding: 8, background: authTab === "register" ? "#2a2a3a" : "transparent" }}
            >
              Регистрация
            </button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {authTab === "register" && (
              <input
                placeholder="Имя (ник)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={fieldBase}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={fieldBase}
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Пароль (8+)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={fieldBase}
              autoComplete={authTab === "login" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              onClick={() => void submitAuth()}
              style={{ padding: "0.65rem", borderRadius: 8, background: "#3b5ccc", color: "#fff", border: "none" }}
            >
              {authTab === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </div>
        </section>
      )}

      {view === "app" && user && (
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>
          <aside
            style={{
              border: "1px solid #2a2a32",
              borderRadius: 12,
              padding: 12,
              background: "#131318",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: "0.85rem", opacity: 0.8 }}>{user.displayName}</p>
            <button type="button" onClick={() => void logout()} style={{ marginBottom: 12, fontSize: "0.85rem" }}>
              Выйти
            </button>
            <h2 style={{ fontSize: "0.95rem", margin: "0 0 8px" }}>Каналы</h2>
            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    textAlign: "left",
                    padding: "0.4rem 0.5rem",
                    borderRadius: 8,
                    background: c.id === selectedId ? "#2a2a3a" : "transparent",
                    border: "1px solid #2a2a32",
                    color: "#e8e8ed",
                    cursor: "pointer",
                  }}
                >
                  {c.name} <span style={{ opacity: 0.5 }}>({c._count.messages})</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                placeholder="Новый канал"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                style={fieldBase}
              />
              <button type="button" onClick={() => void createChannel()}>
                Создать
              </button>
            </div>
          </aside>

          <section
            style={{
              border: "1px solid #2a2a32",
              borderRadius: 12,
              padding: 12,
              minHeight: 400,
              display: "flex",
              flexDirection: "column",
              background: "#131318",
            }}
          >
            {!selectedId && <p style={{ opacity: 0.6 }}>Выберите канал слева (есть #general из seed).</p>}
            {selectedId && (
              <>
                <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: "0.5rem 0.65rem",
                        background: "#1a1a22",
                        borderRadius: 8,
                        fontSize: "0.9rem",
                      }}
                    >
                      <strong style={{ color: "#9ac" }}>{m.user.displayName}</strong>
                      <span style={{ opacity: 0.4, fontSize: "0.75rem", marginLeft: 8 }}>{m.createdAt.slice(11, 19)}</span>
                      <div style={{ marginTop: 4 }}>{m.content}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Сообщение…"
                    style={{ ...fieldBase, flex: 1 }}
                  />
                  <button type="button" onClick={() => void sendMessage()}>
                    Отпр.
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
