/*
  Warnings:

  - You are about to drop the `ProductRecipeItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductRecipeItem" DROP CONSTRAINT "ProductRecipeItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductRecipeItem" DROP CONSTRAINT "ProductRecipeItem_stockItemId_fkey";

-- DropTable
DROP TABLE "ProductRecipeItem";

-- CreateTable
CREATE TABLE "ProductComposition" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductComposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelections" INTEGER NOT NULL DEFAULT 1,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "compositionId" TEXT NOT NULL,

    CONSTRAINT "CompositionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionOption" (
    "id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,

    CONSTRAINT "CompositionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItemCompositionSelection" (
    "id" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "stockItemName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "StockUnit" NOT NULL,
    "saleItemId" TEXT NOT NULL,

    CONSTRAINT "SaleItemCompositionSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductComposition_productId_key" ON "ProductComposition"("productId");

-- CreateIndex
CREATE INDEX "CompositionGroup_compositionId_idx" ON "CompositionGroup"("compositionId");

-- CreateIndex
CREATE INDEX "CompositionOption_stockItemId_idx" ON "CompositionOption"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionOption_groupId_stockItemId_key" ON "CompositionOption"("groupId", "stockItemId");

-- CreateIndex
CREATE INDEX "SaleItemCompositionSelection_saleItemId_idx" ON "SaleItemCompositionSelection"("saleItemId");

-- CreateIndex
CREATE INDEX "SaleItemCompositionSelection_stockItemId_idx" ON "SaleItemCompositionSelection"("stockItemId");

-- AddForeignKey
ALTER TABLE "ProductComposition" ADD CONSTRAINT "ProductComposition_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionGroup" ADD CONSTRAINT "CompositionGroup_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "ProductComposition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionOption" ADD CONSTRAINT "CompositionOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CompositionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionOption" ADD CONSTRAINT "CompositionOption_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItemCompositionSelection" ADD CONSTRAINT "SaleItemCompositionSelection_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
