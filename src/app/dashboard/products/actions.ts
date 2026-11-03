
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

function getRepeatedTexts(formData: FormData, field: string) {
  return formData.getAll(field).map((value) => String(value).trim());
}

function parseRepeatedNumber(value: string, field: string) {
  const number = Number(value.replace(",", "."));

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Informe uma quantidade válida em ${field}.`);
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

  const salePrice = getNumber(formData, "salePrice");
  const purchaseCost = getNumber(formData, "purchaseCost");

  if (!code || !name || !categoryId) {
    throw new Error("Preencha código, nome e categoria.");
  }

  validateType(type);

  if (type === "COMPOSITE") {
    throw new Error(
      "O tipo Composição não é utilizado. Cadastre esse produto como Dose.",
    );
  }

  const isRecipe = type === "FRACTIONAL";
  const isCombo = type === "COMBO";

  if (isRecipe || isCombo) {
    const initialStock = getNumber(formData, "initialStock");
    const initialOpenQuantity = getNumber(
      formData,
      "initialOpenQuantity",
    );

    if (initialStock > 0 || initialOpenQuantity > 0) {
      throw new Error("Doses e combos não possuem estoque próprio.");
    }

    const recipeIds = getRepeatedTexts(
      formData,
      "recipeStockItemId",
    );
    const recipeQuantities = getRepeatedTexts(
      formData,
      "recipeQuantity",
    );

    const comboIds = getRepeatedTexts(
      formData,
      "comboProductId",
    );
    const comboQuantities = getRepeatedTexts(
      formData,
      "comboQuantity",
    );

    if (isRecipe) {
      if (
        recipeIds.length === 0 ||
        recipeIds.length !== recipeQuantities.length
      ) {
        throw new Error("Adicione pelo menos um ingrediente à dose.");
      }

      if (new Set(recipeIds).size !== recipeIds.length) {
        throw new Error(
          "O mesmo ingrediente não pode aparecer duas vezes na receita. Some as quantidades em uma única linha.",
        );
      }
    }

    if (isCombo) {
      if (
        comboIds.length === 0 ||
        comboIds.length !== comboQuantities.length
      ) {
        throw new Error("Adicione pelo menos um produto ao combo.");
      }

      if (new Set(comboIds).size !== comboIds.length) {
        throw new Error(
          "O mesmo produto não pode aparecer duas vezes no combo. Some as quantidades em uma única linha.",
        );
      }
    }

    const recipeItems = isRecipe
      ? recipeIds.map((stockItemId, index) => ({
        stockItemId,
        quantity: parseRepeatedNumber(
          recipeQuantities[index],
          "ingrediente",
        ),
      }))
      : [];

    const comboItems = isCombo
      ? comboIds.map((componentProductId, index) => ({
        componentProductId,
        quantity: parseRepeatedNumber(
          comboQuantities[index],
          "produto do combo",
        ),
      }))
      : [];

    await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        throw new Error("Categoria não encontrada.");
      }

      if (isRecipe) {
        const ingredients = await tx.stockItem.findMany({
          where: {
            id: { in: recipeItems.map((item) => item.stockItemId) },
            active: true,
          },
          select: { id: true },
        });

        if (ingredients.length !== recipeItems.length) {
          throw new Error(
            "Um ou mais ingredientes não existem ou estão inativos.",
          );
        }

        await tx.product.create({
          data: {
            code,
            barcode,
            name,
            description,
            type: "FRACTIONAL",
            salePrice,
            categoryId,
            recipeItems: {
              create: recipeItems,
            },
          },
        });
      }

      if (isCombo) {
        const components = await tx.product.findMany({
          where: {
            id: { in: comboItems.map((item) => item.componentProductId) },
            active: true,
            type: { in: ["STANDARD", "SUPPLY"] },
            stockItemId: { not: null },
          },
          select: { id: true },
        });

        if (components.length !== comboItems.length) {
          throw new Error(
            "Um ou mais componentes não são produtos comuns ativos com estoque vinculado.",
          );
        }

        await tx.product.create({
          data: {
            code,
            barcode,
            name,
            description,
            type: "COMBO",
            salePrice,
            categoryId,
            comboItems: {
              create: comboItems,
            },
          },
        });
      }
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard");
    redirect("/dashboard/products");
  }

  if (type !== "STANDARD" && type !== "SUPPLY") {
    throw new Error("Tipo de produto não suportado.");
  }

  const unit = getText(formData, "unit");
  validateUnit(unit);

  const minStock = getNumber(formData, "minStock");
  const initialStock = getNumber(formData, "initialStock");
  const initialOpenQuantity = getNumber(
    formData,
    "initialOpenQuantity",
  );

  const packagingMode = getText(formData, "packagingMode") || "NONE";

  if (!["NONE", "SELF", "CHILD"].includes(packagingMode)) {
    throw new Error("Tipo de embalagem inválido.");
  }

  const hasSelfPackaging = packagingMode === "SELF";
  const hasChildPackaging = packagingMode === "CHILD";
  const hasPackaging = hasSelfPackaging || hasChildPackaging;

  const packagingName = getText(formData, "packagingName");

  const packagingConversionFactor = hasSelfPackaging
    ? getOptionalNumber(formData, "packagingConversionFactor")
    : null;

  const packagingChildProductId = hasChildPackaging
    ? getText(formData, "packagingChildProductId")
    : "";

  const packagingChildQuantity = hasChildPackaging
    ? getOptionalNumber(formData, "packagingChildQuantity")
    : null;

  if (hasSelfPackaging) {
    if (!packagingName || packagingConversionFactor === null) {
      throw new Error(
        "Informe o nome e a quantidade por embalagem.",
      );
    }
  }

  if (hasChildPackaging) {
    if (unit !== "UNIT") {
      throw new Error(
        "Uma embalagem de outro produto deve utilizar a unidade Unidade.",
      );
    }

    if (!packagingChildProductId || packagingChildQuantity === null) {
      throw new Error(
        "Selecione o produto gerado pela embalagem e informe a quantidade.",
      );
    }

    if (initialOpenQuantity > 0) {
      throw new Error(
        "Embalagens comerciais não possuem quantidade aberta. Informe somente a quantidade de embalagens fechadas.",
      );
    }
  }

  if (!hasSelfPackaging && !hasChildPackaging && initialOpenQuantity > 0) {
    throw new Error(
      "O saldo já aberto exige uma embalagem configurada.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error("Categoria não encontrada.");
    }

    let childProduct = null;

    if (hasChildPackaging) {
      childProduct = await tx.product.findFirst({
        where: {
          id: packagingChildProductId,
          active: true,
          type: { in: ["STANDARD", "SUPPLY"] },
          stockItem: {
            is: {
              active: true,
              unit: "UNIT",
            },
          },
          stockPackagingId: null,
          packagingChildProductId: null,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!childProduct) {
        throw new Error(
          "O produto filho precisa ser um produto comum ativo, com estoque próprio em unidades e sem embalagem de conversão.",
        );
      }
    }

    const factor = hasSelfPackaging
      ? packagingConversionFactor!
      : 1;

    const stockItem = await tx.stockItem.create({
      data: {
        name,
        unit,
        minStock: hasSelfPackaging ? minStock * factor : minStock,
        purchaseCost: hasSelfPackaging
          ? purchaseCost / factor
          : purchaseCost,
        balance: {
          create: {
            quantity: hasSelfPackaging
              ? initialOpenQuantity
              : initialStock,
          },
        },
      },
    });

    let stockPackagingId: string | undefined;

    if (hasSelfPackaging) {
      const packaging = await tx.stockPackaging.create({
        data: {
          name: packagingName,
          conversionFactor: factor,
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
        ...(hasChildPackaging
          ? {
            packagingChildProductId: childProduct!.id,
            packagingChildQuantity: packagingChildQuantity!,
          }
          : {}),
      },
    });

    if (hasSelfPackaging && initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          type: "INITIAL",
          quantity: initialStock,
          unit: "UNIT",
          reason: "Estoque inicial de embalagens fechadas",
          stockItemId: stockItem.id,
          stockPackagingId,
          userId: session.user.id,
        },
      });
    }

    if (hasChildPackaging && initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          type: "INITIAL",
          quantity: initialStock,
          unit: "UNIT",
          reason: `Estoque inicial de embalagens comerciais (${childProduct!.name})`,
          stockItemId: stockItem.id,
          userId: session.user.id,
        },
      });
    }

    const openQuantity = hasSelfPackaging
      ? initialOpenQuantity
      : hasChildPackaging
        ? 0
        : initialStock;

    if (openQuantity > 0) {
      await tx.stockMovement.create({
        data: {
          type: "INITIAL",
          quantity: openQuantity,
          unit,
          reason: hasSelfPackaging
            ? "Estoque inicial de produto já aberto ou avulso"
            : "Estoque inicial do cadastro",
          stockItemId: stockItem.id,
          userId: session.user.id,
        },
      });
    }
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/stock/movements");
  revalidatePath("/dashboard/pos");
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

  const salePrice = getNumber(formData, "salePrice");

  if (!code || !name || !categoryId) {
    throw new Error("Preencha código, nome e categoria.");
  }

  validateType(type);

  if (type === "COMPOSITE") {
    throw new Error("O tipo Composição não é utilizado.");
  }

  await prisma.$transaction(async (tx) => {
    const [currentProduct, category] = await Promise.all([
      tx.product.findUnique({
        where: { id },
        include: {
          recipeItems: true,
          comboItems: true,
          stockItem: true,
          stockPackaging: true,
        },
      }),
      tx.category.findUnique({
        where: { id: categoryId },
      }),
    ]);

    if (!currentProduct || !currentProduct.active) {
      throw new Error("Produto não encontrado ou inativo.");
    }

    if (!category) {
      throw new Error("Categoria não encontrada.");
    }

    if (type !== currentProduct.type) {
      throw new Error(
        "Não é possível alterar o tipo de um produto já cadastrado.",
      );
    }

    // Produtos com estoque próprio.
    if (currentProduct.stockItem) {
      const unit = getText(formData, "unit");
      validateUnit(unit);

      if (unit !== currentProduct.stockItem.unit) {
        throw new Error(
          "Não é possível alterar a unidade de um item que já possui controle de estoque.",
        );
      }

      const minStock = getNumber(formData, "minStock");
      const purchaseCost = getNumber(formData, "purchaseCost");

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

    // Atualização dos ingredientes de uma dose.
    if (currentProduct.type === "FRACTIONAL") {
      const recipeIds = getRepeatedTexts(
        formData,
        "recipeStockItemId",
      );

      const recipeQuantities = getRepeatedTexts(
        formData,
        "recipeQuantity",
      );

      if (
        recipeIds.length === 0 ||
        recipeIds.length !== recipeQuantities.length
      ) {
        throw new Error("Adicione pelo menos um ingrediente à dose.");
      }

      if (new Set(recipeIds).size !== recipeIds.length) {
        throw new Error(
          "O mesmo ingrediente não pode aparecer duas vezes na receita.",
        );
      }

      const recipeItems = recipeIds.map((stockItemId, index) => ({
        stockItemId,
        quantity: parseRepeatedNumber(
          recipeQuantities[index],
          "ingrediente",
        ),
      }));

      const ingredients = await tx.stockItem.findMany({
        where: {
          id: { in: recipeItems.map((item) => item.stockItemId) },
          active: true,
        },
        select: { id: true },
      });

      if (ingredients.length !== recipeItems.length) {
        throw new Error(
          "Um ou mais ingredientes não existem ou estão inativos.",
        );
      }

      await tx.product.update({
        where: { id },
        data: {
          recipeItems: {
            deleteMany: {},
            create: recipeItems,
          },
        },
      });
    }

    // Atualização dos componentes de um combo.
    if (currentProduct.type === "COMBO") {
      const comboIds = getRepeatedTexts(
        formData,
        "comboProductId",
      );

      const comboQuantities = getRepeatedTexts(
        formData,
        "comboQuantity",
      );

      if (
        comboIds.length === 0 ||
        comboIds.length !== comboQuantities.length
      ) {
        throw new Error("Adicione pelo menos um produto ao combo.");
      }

      if (new Set(comboIds).size !== comboIds.length) {
        throw new Error(
          "O mesmo produto não pode aparecer duas vezes no combo.",
        );
      }

      if (comboIds.includes(id)) {
        throw new Error("Um combo não pode conter a si próprio.");
      }

      const comboItems = comboIds.map((componentProductId, index) => ({
        componentProductId,
        quantity: parseRepeatedNumber(
          comboQuantities[index],
          "produto do combo",
        ),
      }));

      const components = await tx.product.findMany({
        where: {
          id: { in: comboItems.map((item) => item.componentProductId) },
          active: true,
          type: { in: ["STANDARD", "SUPPLY"] },
          stockItemId: { not: null },
        },
        select: { id: true },
      });

      if (components.length !== comboItems.length) {
        throw new Error(
          "Um ou mais componentes não são produtos comuns ativos com estoque vinculado.",
        );
      }

      await tx.product.update({
        where: { id },
        data: {
          comboItems: {
            deleteMany: {},
            create: comboItems,
          },
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
  revalidatePath("/dashboard/pos");
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
