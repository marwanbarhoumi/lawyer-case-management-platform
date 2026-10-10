-- DropIndex
DROP INDEX "InvoiceItem_invoiceId_idx";

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_position_idx" ON "InvoiceItem"("invoiceId", "position");
