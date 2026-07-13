<div align="center">

# Eclipse Chat

### Self-hosted operational collaboration platform

**Communication + execution + AI + memory + workflows**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io)

Live: [https://app.star-crm.ru/eclipse-chat/](https://app.star-crm.ru/eclipse-chat/)

</div>

---

## What It Is

Eclipse Chat is not a Discord clone. The chat surface is only the first layer.

The product direction is an operational collaboration platform where teams can talk, decide,
assign, remember, automate and run work from one private self-hosted system.

Core idea:

- workspaces instead of generic servers;
- rooms for text, voice, execution, AI, clients and focus;
- messages can become tasks, decisions, reminders, risks or approvals;
- AI agents act as operational teammates, not decorative bots;
- memory, search and summaries help teams recover context without reading everything manually.

The full product map lives in [ROADMAP.md](ROADMAP.md).

## Current Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | Node.js, Fastify, Socket.io, Prisma |
| Database | PostgreSQL in production |
| Realtime | Socket.io + LiveKit path for voice/video |
| AI | Provider layer with OpenAI-compatible routing and OmniRoute support |

## Local Development

```bash
npm ci
npm run dev:server
npm run dev:web
```

Useful scripts:

```bash
npm run typecheck
npm run build
npm run db:migrate
npm run db:migrate:deploy
```

Server environment lives in `apps/server/.env`. Do not commit secrets.

## Production Deploy

The current VPS deploy flow:

```bash
cd /var/www/eclipse-chat
git pull origin master
npm ci
cd apps/server && npx prisma migrate deploy && cd ../..
npm run build
sudo supervisorctl restart eclipse-chat-server
bash deploy/scripts/smoke.sh
```

## Documentation

- [ROADMAP.md](ROADMAP.md) — source of truth for project status, versions and next steps.
- [docs/API.md](docs/API.md) — REST API.
- [docs/SOCKET_EVENTS.md](docs/SOCKET_EVENTS.md) — realtime events.
- [docs/AI-SETUP.md](docs/AI-SETUP.md) — AI provider setup.
- [docs/LIVEKIT.md](docs/LIVEKIT.md) — voice/video infrastructure.
- [docs/NETWORK-GATEWAY.md](docs/NETWORK-GATEWAY.md) — optional private network gateway.
- [docs/design/design-brief-v2.md](docs/design/design-brief-v2.md) — visual language.
- [docs/design/surface-map.md](docs/design/surface-map.md) — product surface inventory.
- [docs/design/design-system-reference.md](docs/design/design-system-reference.md) — condensed design-system notes.

## License

[MIT](LICENSE)
