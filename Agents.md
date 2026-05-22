# Agents.md — операционная инструкция

> Бизнес, стиль общения, рабочие процессы. Стабильный документ —
> меняется редко. Состояние проекта — в `ROADMAP.md`.

## Продукт

**Eclipse Chat** — командная чат- и операционная платформа собственной
разработки (свой сервер, своя БД, свой протокол — не обёртка над чужим).
Russian-first.

- Прод: https://app.star-crm.ru/eclipse-chat/
- Позиционирование: «operator console» / next-gen operational platform —
  чат + задачи/execution + voice + боты + клиентские порталы в одном.
- Аудитория — русскоязычные команды; интерфейс и копирайт — на русском.

## Pavel

Владелец продукта. Совмещает в запросах четыре роли — отвечать из той,
что уместна задаче:

1. **Principal Fullstack** — архитектура, бэкенд, фронт.
2. **Product Designer** — визуал, UX, композиция.
3. **Security** — угрозы, корректность security-заявлений.
4. **SDET** — тестирование, верификация.

## Стиль общения

- Язык — **русский**.
- Прямо и по делу. Без воды, без лишних реверансов.
- Доказательства, а не утверждения: «проверено» = реально проверено
  (рендер, smoke, тест), с выводом.
- Плохие новости — сразу и честно (упавший тест, пропущенный шаг,
  ложное security-заявление в UI).
- По дизайну — **смело по композиции**. Осторожные «минимальные»
  инкременты были ошибкой прошлой работы. Делать передел, не правку.

## Рабочий метод

Каждая задача проходит цикл:

**UNDERSTAND → VERIFY → ROOT CAUSE → IMPACT → CHANGE → VERIFY → REPORT**

Не чинить симптом — находить корень. Перед правкой — оценить blast
radius. После — проверить и доложить честно.

## Рабочие процессы

### Дизайн — слайсами
Слайс → build → deploy → smoke → ревью Pavel'я. Один слайс = одна
осмысленная порция, не «весь редизайн сразу».

### Версия — бампать в 4 местах (только через Edit)
- `apps/server/package.json`
- `apps/web/package.json`
- `apps/server/src/index.ts` (хардкод в `/api/version`)
- `apps/web/public/sw.js` (`SW_VERSION`)

### Коммит
- Сообщение — через файл `.commit-message.tmp` + `git commit -F`.
- Подпись: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Новый коммит, не amend.

### Deploy
1. `git push origin master`
2. GitHub Actions запускает validate → deploy (deploy на approve-gate).
3. Одобрить gate:
   ```
   gh api --method POST \
     repos/PavelHopson/eclipse-chat/actions/runs/<RUN_ID>/pending_deployments \
     -F 'environment_ids[]=15291822396' -F 'state=approved' -F 'comment=<причина>'
   ```
4. Smoke: `/api/version` (совпадает с бампнутой) + `/api/health` (`ok:true`).

### ROADMAP
`ROADMAP.md` — источник истины. Любое изменение версии синхронить:
бампнуть header + добавить запись в version-log.
