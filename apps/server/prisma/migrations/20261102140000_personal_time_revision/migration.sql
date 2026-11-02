ALTER TABLE "PersonalActionTime" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PersonalActionTime" ADD CONSTRAINT "PersonalActionTime_version_check" CHECK ("version" >= 0);
