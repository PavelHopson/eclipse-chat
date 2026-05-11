# @eclipse-chat/web

Vite + React 19 SPA — MVP-клиент Eclipse Chat.

**Текущее состояние:** работающий single-file MVP в `src/App.tsx`
(~557 строк) с auth flow, списком каналов, отправкой сообщений и
realtime через Socket.io. **Не пустой пакет**, как в старом README.

## Стек

- React 19 + TypeScript 5
- Vite 6 (build + dev server с proxy на :3001)
- socket.io-client 4
- Inline CSS styles (без Tailwind пока — добавится после v0.5)

## Команды

```bash
npm run dev         # Vite dev на :5173, proxy /api + /socket.io → :3001
npm run build       # tsc -b && vite build → dist/
npm run typecheck   # tsc -b --noEmit
npm run preview     # vite preview (после build)
```

## Что внутри `src/`

```
src/
├── App.tsx          — весь MVP в одном файле (split в v0.5)
├── main.tsx         — entry point, монтирует <App />
├── index.css        — inline-стили + сброс
└── vite-env.d.ts
```

## Vite proxy

`vite.config.ts` проксит на backend:

- `/api/*` → `http://127.0.0.1:3001`
- `/socket.io` → `http://127.0.0.1:3001` (с WebSocket upgrade)

В production это решается через Caddy / nginx — см.
[ROADMAP § v1.4](../../ROADMAP.md#v14--производственный-deployment).

## Дальше

Главный следующий шаг — **frontend split** в `lib/`, `hooks/`,
`components/`, `pages/` (см. [ROADMAP § v0.5](../../ROADMAP.md#v05--frontend-split-после-v04)).
Делается **после** Server/Member в backend (v0.4), чтобы новые хуки
сразу строились вокруг правильной модели.
