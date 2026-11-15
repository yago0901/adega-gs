
/*
  Warnings:

  - The values [ON_ACCOUNT] on the enum PaymentMethod will be removed.
  - The column paymentMethod on CustomerAccountMovement will be removed.
*/

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'FIADOS';

-- AlterEnum
BEGIN;

CREATE TYPE "PaymentMethod_new" AS ENUM (
    'CASH',
    'PIX',
    'CREDIT_CARD',
    'DEBIT_CARD'
);

ALTER TABLE "SalePayment"
ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new"
USING ("paymentMethod"::text::"PaymentMethod_new");

ALTER TABLE "CustomerAccountMovement"
DROP COLUMN "paymentMethod";

ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";

DROP TYPE "public"."PaymentMethod_old";

COMMIT;


-- CreateTable
CREATE TABLE "CustomerAccountMovementPayment" (
    "id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movementId" TEXT NOT NULL,

    CONSTRAINT "CustomerAccountMovementPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAccountMovementPayment_movementId_idx"
ON "CustomerAccountMovementPayment"("movementId");

-- AddForeignKey
ALTER TABLE "CustomerAccountMovementPayment"
ADD CONSTRAINT "CustomerAccountMovementPayment_movementId_fkey"
FOREIGN KEY ("movementId")
REFERENCES "CustomerAccountMovement"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
