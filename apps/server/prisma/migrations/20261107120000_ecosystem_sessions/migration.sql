CREATE TABLE "EcosystemSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "refreshSessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EcosystemSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EcosystemSession_tokenHash_key" ON "EcosystemSession"("tokenHash");
CREATE INDEX "EcosystemSession_refreshSessionId_clientId_idx" ON "EcosystemSession"("refreshSessionId", "clientId");
CREATE INDEX "EcosystemSession_expiresAt_idx" ON "EcosystemSession"("expiresAt");
ALTER TABLE "EcosystemSession" ADD CONSTRAINT "EcosystemSession_refreshSessionId_fkey" FOREIGN KEY ("refreshSessionId") REFERENCES "RefreshToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
