/*
  Warnings:

  - You are about to drop the column `paymentMethod` on the `Sale` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Sale_paymentMethod_idx";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "paymentMethod";

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleId" TEXT NOT NULL,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
