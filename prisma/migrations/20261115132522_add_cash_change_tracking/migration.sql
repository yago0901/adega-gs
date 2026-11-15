-- AlterTable
ALTER TABLE "CustomerAccountMovement" ADD COLUMN     "cashReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cashReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
