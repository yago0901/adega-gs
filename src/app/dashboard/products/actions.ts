
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

function getOptionalNumber(formData: FormData, field: string) {
  const value = getText(formData, field);

  if (!value) return null;

  const number = Number(value.replace(",", "."));

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Informe um valor maior que zero: ${field}`);
  }

  return number;
}

const validTypes = [
  "STANDARD",
  "SUPPLY",
  "FRACTIONAL",
  "COMPOSITE",
  "COMBO",
] as const;

const validUnits = ["UNIT", "ML", "GRAM"] as const;

type ProductTypeValue = (typeof validTypes)[number];
type StockUnitValue = (typeof validUnits)[number];

function validateType(type: string): asserts type is ProductTypeValue {
  if (!validTypes.includes(type as ProductTypeValue)) {
    throw new Error("Tipo de produto inválido.");
  }
}

function validateUnit(unit: string): asserts unit is StockUnitValue {
  if (!validUnits.includes(unit as StockUnitValue)) {
    throw new Error("Unidade de estoque inválida.");
  }
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

  const salePrice = getNumber(formData, "salePrice");
  const purchaseCost = getNumber(formData, "purchaseCost");
  const minStock = getNumber(formData, "minStock");
  const initialStock = getNumber(formData, "initialStock");

  const bottleCapacityMl = getOptionalNumber(
    formData,
    "bottleCapacityMl",
  );

  const ingredientStockItemId = getText(
    formData,
    "ingredientStockItemId",
  );

  const recipeQuantityMl = getOptionalNumber(
    formData,
    "recipeQuantityMl",
  );

  if (!code || !name || !categoryId) {
    throw new Error("Preencha código, nome e categoria.");
  }

  validateType(type);
  validateUnit(unit);

  if (type === "COMPOSITE" || type === "COMBO") {
    throw new Error(
      "Composições e combos serão disponibilizados em uma próxima etapa.",
    );
  }

  if (type === "FRACTIONAL") {
    if (!ingredientStockItemId || !recipeQuantityMl) {
      throw new Error(
        "Selecione o ingrediente e informe o consumo em ml por dose.",
      );
    }

    if (initialStock > 0) {
      throw new Error(
        "Doses não possuem estoque próprio. O estoque é controlado pelo ingrediente.",
      );
    }
  } else {
    if (recipeQuantityMl || ingredientStockItemId) {
      throw new Error(
        "A composição de ingrediente deve ser preenchida somente para doses.",
      );
    }

    if (bottleCapacityMl && unit !== "ML") {
      throw new Error(
        "Para cadastrar uma garrafa fracionável, selecione ML como unidade de estoque.",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error("Categoria não encontrada.");
    }

    if (type === "FRACTIONAL") {
      const ingredient = await tx.stockItem.findUnique({
        where: { id: ingredientStockItemId },
      });

      if (!ingredient || !ingredient.active) {
        throw new Error("Ingrediente não encontrado ou inativo.");
      }

      if (ingredient.unit !== "ML") {
        throw new Error(
          "O ingrediente selecionado precisa utilizar mililitros (ML).",
        );
      }

      await tx.product.create({
        data: {
          code,
          barcode,
          name,
          description,
          type,
          salePrice,
          categoryId,
          recipeItems: {
            create: {
              stockItemId: ingredient.id,
              quantity: recipeQuantityMl!,
            },
          },
        },
      });

      return;
    }

    const isBottle = bottleCapacityMl !== null;

    const stockItem = await tx.stockItem.create({
      data: {
        name,
        unit,
        minStock: isBottle
          ? minStock * bottleCapacityMl
          : minStock,
        purchaseCost: isBottle
          ? purchaseCost / bottleCapacityMl
          : purchaseCost,
        balance: {
          create: {
            quantity: isBottle ? 0 : initialStock,
          },
        },
      },
    });

    let stockPackagingId: string | undefined;

    if (isBottle) {
      const packaging = await tx.stockPackaging.create({
        data: {
          name: `Garrafa ${bottleCapacityMl} ml`,
          conversionFactor: bottleCapacityMl,
          stockItemId: stockItem.id,
          balance: {
            create: {
              quantity: initialStock,
            },
          },
        },
      });

      stockPackagingId = packaging.id;
    }

    await tx.product.create({
      data: {
        code,
        barcode,
        name,
        description,
        type,
        salePrice,
        categoryId,
        stockItemId: stockItem.id,
        stockPackagingId,
      },
    });

    if (initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          type: "INITIAL",
          quantity: initialStock,
          unit: isBottle ? "UNIT" : unit,
          reason: "Estoque inicial do cadastro",
          stockItemId: stockItem.id,
          stockPackagingId,
          userId: session.user.id,
        },
      });
    }
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard");
  redirect("/dashboard/products");
}

export async function updateProduct(
  id: string,
  formData: FormData,
) {
  await requireModuleAccess("PRODUCTS");

  const code = getText(formData, "code");
  const barcode = getText(formData, "barcode") || null;
  const name = getText(formData, "name");
  const description = getText(formData, "description") || null;
  const categoryId = getText(formData, "categoryId");

  const type = getText(formData, "type");
  const unit = getText(formData, "unit");

  const salePrice = getNumber(formData, "salePrice");
  const purchaseCost = getNumber(formData, "purchaseCost");
  const minStock = getNumber(formData, "minStock");

  if (!code || !name || !categoryId) {
    throw new Error("Preencha código, nome e categoria.");
  }

  validateType(type);
  validateUnit(unit);

  await prisma.$transaction(async (tx) => {
    const [currentProduct, category] = await Promise.all([
      tx.product.findUnique({
        where: { id },
        include: {
          recipeItems: true,
          stockItem: true,
          stockPackaging: true,
        },
      }),
      tx.category.findUnique({
        where: { id: categoryId },
      }),
    ]);

    if (!currentProduct) {
      throw new Error("Produto não encontrado.");
    }

    if (!category) {
      throw new Error("Categoria não encontrada.");
    }

    if (type !== currentProduct.type) {
      throw new Error(
        "Não é possível alterar o tipo de um produto já cadastrado.",
      );
    }

    if (currentProduct.stockItem) {
      if (unit !== currentProduct.stockItem.unit) {
        throw new Error(
          "Não é possível alterar a unidade de um item que já possui controle de estoque.",
        );
      }

      const conversionFactor =
        currentProduct.stockPackaging?.conversionFactor.toNumber() ?? 1;

      await tx.stockItem.update({
        where: { id: currentProduct.stockItem.id },
        data: {
          name,
          minStock: minStock * conversionFactor,
          purchaseCost: purchaseCost / conversionFactor,
        },
      });
    }

    await tx.product.update({
      where: { id },
      data: {
        code,
        barcode,
        name,
        description,
        salePrice,
        categoryId,
      },
    });
  });

  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${id}/edit`);
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/stock/movements");
  revalidatePath("/dashboard");
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
