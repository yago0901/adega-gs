-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "bottleCapacityMl" DECIMAL(12,3),
ADD COLUMN     "doseSizeMl" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "StockBalance" ADD COLUMN     "openedQuantityMl" DECIMAL(12,3) NOT NULL DEFAULT 0;
