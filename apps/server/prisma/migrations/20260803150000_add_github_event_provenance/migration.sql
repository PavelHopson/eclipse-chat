ALTER TABLE "Message"
ADD COLUMN "externalEvent" JSONB,
ADD COLUMN "externalIntegrationId" TEXT,
ADD COLUMN "externalDeliveryId" TEXT;

CREATE UNIQUE INDEX "Message_external_integration_delivery_key"
ON "Message"("externalIntegrationId", "externalDeliveryId");
