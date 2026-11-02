CREATE TABLE "PersonalActionTime" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "actionItemId" TEXT NOT NULL REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "requestId" TEXT NOT NULL,
 "startedAt" TIMESTAMP(3) NOT NULL,
 "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
 "endedAt" TIMESTAMP(3),
 "interrupted" BOOLEAN NOT NULL DEFAULT false,
 CONSTRAINT "PersonalActionTime_interval_check" CHECK ("lastHeartbeatAt" >= "startedAt" AND ("endedAt" IS NULL OR "endedAt" >= "startedAt"))
);
CREATE UNIQUE INDEX "PersonalActionTime_userId_requestId_key" ON "PersonalActionTime"("userId", "requestId");
CREATE INDEX "PersonalActionTime_userId_startedAt_idx" ON "PersonalActionTime"("userId", "startedAt");
CREATE UNIQUE INDEX "PersonalActionTime_one_active" ON "PersonalActionTime"("userId") WHERE "endedAt" IS NULL;
