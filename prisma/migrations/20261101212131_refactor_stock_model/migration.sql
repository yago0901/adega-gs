/*
  Warnings:

  - The values [OPEN_CONTAINER] on the enum `StockMovementType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `bottleCapacityMl` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `doseSizeMl` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `minStock` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseCost` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `openedQuantityMl` on the `StockBalance` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `StockBalance` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `StockMovement` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stockItemId]` on the table `StockBalance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `stockItemId` to the `StockBalance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stockItemId` to the `StockMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unit` to the `StockMovement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StockMovementType_new" AS ENUM ('INITIAL', 'PURCHASE', 'SALE', 'LOSS', 'OPEN_PACKAGING', 'ADJUSTMENT', 'REVERSAL');
ALTER TABLE "StockMovement" ALTER COLUMN "type" TYPE "StockMovementType_new" USING ("type"::text::"StockMovementType_new");
ALTER TYPE "StockMovementType" RENAME TO "StockMovementType_old";
ALTER TYPE "StockMovementType_new" RENAME TO "StockMovementType";
DROP TYPE "public"."StockMovementType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "StockBalance" DROP CONSTRAINT "StockBalance_productId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";

-- DropIndex
DROP INDEX "StockBalance_productId_key";

-- DropIndex
DROP INDEX "StockMovement_productId_createdAt_idx";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "bottleCapacityMl",
DROP COLUMN "doseSizeMl",
DROP COLUMN "minStock",
DROP COLUMN "purchaseCost",
DROP COLUMN "unit",
ADD COLUMN     "stockItemId" TEXT,
ADD COLUMN     "stockPackagingId" TEXT;

-- AlterTable
ALTER TABLE "StockBalance" DROP COLUMN "openedQuantityMl",
DROP COLUMN "productId",
ADD COLUMN     "stockItemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "productId",
ADD COLUMN     "stockItemId" TEXT NOT NULL,
ADD COLUMN     "stockPackagingId" TEXT,
ADD COLUMN     "unit" "StockUnit" NOT NULL;

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "StockUnit" NOT NULL,
    "minStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "purchaseCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPackaging" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conversionFactor" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockItemId" TEXT NOT NULL,

    CONSTRAINT "StockPackaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPackagingBalance" (
    "id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockPackagingId" TEXT NOT NULL,

    CONSTRAINT "StockPackagingBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecipeItem" (
    "id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "productId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,

    CONSTRAINT "ProductRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboItem" (
    "id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "comboProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,

    CONSTRAINT "ComboItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockItem_name_idx" ON "StockItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockPackaging_stockItemId_name_key" ON "StockPackaging"("stockItemId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StockPackagingBalance_stockPackagingId_key" ON "StockPackagingBalance"("stockPackagingId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipeItem_productId_stockItemId_key" ON "ProductRecipeItem"("productId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ComboItem_comboProductId_componentProductId_key" ON "ComboItem"("comboProductId", "componentProductId");

-- CreateIndex
CREATE INDEX "Product_stockItemId_idx" ON "Product"("stockItemId");

-- CreateIndex
CREATE INDEX "Product_stockPackagingId_idx" ON "Product"("stockPackagingId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_stockItemId_key" ON "StockBalance"("stockItemId");

-- CreateIndex
CREATE INDEX "StockMovement_stockItemId_createdAt_idx" ON "StockMovement"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_stockPackagingId_createdAt_idx" ON "StockMovement"("stockPackagingId", "createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockPackagingId_fkey" FOREIGN KEY ("stockPackagingId") REFERENCES "StockPackaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPackaging" ADD CONSTRAINT "StockPackaging_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPackagingBalance" ADD CONSTRAINT "StockPackagingBalance_stockPackagingId_fkey" FOREIGN KEY ("stockPackagingId") REFERENCES "StockPackaging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "ProductRecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "ProductRecipeItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboItem" ADD CONSTRAINT "ComboItem_comboProductId_fkey" FOREIGN KEY ("comboProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboItem" ADD CONSTRAINT "ComboItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockPackagingId_fkey" FOREIGN KEY ("stockPackagingId") REFERENCES "StockPackaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;
