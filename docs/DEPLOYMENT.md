# Eclipse Chat — Deployment Guide

## Требования

- Docker 24+ и Docker Compose v2
- Домен с DNS A-записью (для HTTPS)
- VPS от 1GB RAM (рекомендуется 2GB+)

---

## Быстрый старт (Docker Compose)

```bash
git clone https://github.com/PavelHopson/eclipse-chat.git
cd eclipse-chat

# Настройка переменных окружения
cp .env.example .env
nano .env
```

### .env (обязательно заменить)

```env
# Домен
DOMAIN=chat.example.com

# JWT
JWT_ACCESS_SECRET=замените-на-случайную-строку-32-символа
JWT_REFRESH_SECRET=замените-на-другую-случайную-строку
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

# PostgreSQL
POSTGRES_USER=eclipse
POSTGRES_PASSWORD=замените-на-пароль
POSTGRES_DB=eclipse_chat

# Redis
REDIS_PASSWORD=замените-на-пароль

# MinIO
MINIO_ROOT_USER=eclipse
MINIO_ROOT_PASSWORD=замените-на-пароль-мин-8-символов
MINIO_BUCKET=eclipse-chat

# Файлы
MAX_FILE_SIZE_MB=25
```

### Запуск

```bash
# Production (с Caddy HTTPS)
docker compose up -d --build

# Локально без HTTPS
docker compose -f docker-compose.dev.yml up --build
```

Открыть **https://chat.example.com**

---

## Сервисы

| Сервис | Порт (внутренний) | Описание |
|--------|-------------------|----------|
| backend | 3000 | Fastify API + Socket.io |
| frontend | 5173 (dev) / 80 (prod) | React SPA |
| postgres | 5432 | PostgreSQL 17 |
| redis | 6379 | Redis 7 (кэш, presence) |
| minio | 9000 / 9001 | S3 файловое хранилище |
| caddy | 80, 443 | Reverse proxy + HTTPS |

---

## Обновление

```bash
git pull
docker compose down
docker compose up -d --build
```

---

## Бэкап

```bash
# PostgreSQL дамп
docker exec eclipse-postgres pg_dump -U eclipse eclipse_chat > backup_$(date +%Y%m%d).sql

# Восстановление
docker exec -i eclipse-postgres psql -U eclipse eclipse_chat < backup.sql
```

MinIO данные хранятся в volume `minio-data` — монтируй в бэкап как обычную папку.

---

## Локальная разработка

```bash
# Только инфраструктура (БД, Redis, MinIO)
docker compose -f docker-compose.dev.yml up postgres redis minio -d

# Backend
cd backend && npm install
npx prisma migrate dev --name init
npm run dev      # http://localhost:3000

# Frontend (отдельный терминал)
cd frontend && npm install
npm run dev      # http://localhost:5173
```
