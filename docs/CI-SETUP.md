# Eclipse Chat — CI / Auto-deploy setup

One-time настройка GitHub Actions auto-deploy для Eclipse Chat. После
этого каждый push в `master` будет автоматически валидироваться (TypeScript
+ build) и деплоиться на cv6067007.novalocal через SSH.

Workflow: [`.github/workflows/deploy-prod.yml`](../.github/workflows/deploy-prod.yml)
Скрипты на проде: [`deploy/scripts/`](../deploy/scripts/)

---

## 1. Создать deploy SSH key

На **проде** (cv6067007):

```bash
# Генерим выделенный ed25519 ключ для GitHub Actions
sudo -u root ssh-keygen -t ed25519 \
    -f /root/.ssh/eclipse-chat-deploy \
    -N "" \
    -C "github-actions-deploy@$(hostname)"

# Добавляем public key в authorized_keys для root
sudo cat /root/.ssh/eclipse-chat-deploy.pub >> /root/.ssh/authorized_keys

# Проверяем что можем войти этим ключом локально
sudo ssh -i /root/.ssh/eclipse-chat-deploy root@localhost \
    "echo 'GitHub Actions deploy key works' && hostname"

# Печатаем private key чтобы скопировать в GitHub Secrets
sudo cat /root/.ssh/eclipse-chat-deploy
```

Скопируй **весь private key целиком** (включая `-----BEGIN OPENSSH PRIVATE KEY-----`
и `-----END OPENSSH PRIVATE KEY-----`) — пойдёт в `SSH_PRIVATE_KEY_PROD` секрет.

---

## 2. Заполнить GitHub Secrets

GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

### Обязательные (для каждого deploy)

| Имя | Значение | Где взять |
|---|---|---|
| `SSH_PRIVATE_KEY_PROD` | Содержимое `/root/.ssh/eclipse-chat-deploy` | Шаг 1 |
| `DEPLOY_HOST_PROD` | `cv6067007.novalocal` (или IP `89.108.66.102`) | Из `hostname` на сервере |
| `DEPLOY_USER_PROD` | `root` | Согласовано — Pavel выбрал root для простоты |

### Опциональные (только для первого setup'а)

Нужны если хочешь запустить `run_initial_setup=true` через workflow_dispatch
на свежем сервере. Eclipse Chat уже задеплоен на cv6067007, эти secrets можно
не ставить (initial-setup просто не запустится).

| Имя | Значение |
|---|---|
| `ECLIPSE_CHAT_DB_PASSWORD` | Пароль для PG-роли `eclipse_chat_user` (на cv6067007 уже задан в `apps/server/.env`) |
| `ECLIPSE_CHAT_JWT_SECRET` | JWT secret (на cv6067007 уже в `.env`) |

---

## 3. Настроить environment "production" (manual approval gate)

GitHub repo → **Settings** → **Environments** → **New environment**:

- **Name:** `production`
- **Required reviewers:** добавь свой GitHub user (`PavelHopson`)
- **Deployment branches:** Selected branches → `master`

После этого каждый deploy будет ждать ручного approve в GitHub Actions UI
перед SSH'ом в прод. Это safety net против случайных broken коммитов.

> **Хочешь без approve?** Удали `environment: production` из workflow
> (`deploy` job) и push в master будет деплоить сразу. Не рекомендую —
> approve добавляет 5 секунд но спасает от ночных аварий.

---

## 4. Тестовый запуск

### Опция A — workflow_dispatch (ручной)

GitHub → **Actions** tab → **Deploy PROD (master)** → **Run workflow** → ветка `master` → **Run**.

Появится 2 job'а:
1. **validate** — npm ci + typecheck + build (≈3-5 минут)
2. **deploy** — ждёт твоего approve → SSH в прод → запускает deploy.sh → external smoke

### Опция B — push в master

```bash
git commit -am "test: trigger CI deploy" --allow-empty
git push origin master
```

Workflow стартанёт автоматически в Actions tab.

---

## 5. Что workflow делает

```
push master
    │
    ▼
[validate]  npm ci → typecheck → build
    │
    │ (если зелёный)
    ▼
[deploy]    ⏸ manual approve (environment: production)
            │
            ▼
            ssh root@prod
            cd /var/www/eclipse-chat
            bash deploy/scripts/deploy.sh
                  │
                  ├─ [1/10] git fetch + reset --hard
                  ├─ [2/10] write release.json
                  ├─ [3/10] npm ci
                  ├─ [4/10] prisma generate + migrate
                  ├─ [5/10] npm run build
                  ├─ [6/10] sync nginx (с auto-rollback)
                  ├─ [7/10] sync supervisor
                  ├─ [8/10] chown www-data
                  ├─ [9/10] supervisorctl restart
                  └─ [10/10] smoke test (version + health + uploads MIME)
            │
            ▼
            external smoke (from CI runner)
              GET /api/version
              GET /api/health
              GET / (HTML)
```

Если что-то падает на любом шаге — workflow fail'ится, ты видишь в Actions
UI какой именно step и stderr. nginx config откатывается из backup автоматически
(см. `deploy/scripts/sync-nginx.sh`).

---

## 6. Rollback (если деплой положил сервис)

GitHub UI не имеет «one-click rollback», но manual вариант быстрый:

```bash
# SSH в прод
ssh root@cv6067007.novalocal
cd /var/www/eclipse-chat

# Откатиться на предыдущий коммит
git log --oneline -10               # выбери target hash
git reset --hard <PREVIOUS_HASH>

# Re-deploy этого коммита через скрипт
bash deploy/scripts/deploy.sh

# Когда уверен что причина найдена — fix forward в master (push)
```

Альтернатива через GitHub Actions: `git revert <BAD_COMMIT> && git push`
запустит новый deploy с реверт-коммитом.

---

## 7. Ротация SSH ключа

Каждые 6 месяцев (или при подозрении на утечку):

```bash
# На проде — сгенерить новый ключ
sudo ssh-keygen -t ed25519 -f /root/.ssh/eclipse-chat-deploy-new -N ""
sudo cat /root/.ssh/eclipse-chat-deploy-new.pub >> /root/.ssh/authorized_keys

# Скопировать private в GitHub Secrets (перезаписать SSH_PRIVATE_KEY_PROD)
sudo cat /root/.ssh/eclipse-chat-deploy-new

# Проверить через workflow_dispatch что deploy работает с новым ключом
# (jobs Actions UI → Deploy PROD → Run workflow)

# Если ок — удалить старую публичную часть из authorized_keys + старый файл
sudo sed -i '/eclipse-chat-deploy@/d' /root/.ssh/authorized_keys  # старая строка
sudo rm /root/.ssh/eclipse-chat-deploy /root/.ssh/eclipse-chat-deploy.pub
sudo mv /root/.ssh/eclipse-chat-deploy-new /root/.ssh/eclipse-chat-deploy
sudo mv /root/.ssh/eclipse-chat-deploy-new.pub /root/.ssh/eclipse-chat-deploy.pub
```

---

## 8. Troubleshooting

### Workflow fail с `Permission denied (publickey)`

- Public key не в `/root/.ssh/authorized_keys` на проде
- `SSH_PRIVATE_KEY_PROD` секрет неполный (нужны и `-----BEGIN...` и `-----END...`)
- `DEPLOY_USER_PROD` не совпадает с user'ом куда добавлен ключ

Проверка:
```bash
ssh -i <local-copy-of-private-key> root@cv6067007.novalocal "echo ok"
```

### Workflow проходит но prod не обновился

- `deploy.sh` фейлится на каком-то шаге, посмотри stdout в Actions UI
- Самая частая причина: `npm ci` падает на network (timeout / mirror down)
- Иногда `prisma migrate deploy` падает на конфликте миграций — нужно
  ручное вмешательство

### nginx -t падает в sync-nginx.sh

- Скрипт auto-rollback'ит snippets из backup и exit'ит с 1
- Star CRM защищён — конфиг откатан к предыдущей работающей версии
- Discover проблема: `sudo nginx -t` на проде покажет конкретную строку

### Concurrent deploys

`concurrency.group` уже выставлен — параллельные deploy не запустятся.
Второй встанет в очередь после первого.

---

## 9. Что НЕ делает auto-deploy

- **Не управляет .env** — secrets на проде остаются в `/var/www/eclipse-chat/apps/server/.env`,
  workflow их не трогает. Для ротации `JWT_SECRET` / `DATABASE_URL` — ручной SSH.
- **Не делает БД backup** — оно отдельно (см. `docs/DEPLOY-TO-STAR-CRM.md` Step 9 cron).
- **Не апдейтит nginx server-block** (`/etc/nginx/sites-enabled/app.star-crm.ru`) —
  только snippets через include. Если изменения нужны в server-block (port, SSL etc) —
  manual edit + `nginx -t && systemctl reload nginx`.

---

_Generated 2026-05-13 в рамках v0.12.2 deploy automation milestone._
