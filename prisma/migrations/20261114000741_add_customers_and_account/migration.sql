-- CreateEnum
CREATE TYPE "CustomerAccountMovementType" AS ENUM ('DEBIT', 'CREDIT', 'REVERSAL');

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'CUSTOMERS';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ON_ACCOUNT';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "deliveryCity" TEXT,
ADD COLUMN     "deliveryComplement" TEXT,
ADD COLUMN     "deliveryNeighborhood" TEXT,
ADD COLUMN     "deliveryNumber" TEXT,
ADD COLUMN     "deliveryReference" TEXT,
ADD COLUMN     "deliveryState" TEXT,
ADD COLUMN     "deliveryStreet" TEXT,
ADD COLUMN     "deliveryZipCode" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAccountMovement" (
    "id" TEXT NOT NULL,
    "type" "CustomerAccountMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "paymentMethod" "PaymentMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "saleId" TEXT,
    "reversalOfId" TEXT,
    "cashRegisterId" TEXT,

    CONSTRAINT "CustomerAccountMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAccountAllocation" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditMovementId" TEXT NOT NULL,
    "debitMovementId" TEXT NOT NULL,

    CONSTRAINT "CustomerAccountAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phoneNormalized_key" ON "Customer"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountMovement_reversalOfId_key" ON "CustomerAccountMovement"("reversalOfId");

-- CreateIndex
CREATE INDEX "CustomerAccountMovement_customerId_createdAt_idx" ON "CustomerAccountMovement"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerAccountMovement_userId_createdAt_idx" ON "CustomerAccountMovement"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerAccountMovement_saleId_idx" ON "CustomerAccountMovement"("saleId");

-- CreateIndex
CREATE INDEX "CustomerAccountMovement_cashRegisterId_createdAt_idx" ON "CustomerAccountMovement"("cashRegisterId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerAccountAllocation_debitMovementId_idx" ON "CustomerAccountAllocation"("debitMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountAllocation_creditMovementId_debitMovementId_key" ON "CustomerAccountAllocation"("creditMovementId", "debitMovementId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "CustomerAccountMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountAllocation" ADD CONSTRAINT "CustomerAccountAllocation_creditMovementId_fkey" FOREIGN KEY ("creditMovementId") REFERENCES "CustomerAccountMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountAllocation" ADD CONSTRAINT "CustomerAccountAllocation_debitMovementId_fkey" FOREIGN KEY ("debitMovementId") REFERENCES "CustomerAccountMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
