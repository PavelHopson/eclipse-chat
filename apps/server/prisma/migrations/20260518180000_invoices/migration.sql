-- v0.86 #24 phase 2: client invoices + line items.
-- Additive — zero impact на existing data. Server-scoped (cascade).

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');

CREATE TABLE "Invoice" (
    "id"              TEXT NOT NULL,
    "serverId"        TEXT NOT NULL,
    "number"          TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "status"          "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency"        TEXT NOT NULL DEFAULT 'RUB',
    "amountTotal"     INTEGER NOT NULL DEFAULT 0,
    "issuedAt"        TIMESTAMP(3),
    "dueAt"           TIMESTAMP(3),
    "paidAt"          TIMESTAMP(3),
    "notes"           TEXT,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_serverId_number_key" ON "Invoice"("serverId", "number");
CREATE INDEX "Invoice_serverId_status_idx" ON "Invoice"("serverId", "status");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InvoiceItem" (
    "id"        TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position"  INTEGER NOT NULL DEFAULT 0,
    "title"     TEXT NOT NULL,
    "amount"    INTEGER NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceItem_invoiceId_position_idx" ON "InvoiceItem"("invoiceId", "position");

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
