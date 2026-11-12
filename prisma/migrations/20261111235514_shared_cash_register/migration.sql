/*
  Warnings:

  - You are about to drop the column `userId` on the `CashRegister` table. All the data in the column will be lost.
  - Added the required column `openedById` to the `CashRegister` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CashRegister" DROP CONSTRAINT "CashRegister_userId_fkey";

-- DropIndex
DROP INDEX "CashRegister_userId_status_idx";

-- AlterTable
ALTER TABLE "CashRegister" DROP COLUMN "userId",
ADD COLUMN     "openedById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserModuleAccess" ADD COLUMN     "canManageCashRegister" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CashRegister_status_idx" ON "CashRegister"("status");

-- CreateIndex
CREATE INDEX "CashRegister_openedById_idx" ON "CashRegister"("openedById");

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Garante que exista apenas um caixa aberto por vez
CREATE UNIQUE INDEX "CashRegister_one_open_idx"
ON "CashRegister" ("status")
WHERE "status" = 'OPEN';
