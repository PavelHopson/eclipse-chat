# Eclipse Network Gateway

Первый слайс собственного прокси и VPN: отдельный инфраструктурный gateway рядом с Eclipse Chat, без встраивания сетевого туннеля в Node.js процесс.

## Что делаем

- VPN: WireGuard, full-tunnel для доверенных устройств команды.
- Proxy: Squid HTTP/HTTPS CONNECT с basic-auth, доступен внутри VPN и с хоста на `127.0.0.1:3128`.
- Политика: закрытый egress для своей команды, не open proxy.
- Данные: приватные ключи, peer-конфиги и proxy-пароли лежат только на сервере в `deploy/network-gateway/state/` и `deploy/network-gateway/secrets/`.

## Почему так

WireGuard решает транспорт и шифрование лучше, чем самописный VPN. Squid закрывает практичный proxy-use case: браузер, CLI, CI, выборочный egress. Eclipse Chat должен управлять доступом и статусами позже, но не должен сам становиться сетевым драйвером.

## Файлы

- `deploy/network-gateway/docker-compose.yml` — WireGuard + Squid.
- `deploy/network-gateway/.env.example` — публичный endpoint, peers, DNS, ports.
- `deploy/network-gateway/squid.conf` — закрытый proxy с auth и без cache.
- `deploy/network-gateway/secrets/squid.htpasswd` — создаётся на сервере, не коммитить.
- `deploy/network-gateway/state/` — runtime state, не коммитить.

## Первый запуск на VPS

```bash
cd /var/www/eclipse-chat/deploy/network-gateway
cp .env.example .env
mkdir -p secrets state/wireguard state/squid/cache state/squid/logs

# Заполни WG_SERVER_URL, WG_PEERS, WG_PEER_DNS в .env.
# Пароль не должен попадать в shell history на общей машине.
sudo apt-get install apache2-utils
htpasswd -nbB proxy-user 'strong-password' > secrets/squid.htpasswd

docker compose up -d
docker compose logs -f wireguard
```

После старта peer-конфиги будут в `state/wireguard/peer_<name>/peer_<name>.conf`. Их выдавать адресно: один peer на одно устройство.

## Firewall

Открыть наружу только WireGuard UDP:

```bash
ufw allow 51820/udp
ufw deny 3128/tcp
```

Proxy порт в compose привязан к `127.0.0.1`. Для локального использования:

```bash
ssh -L 3128:127.0.0.1:3128 root@vpn.example.com
```

Затем в браузере/CLI указать proxy `http://127.0.0.1:3128` с логином `proxy-user`.

Для устройств внутри VPN указать proxy `http://10.66.0.1:3128` или другой gateway IP, если изменён `WG_INTERNAL_SUBNET`.

## Smoke

```bash
docker compose ps
docker compose exec squid squid -k parse
curl --proxy http://proxy-user:strong-password@127.0.0.1:3128 https://ifconfig.me
```

Для VPN:

1. Импортировать peer config в WireGuard client.
2. Подключиться.
3. Проверить внешний IP: `https://ifconfig.me`.
4. Проверить DNS leak: DNS должен идти через `WG_PEER_DNS`, не через домашнего провайдера.

## Security notes

- Не публиковать `state/wireguard/peer_*/*.conf`: там client private key.
- Не открывать `3128/tcp` в интернет без firewall allowlist. Даже с паролем это лишняя attack surface.
- Делать один peer на устройство; при потере устройства удалить peer и пересоздать конфиг.
- Логи Squid могут содержать домены запросов. Это operational metadata, хранить минимально и чистить rotation'ом.
- Этот gateway не должен использоваться для обхода чужих правил, спама, сканирования или публичной перепродажи proxy-доступа.

## Следующий слайс

- Добавить `Network Gateway` в platform-admin UI: список peer'ов, статус, дата выдачи, revoke-инструкция.
- Добавить серверный route только для metadata, без хранения приватных ключей.
- Добавить deploy smoke в CI/runbook: WireGuard UDP открыт, Squid закрыт извне, proxy-auth работает через localhost.
