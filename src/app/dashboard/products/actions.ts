"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ListQueryInput } from "@/lib/list-query";
import { requireModuleAccess } from "@/lib/permissions";
import { listProducts } from "@/modules/products/list";
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