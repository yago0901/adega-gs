
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "../actions";

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  categoryId: string;
};

type Props = {
  categories: Category[];
  products: Product[];
};

export function CategoryManager({
  categories,
  products,
}: Props) {
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null);

  const [targetCategoryId, setTargetCategoryId] = useState("");

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  const selectedProducts = selectedCategory
    ? products.filter(
        (product) => product.categoryId === selectedCategory.id,
      )
    : [];

  function handleDelete(category: Category) {
    const categoryProducts = products.filter(
      (product) => product.categoryId === category.id,
    );

    setError("");

    if (categoryProducts.length > 0) {
      setSelectedCategory(category);
      setTargetCategoryId("");
      return;
    }

    startTransition(async () => {
      try {
        await deleteCategory(category.id);
        router.refresh();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível excluir a categoria.",
        );
      }
    });
  }

  function handleTransfer() {
    if (!selectedCategory || !targetCategoryId) {
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        await deleteCategory(
          selectedCategory.id,
          targetCategoryId,
        );

        setSelectedCategory(null);
        setTargetCategoryId("");

        router.refresh();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível transferir os produtos.",
        );
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-3 pr-1.5 text-xs font-medium text-slate-700"
          >
            <span>{category.name}</span>

            <button
              type="button"
              onClick={() => handleDelete(category)}
              disabled={isPending}
              aria-label={`Excluir categoria ${category.name}`}
              title={`Excluir ${category.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {error && !selectedCategory && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Excluir categoria
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  A categoria "{selectedCategory.name}" possui{" "}
                  {selectedProducts.length} produto(s).
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setError("");
                }}
                disabled={isPending}
                className="text-2xl text-slate-400 hover:text-slate-700"
                aria-label="Fechar modal"
              >
                ×
              </button>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">
                Produtos vinculados
              </p>

              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {selectedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="border-b border-slate-100 pb-2 text-sm text-slate-700 last:border-0 last:pb-0"
                  >
                    {product.name}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-semibold">
                Transferir todos para:
              </label>

              <select
                value={targetCategoryId}
                onChange={(event) =>
                  setTargetCategoryId(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
              >
                <option value="">
                  Selecione uma categoria
                </option>

                {categories
                  .filter(
                    (category) =>
                      category.id !== selectedCategory.id,
                  )
                  .map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
              </select>

              {categories.length <= 1 && (
                <p className="mt-2 text-xs text-amber-700">
                  Crie outra categoria antes de excluir esta.
                </p>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setError("");
                }}
                disabled={isPending}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleTransfer}
                disabled={!targetCategoryId || isPending}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending
                  ? "Transferindo..."
                  : "Trocar de categoria"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
