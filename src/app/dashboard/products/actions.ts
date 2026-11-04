
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


type CompositionGroupInput = {
  name: string;
  minSelections: number;
  maxSelections: 1;
  position: number;
  options: {
    stockItemId: string;
    quantity: number;
    position: number;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCompositionGroups(
  formData: FormData,
): CompositionGroupInput[] {
  const raw = getText(formData, "compositionGroups");

  if (!raw) {
    throw new Error("Configure a ficha técnica da dose.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("A ficha técnica contém dados inválidos.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Adicione pelo menos um grupo à ficha técnica.");
  }

  return parsed.map((value, groupIndex) => {
    if (!isRecord(value)) {
      throw new Error(`Grupo ${groupIndex + 1} inválido.`);
    }

    const name = value.name;
    const minSelections = Number(value.minSelections);
    const rawOptions = value.options;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !Array.isArray(rawOptions) ||
      rawOptions.length === 0
    ) {
      throw new Error(
        `Configure corretamente o grupo ${groupIndex + 1}.`,
      );
    }

    if (![0, 1].includes(minSelections)) {
      throw new Error("Configuração de grupo inválida.");
    }

    const options = rawOptions.map((rawOption, optionIndex) => {
      if (!isRecord(rawOption)) {
        throw new Error(`Opção inválida no grupo "${name}".`);
      }

      const stockItemId = rawOption.stockItemId;
      const quantity = Number(rawOption.quantity);

      if (
        typeof stockItemId !== "string" ||
        !stockItemId.trim()
      ) {
        throw new Error(
          `Selecione um ingrediente no grupo "${name}".`,
        );
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(
          `Informe uma quantidade válida no grupo "${name}".`,
        );
      }

      return {
        stockItemId,
        quantity,
        position: optionIndex,
      };
    });

    if (
      new Set(options.map((option) => option.stockItemId)).size !==
      options.length
    ) {
      throw new Error(
        `O mesmo ingrediente não pode aparecer duas vezes no grupo "${name}".`,
      );
    }

    return {
      name: name.trim(),
      minSelections,
      maxSelections: 1 as const,
      position: groupIndex,
      options,
    };
  });
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

  const packagingMode = getText(formData, "packagingMode") || "NONE";

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

    const compositionGroups = isRecipe
      ? parseCompositionGroups(formData)
      : [];

    const comboIds = getRepeatedTexts(
      formData,
      "comboProductId",
    );

    const comboQuantities = getRepeatedTexts(
      formData,
      "comboQuantity",
    );

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
        const stockItemIds = [
          ...new Set(
            compositionGroups.flatMap((group) =>
              group.options.map((option) => option.stockItemId),
            ),
          ),
        ];

        const ingredients = await tx.stockItem.findMany({
          where: {
            id: { in: stockItemIds },
            active: true,
          },
          select: { id: true },
        });

        if (ingredients.length !== stockItemIds.length) {
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
            composition: {
              create: {
                groups: {
                  create: compositionGroups.map((group) => ({
                    name: group.name,
                    minSelections: group.minSelections,
                    maxSelections: group.maxSelections,
                    position: group.position,
                    options: {
                      create: group.options,
                    },
                  })),
                },
              },
            },
          },
        });
      }

      if (isCombo) {
        const components = await tx.product.findMany({
          where: {
            id: {
              in: comboItems.map(
                (item) => item.componentProductId,
              ),
            },
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

  if (!["NONE", "SELF", "CHILD"].includes(packagingMode)) {
    throw new Error("Tipo de embalagem inválido.");
  }

  const hasSelfPackaging = packagingMode === "SELF";
  const hasChildPackaging = packagingMode === "CHILD";

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

  const packagingParentProductId = hasChildPackaging
    ? getText(formData, "packagingParentProductId")
    : "";

  const packagingParentQuantity = packagingParentProductId
    ? getOptionalNumber(formData, "packagingParentQuantity")
    : null;

  if (hasSelfPackaging) {
    if (!packagingName || packagingConversionFactor === null) {
      throw new Error(
        "Informe o nome e a quantidade por embalagem.",
      );
    }
  }

  if (packagingParentProductId) {
    if (hasSelfPackaging || unit !== "UNIT") {
      throw new Error(
        "Um produto originado de outra embalagem precisa utilizar estoque em unidades.",
      );
    }

    if (packagingParentQuantity === null) {
      throw new Error(
        "Informe a quantidade gerada pela embalagem de origem.",
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
          packagingParentProducts: {
            none: {},
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!childProduct) {
        throw new Error(
          "O produto filho precisa estar ativo, possuir estoque próprio em unidades e não ter outro produto de origem.",
        );
      }
    }

    let parentProduct = null;

    if (packagingParentProductId) {
      parentProduct = await tx.product.findFirst({
        where: {
          id: packagingParentProductId,
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

      if (!parentProduct) {
        throw new Error(
          "O produto de origem não está disponível ou já possui outro produto vinculado.",
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

    const newProduct = await tx.product.create({
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

    if (parentProduct) {
      await tx.product.update({
        where: {
          id: parentProduct.id,
        },
        data: {
          packagingChildProductId: newProduct.id,
          packagingChildQuantity: packagingParentQuantity!,
        },
      });
    }

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

  const packagingMode = getText(formData, "packagingMode") || "NONE";

  const salePrice = getNumber(formData, "salePrice");

  const packagingParentProductId =
    packagingMode === "CHILD"
      ? getText(formData, "packagingParentProductId")
      : "";

  const packagingParentQuantity = packagingParentProductId
    ? getOptionalNumber(formData, "packagingParentQuantity")
    : null;

  const packagingChildProductId =
    packagingMode === "CHILD"
      ? getText(formData, "packagingChildProductId")
      : "";

  const packagingChildQuantity = packagingChildProductId
    ? getOptionalNumber(formData, "packagingChildQuantity")
    : null;

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
          composition: {
            include: {
              groups: {
                include: {
                  options: true,
                },
              },
            },
          },
          comboItems: true,
          stockItem: true,
          stockPackaging: true,
          packagingChildProduct: {
            select: {
              id: true,
            },
          },
          packagingParentProducts: {
            select: {
              id: true,
              packagingChildQuantity: true,
            },
          },
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

    const isSelfPackaging = Boolean(currentProduct.stockPackaging);

    if (!["NONE", "SELF", "CHILD"].includes(packagingMode)) {
      throw new Error("Tipo de controle de embalagem inválido.");
    }

    if (isSelfPackaging && packagingMode !== "SELF") {
      throw new Error(
        "Este produto possui embalagem própria e não pode mudar de configuração por aqui.",
      );
    }

    if (!isSelfPackaging && packagingMode === "SELF") {
      throw new Error(
        "Não é possível transformar um produto em embalagem própria por esta edição.",
      );
    }

    // Só valida relacionamentos quando o modo for CHILD.
    if (packagingMode === "CHILD") {
      if (
        currentProduct.type !== "STANDARD" &&
        currentProduct.type !== "SUPPLY"
      ) {
        throw new Error(
          "Somente produtos comuns podem ter relações de embalagem.",
        );
      }

      if (
        packagingParentProductId === id ||
        packagingChildProductId === id
      ) {
        throw new Error(
          "Um produto não pode ter relação de embalagem consigo mesmo.",
        );
      }

      if (!packagingParentProductId && !packagingChildProductId) {
        throw new Error(
          "Informe um produto de origem ou um produto de destino para a embalagem.",
        );
      }

      if (
        packagingParentProductId &&
        packagingParentQuantity === null
      ) {
        throw new Error(
          "Informe a quantidade gerada pelo produto de origem.",
        );
      }

      if (
        packagingChildProductId &&
        packagingChildQuantity === null
      ) {
        throw new Error(
          "Informe a quantidade gerada ao abrir este produto.",
        );
      }

      const relatedProductIds = [
        packagingParentProductId,
        packagingChildProductId,
      ].filter((productId): productId is string => Boolean(productId));

      const relatedProducts = await tx.product.findMany({
        where: {
          id: {
            in: relatedProductIds,
          },
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      if (relatedProducts.length !== new Set(relatedProductIds).size) {
        throw new Error(
          "Um ou mais produtos relacionados não foram encontrados.",
        );
      }

      const invalidProduct = relatedProducts.find(
        (product) =>
          product.type !== "STANDARD" &&
          product.type !== "SUPPLY",
      );

      if (invalidProduct) {
        throw new Error(
          `O produto "${invalidProduct.name}" não pode participar de relações de embalagem.`,
        );
      }

      if (packagingChildProductId) {
        let currentChildId: string | null = packagingChildProductId;
        const visitedProducts = new Set<string>();

        while (currentChildId) {
          if (currentChildId === id) {
            throw new Error(
              "Essa relação criaria um ciclo na cadeia de embalagens.",
            );
          }

          if (visitedProducts.has(currentChildId)) {
            throw new Error(
              "Já existe um ciclo na cadeia de embalagens.",
            );
          }

          visitedProducts.add(currentChildId);

          const childProductResult: { packagingChildProductId: string | null } | null =
            await tx.product.findUnique({
              where: {
                id: currentChildId,
              },
              select: {
                packagingChildProductId: true,
              },
            });

          currentChildId = childProductResult?.packagingChildProductId ?? null;

        }
      }
    }

    if (currentProduct.type === "FRACTIONAL") {
      const compositionGroups = parseCompositionGroups(formData);

      const stockItemIds = [
        ...new Set(
          compositionGroups.flatMap((group) =>
            group.options.map((option) => option.stockItemId),
          ),
        ),
      ];

      const ingredients = await tx.stockItem.findMany({
        where: {
          id: { in: stockItemIds },
          active: true,
        },
        select: { id: true },
      });

      if (ingredients.length !== stockItemIds.length) {
        throw new Error(
          "Um ou mais ingredientes não existem ou estão inativos.",
        );
      }

      const groupsData = compositionGroups.map((group) => ({
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        position: group.position,
        options: {
          create: group.options,
        },
      }));

      if (currentProduct.composition) {
        await tx.compositionGroup.deleteMany({
          where: {
            compositionId: currentProduct.composition.id,
          },
        });

        await tx.productComposition.update({
          where: {
            id: currentProduct.composition.id,
          },
          data: {
            groups: {
              create: groupsData,
            },
          },
        });
      } else {
        await tx.productComposition.create({
          data: {
            productId: id,
            groups: {
              create: groupsData,
            },
          },
        });
      }
    }

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

    if (!isSelfPackaging) {
      // Identifica os pais que atualmente apontam para este produto.
      const currentParentIds = currentProduct.packagingParentProducts.map(
        (parent) => parent.id,
      );

      // Verifica se o novo pai já possui outro filho.
      if (packagingParentProductId) {
        const selectedParent = await tx.product.findUnique({
          where: {
            id: packagingParentProductId,
          },
          select: {
            id: true,
            packagingChildProductId: true,
          },
        });

        if (
          selectedParent?.packagingChildProductId &&
          selectedParent.packagingChildProductId !== id
        ) {
          throw new Error(
            "O produto de origem já possui outro produto filho vinculado.",
          );
        }
      }

      if (packagingChildProductId) {
        const existingChildParent = await tx.product.findFirst({
          where: {
            packagingChildProductId,
          },
          select: {
            id: true,
          },
        });

        if (
          existingChildParent &&
          existingChildParent.id !== id
        ) {
          throw new Error(
            "Este produto já possui outro produto pai vinculado.",
          );
        }
      }

      if (currentParentIds.length > 0) {
        await tx.product.updateMany({
          where: {
            id: {
              in: currentParentIds,
            },
            packagingChildProductId: id,
          },
          data: {
            packagingChildProductId: null,
            packagingChildQuantity: null,
          },
        });
      }

      if (packagingParentProductId) {
        await tx.product.update({
          where: {
            id: packagingParentProductId,
          },
          data: {
            packagingChildProductId: id,
            packagingChildQuantity: packagingParentQuantity,
          },
        });
      }

      await tx.product.update({
        where: {
          id,
        },
        data: {
          packagingChildProductId: packagingChildProductId || null,
          packagingChildQuantity: packagingChildProductId
            ? packagingChildQuantity
            : null,
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