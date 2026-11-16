/*
  Warnings:

  - A unique constraint covering the columns `[deliveryCreditForId]` on the table `CustomerAccountMovement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryPaymentType" AS ENUM ('PREPAID', 'TO_COLLECT');

-- CreateEnum
CREATE TYPE "DeliveryCancellationResolution" AS ENUM ('REFUND', 'CUSTOMER_CREDIT');

-- AlterEnum
ALTER TYPE "SaleStatus" ADD VALUE 'PENDING_DELIVERY';

-- AlterTable
ALTER TABLE "CustomerAccountMovement" ADD COLUMN     "deliveryCreditForId" TEXT;

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "predictedCashReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "predictedChangeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dispatchedAt" TIMESTAMP(3),
    "dispatchedById" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "cancellationResolution" "DeliveryCancellationResolution",
    "cancellationRefundAmount" DECIMAL(12,2),
    "cancellationResolvedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationResolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "saleId" TEXT NOT NULL,
    "motoboyId" TEXT,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPayment" (
    "id" TEXT NOT NULL,
    "type" "DeliveryPaymentType" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryId" TEXT NOT NULL,

    CONSTRAINT "DeliveryPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_saleId_key" ON "Delivery"("saleId");

-- CreateIndex
CREATE INDEX "Delivery_status_createdAt_idx" ON "Delivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Delivery_motoboyId_idx" ON "Delivery"("motoboyId");

-- CreateIndex
CREATE INDEX "DeliveryPayment_deliveryId_idx" ON "DeliveryPayment"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountMovement_deliveryCreditForId_key" ON "CustomerAccountMovement"("deliveryCreditForId");

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_deliveryCreditForId_fkey" FOREIGN KEY ("deliveryCreditForId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_cancellationResolvedById_fkey" FOREIGN KEY ("cancellationResolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_motoboyId_fkey" FOREIGN KEY ("motoboyId") REFERENCES "Motoboy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPayment" ADD CONSTRAINT "DeliveryPayment_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
