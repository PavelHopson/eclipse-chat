CREATE TABLE "PersonalActionPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actionItemId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "plannedMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonalActionPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonalActionPlan_minutes_check" CHECK ("plannedMinutes" IS NULL OR "plannedMinutes" BETWEEN 1 AND 1440)
);
CREATE UNIQUE INDEX "PersonalActionPlan_userId_actionItemId_day_key" ON "PersonalActionPlan"("userId", "actionItemId", "day");
CREATE INDEX "PersonalActionPlan_userId_day_idx" ON "PersonalActionPlan"("userId", "day");
ALTER TABLE "PersonalActionPlan" ADD CONSTRAINT "PersonalActionPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalActionPlan" ADD CONSTRAINT "PersonalActionPlan_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
