# Eclipse Chat — точка входа для агента

Claude Code загружает этот файл автоматически в начале каждой сессии.
Он подтягивает агент-контекст проекта:

@Persona.md
@Agents.md
@Context.md
@Memory.md
@Skills.md

---

**Persona.md — это БАЗА**, постоянный operating mode (4 линзы: Principal
Fullstack + Product Designer + Application Security + SDET). Каждое
решение проходит через все 4 одновременно. Quality bar checklist —
обязателен перед каждым ship.

**Источник истины по СОСТОЯНИЮ проекта** (версии, фичи, что сделано /
в работе, открытые направления) — `ROADMAP.md`. Читать его в начале
работы.

**Дорожная карта Discord-parity** (28 пунктов в 6 функциональных зонах) —
`docs/discord-parity-roadmap.md`. Источник истины для long-term UX
направления Eclipse Chat (5+ chain'ов).

Файлы выше — про то, **как работать** (бизнес, стиль, процессы,
архитектура, предпочтения), а не **что уже сделано**. Состояние не
дублировать сюда — оно живёт в `ROADMAP.md`.
