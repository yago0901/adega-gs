-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "packagingChildProductId" TEXT,
ADD COLUMN     "packagingChildQuantity" DECIMAL(12,3);

-- CreateIndex
CREATE INDEX "Product_packagingChildProductId_idx" ON "Product"("packagingChildProductId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_packagingChildProductId_fkey" FOREIGN KEY ("packagingChildProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
