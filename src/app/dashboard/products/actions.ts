
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function getNumber(formData: FormData, field: string) {
  const value = getText(formData, field).replace(",", ".");
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Valor inválido: ${field}`);
  }

  return number;
}

export async function createCategory(formData: FormData) {
  await requireModuleAccess("PRODUCTS");

  const name = getText(formData, "name");

  if (name.length < 2) {
    throw new Error("Informe um nome válido para a categoria.");
  }

  await prisma.category.create({
    data: { name },
  });

  revalidatePath("/dashboard/products/new");
  revalidatePath("/dashboard/products");
}

export async function createProduct(formData: FormData) {
  const session = await requireModuleAccess("PRODUCTS");

  const code = getText(formData, "code");
  const barcode = getText(formData, "barcode") || null;
  const name = getText(formData, "name");
  const description = getText(formData, "description") || null;
  const categoryId = getText(formData, "categoryId");
  const type = getText(formData, "type");
  const unit = getText(formData, "unit");

  const minStock = getNumber(formData, "minStock");
  const salePrice = getNumber(formData, "salePrice");
  const purchaseCost = getNumber(formData, "purchaseCost");
  const initialStock = getNumber(formData, "initialStock");

  const validTypes = [
    "STANDARD",
    "SUPPLY",
    "FRACTIONAL",
    "COMPOSITE",
    "COMBO",
  ];

  const validUnits = ["UNIT", "ML", "GRAM"];

  if (!code || !name || !categoryId) {
    throw new Error("Preencha código, nome e categoria.");
  }

  if (!validTypes.includes(type) || !validUnits.includes(unit)) {
    throw new Error("Tipo ou unidade inválida.");
  }

  if (initialStock > 0 && type === "COMPOSITE") {
    throw new Error(
      "Produtos compostos não recebem estoque inicial nesta etapa."
    );
  }

  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error("Categoria não encontrada.");
    }

    const product = await tx.product.create({
      data: {
        code,
        barcode,
        name,
        description,
        type: type as
          | "STANDARD"
          | "SUPPLY"
          | "FRACTIONAL"
          | "COMPOSITE"
          | "COMBO",
        unit: unit as "UNIT" | "ML" | "GRAM",
        minStock,
        salePrice,
        purchaseCost,
        categoryId,
      },
    });

    await tx.stockBalance.create({
      data: {
        productId: product.id,
        quantity: initialStock,
      },
    });

    if (initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          type: "INITIAL",
          quantity: initialStock,
          reason: "Estoque inicial do cadastro",
          productId: product.id,
          userId: session.user.id,
        },
      });
    }
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  redirect("/dashboard/products");
}

export async function updateProduct(
  id: string,
  formData: FormData
) {
  await requireModuleAccess("PRODUCTS");

  const code = getText(formData, "code");
  const barcode = getText(formData, "barcode") || null;
  const name = getText(formData, "name");
  const description = getText(formData, "description") || null;
  const categoryId = getText(formData, "categoryId");
  const type = getText(formData, "type");
  const unit = getText(formData, "unit");

  const minStock = getNumber(formData, "minStock");
  const salePrice = getNumber(formData, "salePrice");
  const purchaseCost = getNumber(formData, "purchaseCost");

  const validTypes = [
    "STANDARD",
    "SUPPLY",
    "FRACTIONAL",
    "COMPOSITE",
    "COMBO",
  ];

  const validUnits = ["UNIT", "ML", "GRAM"];

  if (!code || !name || !categoryId) {
    throw new Error("Preencha código, nome e categoria.");
  }

  if (!validTypes.includes(type) || !validUnits.includes(unit)) {
    throw new Error("Tipo ou unidade inválida.");
  }

  await prisma.product.update({
    where: { id },
    data: {
      code,
      barcode,
      name,
      description,
      type: type as
        | "STANDARD"
        | "SUPPLY"
        | "FRACTIONAL"
        | "COMPOSITE"
        | "COMBO",
      unit: unit as "UNIT" | "ML" | "GRAM",
      minStock,
      salePrice,
      purchaseCost,
      categoryId,
    },
  });

  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${id}/edit`);
  redirect("/dashboard/products");
}

export async function deactivateProduct(id: string) {
  await requireModuleAccess("PRODUCTS");

  await prisma.product.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
}
