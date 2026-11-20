"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ListQueryInput } from "@/lib/list-query";
import { requireModuleAccess } from "@/lib/permissions";
import { listProducts } from "@/modules/products/list";
import {
  getEditProductPageData,
  getNewProductPageData,
} from "@/modules/products/queries";
import {
  createCategory as createCategoryRecord,
  createProduct as createProductRecord,
  deactivateProduct as deactivateProductRecord,
  deleteCategory as deleteCategoryRecord,
  updateProduct as updateProductRecord,
} from "@/modules/products/service";

export async function listProductsAction(input: ListQueryInput = {}) {
  await requireModuleAccess("PRODUCTS");
  return listProducts(input);
}

export async function createCategory(formData: FormData) {
  await requireModuleAccess("PRODUCTS");

  await createCategoryRecord(formData);

  revalidatePath("/dashboard/products/new");
  revalidatePath("/dashboard/products");
}

export async function deleteCategory(
  categoryId: string,
  targetCategoryId?: string,
) {
  await requireModuleAccess("PRODUCTS");

  await deleteCategoryRecord(categoryId, targetCategoryId);

  revalidatePath("/dashboard/products/new");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard");
}

export async function createProduct(formData: FormData) {
  const session = await requireModuleAccess("PRODUCTS");

  const { revalidateStock } = await createProductRecord(
    formData,
    session.user.id,
  );

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard");

  if (revalidateStock) {
    revalidatePath("/dashboard/stock");
    revalidatePath("/dashboard/stock/movements");
  }

  redirect("/dashboard/products");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireModuleAccess("PRODUCTS");

  await updateProductRecord(id, formData);

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

  await deactivateProductRecord(id);

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
}

function mapNewProductFormOptions(
  products: Awaited<
    ReturnType<typeof getNewProductPageData>
  >["products"],
) {
  return {
    comboProducts: products.map((product) => ({
      id: product.id,
      name: product.name,
    })),
    packagingChildProducts: products
      .filter(
        (product) =>
          product.stockItem?.unit === "UNIT" &&
          product.stockPackagingId === null &&
          product.packagingParentProducts.length === 0,
      )
      .map((product) => ({
        id: product.id,
        name: product.name,
      })),
    packagingParentProducts: products
      .filter(
        (product) =>
          product.stockItem?.unit === "UNIT" &&
          product.stockPackagingId === null &&
          product.packagingChildProductId === null,
      )
      .map((product) => ({
        id: product.id,
        name: product.name,
      })),
  };
}

export async function getProductFormDataAction() {
  await requireModuleAccess("PRODUCTS");

  const { categories, stockItems, products, categoryProducts } =
    await getNewProductPageData();

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
    })),
    stockItems,
    categoryProducts,
    ...mapNewProductFormOptions(products),
  };
}

export async function getProductEditDataAction(id: string) {
  await requireModuleAccess("PRODUCTS");

  const { product, categories, stockItems, products } =
    await getEditProductPageData(id);

  if (!product || !product.active) {
    return { error: "Produto não encontrado." as const };
  }

  if (product.type === "COMPOSITE") {
    return { error: "Este tipo de produto não pode ser editado aqui." as const };
  }

  const conversionFactor =
    product.stockPackaging?.conversionFactor.toNumber() ?? 1;

  const packagingParent = product.packagingParentProducts[0] ?? null;

  const packagingProducts = Array.from(
    new Map(
      [
        ...products,
        ...(product.packagingChildProduct
          ? [product.packagingChildProduct]
          : []),
        ...product.packagingParentProducts.map((parent) => ({
          id: parent.id,
          name: parent.name,
        })),
      ].map((item) => [item.id, item]),
    ).values(),
  );

  return {
    product: {
      id: product.id,
      code: product.code,
      barcode: product.barcode ?? "",
      name: product.name,
      description: product.description ?? "",
      imageUrl: product.imageUrl ?? "",
      categoryId: product.categoryId,
      type: product.type,
      salePrice: product.salePrice.toString(),
      unit: product.stockItem?.unit ?? "UNIT",
      isSelfPackaging: Boolean(product.stockPackaging),
      minStock: product.stockItem
        ? String(product.stockItem.minStock.toNumber() / conversionFactor)
        : "0",
      purchaseCost: product.stockItem
        ? String(product.stockItem.purchaseCost.toNumber() * conversionFactor)
        : "0",
      hasStockItem: Boolean(product.stockItem),
      packagingParentProductId: packagingParent?.id ?? "",
      packagingParentQuantity:
        packagingParent?.packagingChildQuantity?.toString() ?? "",
      packagingChildProductId: product.packagingChildProduct?.id ?? "",
      packagingChildQuantity:
        product.packagingChildQuantity?.toString() ?? "",
    },
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
    })),
    stockItems,
    comboProducts: products
      .filter((item) => item.id !== product.id)
      .map((item) => ({ id: item.id, name: item.name })),
    packagingProducts: packagingProducts
      .filter((item) => item.id !== product.id)
      .map((item) => ({ id: item.id, name: item.name })),
    initialCompositionGroups:
      product.composition?.groups.map((group) => ({
        name: group.name,
        required: group.minSelections > 0,
        options: group.options.map((option) => ({
          stockItemId: option.stockItemId,
          quantity: option.quantity.toNumber(),
        })),
      })) ?? [],
    initialComboItems: product.comboItems.map((item) => ({
      componentProductId: item.componentProductId,
      quantity: item.quantity.toNumber(),
    })),
  };
}

export async function saveProduct(formData: FormData, id?: string) {
  const session = await requireModuleAccess("PRODUCTS");

  try {
    if (id) {
      await updateProductRecord(id, formData);
      revalidatePath(`/dashboard/products/${id}/edit`);
      revalidatePath("/dashboard/stock");
      revalidatePath("/dashboard/stock/movements");
    } else {
      const { revalidateStock } = await createProductRecord(
        formData,
        session.user.id,
      );

      if (revalidateStock) {
        revalidatePath("/dashboard/stock");
        revalidatePath("/dashboard/stock/movements");
      }
    }

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard");

    return { success: true as const };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível salvar.",
    };
  }
}