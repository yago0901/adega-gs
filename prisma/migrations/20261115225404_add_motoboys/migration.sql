-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'MOTOBOYS';

-- CreateTable
CREATE TABLE "Motoboy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motoboy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Motoboy_phoneNormalized_key" ON "Motoboy"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Motoboy_name_idx" ON "Motoboy"("name");
