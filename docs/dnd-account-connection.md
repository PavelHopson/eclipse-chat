# Eclipse Chat → DnD Forge account connection

## Пользовательский сценарий

1. Открыть меню профиля в Eclipse Chat и нажать **DnD Forge**, либо перейти в
   **Настройки → Данные и связи → Связи между приложениями**.
2. Нажать **Подключить DnD Forge**. DnD Forge сам начинает безопасный вход через Chat.
3. Войти или создать Eclipse-аккаунт прямо на authorize-экране.
4. Подтвердить передачу профиля и вернуться в DnD Forge.

Основной сценарий не требует ручного копирования URL, кода или API-ключа.

## Данные и границы доверия

- DnD Forge получает только публичное имя и внутренний идентификатор пользователя.
- Email, пароль, access/refresh token и история сообщений не передаются в DnD Forge.
- Authorization code одноразовый, ограничен TTL и защищён PKCE S256 + `state`.
- Точный `client_id` и `redirect_uri` проверяются сервером; произвольный callback запрещён.
- Identity canary не включает managed AI и не выполняет AI completion.

## Реализация и rollback

Chat открывает `https://dnd.eclipse-forge.ru/#/auth/canary?from=eclipse-chat` в новой
вкладке с `noopener noreferrer`. Source marker запускает только identity flow и не даёт
дополнительных прав. DnD запоминает одну попытку автозапуска на mount, чтобы ошибка сети
не создала redirect-loop.

Для rollback достаточно убрать обе точки входа Chat и автоматический source branch в
`IdentityCanaryPage`; ручной `#/auth/canary` и основной DnD Forge продолжат работать.

## Production smoke

1. Из авторизованного Chat открыть **DnD Forge**.
2. Проверить exact Chat authorize origin и сохранённые PKCE query-параметры.
3. Подтвердить подключение и убедиться, что DnD показывает имя пользователя.
4. Завершить DnD-сессию и проверить, что повторный вход снова требует подтверждения.
5. Убедиться по `/health`, что `aiEnabled=false` до отдельного managed AI gate.
