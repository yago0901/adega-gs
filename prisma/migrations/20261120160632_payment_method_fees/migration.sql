-- CreateTable
CREATE TABLE "PaymentMethodFee" (
    "method" "PaymentMethod" NOT NULL,
    "percentFee" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodFee_pkey" PRIMARY KEY ("method")
);
