-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Module" AS ENUM ('POS', 'STOCK', 'EMPLOYEES', 'PRODUCTS', 'FINANCE', 'HISTORY', 'CUSTOMERS', 'FIADOS', 'MOTOBOYS');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('STANDARD', 'SUPPLY', 'FRACTIONAL', 'COMPOSITE', 'COMBO');

-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('UNIT', 'ML', 'GRAM');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INITIAL', 'PURCHASE', 'SALE', 'LOSS', 'OPEN_PACKAGING', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashRegisterStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('SUPPLY', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryPaymentType" AS ENUM ('PREPAID', 'TO_COLLECT');

-- CreateEnum
CREATE TYPE "DeliveryCancellationResolution" AS ENUM ('REFUND', 'CUSTOMER_CREDIT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "CustomerAccountMovementType" AS ENUM ('DEBIT', 'CREDIT', 'REVERSAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModuleAccess" (
    "id" TEXT NOT NULL,
    "module" "Module" NOT NULL,
    "canManageCashRegister" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserModuleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'STANDARD',
    "salePrice" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "stockItemId" TEXT,
    "stockPackagingId" TEXT,
    "packagingChildProductId" TEXT,
    "packagingChildQuantity" DECIMAL(12,3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockItemId" TEXT NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ComboItem" (
    "id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "comboProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,

    CONSTRAINT "ComboItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "StockUnit" NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stockItemId" TEXT NOT NULL,
    "stockPackagingId" TEXT,
    "userId" TEXT,
    "saleId" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "cashRegisterId" TEXT,
    "customerId" TEXT,
    "cashReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryZipCode" TEXT,
    "deliveryStreet" TEXT,
    "deliveryNumber" TEXT,
    "deliveryComplement" TEXT,
    "deliveryNeighborhood" TEXT,
    "deliveryCity" TEXT,
    "deliveryState" TEXT,
    "deliveryReference" TEXT,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "unit" "StockUnit" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "CashRegister" (
    "id" TEXT NOT NULL,
    "status" "CashRegisterStatus" NOT NULL DEFAULT 'OPEN',
    "openingAmount" DECIMAL(12,2) NOT NULL,
    "expectedAmount" DECIMAL(12,2),
    "countedAmount" DECIMAL(12,2),
    "difference" DECIMAL(12,2),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashRegisterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleId" TEXT NOT NULL,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reference" TEXT,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "CustomerAccountMovement" (
    "id" TEXT NOT NULL,
    "type" "CustomerAccountMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "saleId" TEXT,
    "reversalOfId" TEXT,
    "deliveryCreditForId" TEXT,
    "cashReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "CustomerAccountMovementPayment" (
    "id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movementId" TEXT NOT NULL,

    CONSTRAINT "CustomerAccountMovementPayment_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "UserModuleAccess_userId_module_key" ON "UserModuleAccess"("userId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_packagingChildProductId_key" ON "Product"("packagingChildProductId");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_stockItemId_idx" ON "Product"("stockItemId");

-- CreateIndex
CREATE INDEX "Product_stockPackagingId_idx" ON "Product"("stockPackagingId");

-- CreateIndex
CREATE INDEX "Product_packagingChildProductId_idx" ON "Product"("packagingChildProductId");

-- CreateIndex
CREATE INDEX "StockItem_name_idx" ON "StockItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_stockItemId_key" ON "StockBalance"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockPackaging_stockItemId_name_key" ON "StockPackaging"("stockItemId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StockPackagingBalance_stockPackagingId_key" ON "StockPackagingBalance"("stockPackagingId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductComposition_productId_key" ON "ProductComposition"("productId");

-- CreateIndex
CREATE INDEX "CompositionGroup_compositionId_idx" ON "CompositionGroup"("compositionId");

-- CreateIndex
CREATE INDEX "CompositionOption_stockItemId_idx" ON "CompositionOption"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionOption_groupId_stockItemId_key" ON "CompositionOption"("groupId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ComboItem_comboProductId_componentProductId_key" ON "ComboItem"("comboProductId", "componentProductId");

-- CreateIndex
CREATE INDEX "StockMovement_stockItemId_createdAt_idx" ON "StockMovement"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_stockPackagingId_createdAt_idx" ON "StockMovement"("stockPackagingId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_saleId_idx" ON "StockMovement"("saleId");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "Sale_userId_createdAt_idx" ON "Sale"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_cashRegisterId_idx" ON "Sale"("cashRegisterId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SaleItemCompositionSelection_saleItemId_idx" ON "SaleItemCompositionSelection"("saleItemId");

-- CreateIndex
CREATE INDEX "SaleItemCompositionSelection_stockItemId_idx" ON "SaleItemCompositionSelection"("stockItemId");

-- CreateIndex
CREATE INDEX "CashRegister_status_idx" ON "CashRegister"("status");

-- CreateIndex
CREATE INDEX "CashRegister_openedById_idx" ON "CashRegister"("openedById");

-- CreateIndex
CREATE INDEX "CashRegister_openedAt_idx" ON "CashRegister"("openedAt");

-- CreateIndex
CREATE INDEX "CashMovement_cashRegisterId_createdAt_idx" ON "CashMovement"("cashRegisterId", "createdAt");

-- CreateIndex
CREATE INDEX "CashMovement_userId_createdAt_idx" ON "CashMovement"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phoneNormalized_key" ON "Customer"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Motoboy_phoneNormalized_key" ON "Motoboy"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Motoboy_name_idx" ON "Motoboy"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountMovement_reversalOfId_key" ON "CustomerAccountMovement"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountMovement_deliveryCreditForId_key" ON "CustomerAccountMovement"("deliveryCreditForId");

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

-- CreateIndex
CREATE INDEX "CustomerAccountMovementPayment_movementId_idx" ON "CustomerAccountMovementPayment"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_saleId_key" ON "Delivery"("saleId");

-- CreateIndex
CREATE INDEX "Delivery_status_createdAt_idx" ON "Delivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Delivery_motoboyId_idx" ON "Delivery"("motoboyId");

-- CreateIndex
CREATE INDEX "DeliveryPayment_deliveryId_idx" ON "DeliveryPayment"("deliveryId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleAccess" ADD CONSTRAINT "UserModuleAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockPackagingId_fkey" FOREIGN KEY ("stockPackagingId") REFERENCES "StockPackaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_packagingChildProductId_fkey" FOREIGN KEY ("packagingChildProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPackaging" ADD CONSTRAINT "StockPackaging_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPackagingBalance" ADD CONSTRAINT "StockPackagingBalance_stockPackagingId_fkey" FOREIGN KEY ("stockPackagingId") REFERENCES "StockPackaging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComposition" ADD CONSTRAINT "ProductComposition_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionGroup" ADD CONSTRAINT "CompositionGroup_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "ProductComposition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionOption" ADD CONSTRAINT "CompositionOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CompositionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionOption" ADD CONSTRAINT "CompositionOption_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboItem" ADD CONSTRAINT "ComboItem_comboProductId_fkey" FOREIGN KEY ("comboProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboItem" ADD CONSTRAINT "ComboItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockPackagingId_fkey" FOREIGN KEY ("stockPackagingId") REFERENCES "StockPackaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItemCompositionSelection" ADD CONSTRAINT "SaleItemCompositionSelection_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "CustomerAccountMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_deliveryCreditForId_fkey" FOREIGN KEY ("deliveryCreditForId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovement" ADD CONSTRAINT "CustomerAccountMovement_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountAllocation" ADD CONSTRAINT "CustomerAccountAllocation_creditMovementId_fkey" FOREIGN KEY ("creditMovementId") REFERENCES "CustomerAccountMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountAllocation" ADD CONSTRAINT "CustomerAccountAllocation_debitMovementId_fkey" FOREIGN KEY ("debitMovementId") REFERENCES "CustomerAccountMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountMovementPayment" ADD CONSTRAINT "CustomerAccountMovementPayment_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "CustomerAccountMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
