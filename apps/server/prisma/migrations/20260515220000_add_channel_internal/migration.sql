-- Channel.internal — v0.47 Client Mode v2.
-- internal=true → канал скрыт от MEMBER когда server.mode=CLIENT.
-- В ENGINEERING serverе flag ignored — все members видят все каналы.
-- Existing каналы получают false (backward compat).

ALTER TABLE "Channel"
  ADD COLUMN "internal" BOOLEAN NOT NULL DEFAULT false;
