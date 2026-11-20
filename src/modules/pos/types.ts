import "server-only";

import { Prisma } from "@/generated/prisma/client";

export type SaleRequestItem = {
  productId: string;
  quantity: number;
  selections?: {
    groupId: string;
    optionId: string;
  }[];
};

export type SalePaymentRequest = {
  paymentMethod: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
  amount: string;
};

export type DeliveryPaymentRequest = {
  type: "PREPAID" | "TO_COLLECT";
  method: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
  amount: string;
};

export type BottleOpening = {
  kind: "BOTTLE";
  productId: string;
  stockItemId: string;
  stockItemName: string;
  stockPackagingId: string;
  packagingName: string;
  quantity: number;
  volume: string;
};

export type CommercialPackagingOpening = {
  kind: "COMMERCIAL";
  productId: string;
  productName: string;
  parentProductName: string;
  quantity: number;
  generatedQuantity: string;
  childProductName: string;
};

export type Opening = BottleOpening | CommercialPackagingOpening;

export type SaleResult =
  | { success: true; saleId: string; total: string }
  | { success: true; confirmationRequired: true; openings: Opening[] }
  | { success: false; error: string };

export type Consumption = {
  productId?: string;
  stockItemId: string;
  stockPackagingId: string | null;
  quantity: Prisma.Decimal;
  unit: "UNIT" | "ML" | "GRAM";
  name: string;
};

export type SelectedCompositionOption = {
  groupId: string;
  optionId: string;
};

export type OpenCashRegisterResult =
  | { success: true; cashRegisterId: string }
  | { success: false; error: string };

export type CashMovementResult =
  | { success: true; movementId: string; balance: string }
  | { success: false; error: string };

export type CloseCashRegisterResult =
  | {
      success: true;
      expectedAmount: string;
      countedAmount: string;
      difference: string;
      paymentTotals: {
        cash: string;
        pix: string;
        creditCard: string;
        debitCard: string;
        total: string;
      };
      debtPaymentTotals: {
        cash: string;
        pix: string;
        creditCard: string;
        debitCard: string;
        total: string;
      };
    }
  | { success: false; error: string };

export type DispatchDeliveryResult =
  | { success: true }
  | { success: false; error: string };

export type CompleteDeliveryResult =
  | { success: true }
  | { success: false; error: string };

export type CancelDeliveryResult =
  | { success: true }
  | { success: false; error: string };

export type DeliveryCancellationResolution = "REFUND" | "CUSTOMER_CREDIT";

export type CustomerDebtItem = {
  id: string;
  saleId: string | null;
  description: string | null;
  createdAt: string;
  originalAmount: string;
  paidAmount: string;
  remainingAmount: string;
};

export type CustomerOpenDebtsResult =
  | {
      success: true;
      customerName: string;
      totalDebt: string;
      debts: CustomerDebtItem[];
    }
  | { success: false; error: string };

export type DebtPaymentResult =
  | {
      success: true;
      movementId: string;
      amountPaid: string;
      cashReceived: string;
      changeAmount: string;
    }
  | { success: false; error: string };
