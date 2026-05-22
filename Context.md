# Context.md — глубокий контекст

> Архитектура, стек, домен, инфраструктура. Справочник — обращаться
> при необходимости. Текущее состояние/версии — в `ROADMAP.md`.

## Монорепо

```
apps/server    — бэкенд (Node + TypeScript)
apps/web       — фронтенд (React + TypeScript)
packages/shared— общий код (типы, утилиты)
docs/          — техническая документация
deploy/        — деплой-конфиги
```

## Стек

### Бэкенд (`apps/server`)
- **Fastify** (+ `@fastify/cors`, `helmet`, `jwt`, `rate-limit`, `static`)
- **Prisma** + **PostgreSQL** (`prisma/schema.prisma`, `prisma/migrations/`)
- **Socket.IO** — realtime (сообщения, presence, voice-сигналинг)
- **JWT** — auth (`jsonwebtoken`, `@fastify/jwt`); `bcryptjs` — пароли
- **otplib` + `qrcode`** — 2FA (TOTP)
- **web-push** — браузерные push-уведомления
- **sharp** — обработка изображений (аватары, аплоады)
- **zod** — валидация

### Фронтенд (`apps/web`)
- **React** + **Vite** (сборка `tsc -b && vite build`)
- **Socket.IO client** — realtime
- **livekit-client** — голос/видео/демонстрация экрана
- PWA: `public/sw.js` (service worker, кэш ассетов, `SW_VERSION`)
- Стили — vanilla CSS, слоями: `src/styles/`
  (`tokens.css` → `reset.css` → `components.css` → `effects.css` →
  `responsive.css` → `motion.css`, плюс `fonts.css`). Дизайн-токены
  в `tokens.css`, SOLAR-тема (светлая) — оверрайды в `effects.css`.

## Домен

- **Workspace / Server** — пространство команды. Каналы внутри.
- **Channel** — TEXT / VOICE / BROADCAST / EXECUTION; бывают временные.
- **Роли** — 10 ролей (OWNER…GUEST) + permission-matrix
  (`apps/server/src/lib/permissions.ts`).
- **Боты / AI-агенты** — 7 ролей ботов, system-prompts, mention-ответы.
- **Execution** — сообщение → сущность (TASK / DECISION / FOLLOW_UP),
  Kanban, дедлайны, эскалации.
- **Tables / Databases** — inline-таблицы с типами полей, RBAC.
- **Client Portals** — `CLIENT`-режим: внешние клиенты, счета, прогресс.
- **AI Memory** — embeddings, семантический поиск, дайджесты.

## Темы

- **VOID** — тёмная (основная), night-blue.
- **SOLAR** — светлая, Notion-crisp (переключатель в топбаре,
  `ThemeToggle.tsx` ставит `data-ec-theme="solar"` на `<html>`).
- Identity: violet `#8B5CF6` — primary-акцент, gold `#D4AF37` —
  premium-точечно, cyan/teal — только статусы.

## Инфраструктура / деплой

- GitHub: `PavelHopson/eclipse-chat`, ветка `master`.
- GitHub Actions: validate → deploy; deploy на **approve-gate**
  (environment `production`, id `15291822396`).
- Прод: `app.star-crm.ru/eclipse-chat/`, nginx + БД на сервере.
- `/api/version`, `/api/health` — для smoke после деплоя.

## Где что

- `ROADMAP.md` — состояние, версии, открытые направления.
- `docs/` — `API.md`, `BOT-API.md`, `SOCKET_EVENTS.md`,
  `DEPLOY-TO-STAR-CRM.md`, `CI-SETUP.md`, `LIVEKIT-SETUP.md`,
  `DEVELOPMENT.md`, `AI-SETUP.md`, `NEXT-GEN-OPERATIONAL-PLATFORM.md`.
- `apps/server/prisma/migrations/` — история схемы БД.
