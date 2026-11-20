"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditPackagingFields } from "./[id]/edit/edit-packaging-fields";
import { EditProductFields } from "./[id]/edit/edit-product-fields";
import { ProductTypeFields } from "./new/product-type-fields";
import {
  createCategory,
  getProductEditDataAction,
  getProductFormDataAction,
  saveProduct,
} from "./actions";

type NewFormData = Awaited<ReturnType<typeof getProductFormDataAction>>;
type EditFormData = Exclude<
  Awaited<ReturnType<typeof getProductEditDataAction>>,
  { error: string }
>;

type ProductFormModalProps = {
  open: boolean;
  productId: string | null;
  onOpenChange: (open: boolean) => void;
};

const typeLabels: Record<string, string> = {
  STANDARD: "Produto comum",
  SUPPLY: "Descartável / insumo",
  FRACTIONAL: "Dose",
  COMBO: "Combo",
};

export function ProductFormModal({
  open,
  productId,
  onOpenChange,
}: ProductFormModalProps) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [newData, setNewData] = useState<NewFormData | null>(null);
  const [editData, setEditData] = useState<EditFormData | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [categoryName, setCategoryName] = useState("");
  const [isCreatingCategory, startCategoryTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");
      setNewData(null);
      setEditData(null);

      if (productId) {
        const result = await getProductEditDataAction(productId);
        if (cancelled) return;

        if ("error" in result && result.error) {
          setError(result.error);
          setIsLoading(false);
          return;
        }

        setEditData(result);
        setFormKey((current) => current + 1);
        setIsLoading(false);
        return;
      }

      const result = await getProductFormDataAction();
      if (cancelled) return;

      setNewData(result);
      setFormKey((current) => current + 1);
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  function handleSubmit() {
    if (!formRef.current) {
      return;
    }

    startSaveTransition(async () => {
      setError("");
      const formData = new FormData(formRef.current!);
      const result = await saveProduct(formData, productId ?? undefined);

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    });
  }

  function handleCreateCategory() {
    if (!categoryName.trim() || !newData) {
      return;
    }

    startCategoryTransition(async () => {
      const payload = new FormData();
      payload.set("name", categoryName.trim());
      await createCategory(payload);
      const refreshed = await getProductFormDataAction();
      setNewData(refreshed);
      setCategoryName("");
    });
  }

  const isEdit = Boolean(productId);
  const product = editData?.product;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar produto" : "Novo produto"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados comerciais e a composição do produto."
              : "Cadastre produtos comuns, doses e combos."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Carregando formulário...
          </p>
        ) : error && !product && !newData ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : (
          <form
            ref={formRef}
            key={formKey}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            {!isEdit && newData ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Código (opcional)
                    <input
                      name="code"
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      placeholder="Gerado automaticamente se vazio"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Código de barras
                    <input
                      name="barcode"
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      placeholder="EAN"
                    />
                  </label>

                  <label className="text-sm font-medium sm:col-span-2">
                    Nome *
                    <input
                      name="name"
                      required
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      placeholder="Ex.: Whisky 1L, Skol Lata ou Skol Fardo"
                    />
                  </label>

                  <label className="text-sm font-medium sm:col-span-2">
                    Descrição
                    <textarea
                      name="description"
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </label>

                  <label className="text-sm font-medium sm:col-span-2">
                    Categoria *
                    <select
                      name="categoryId"
                      required
                      defaultValue=""
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                    >
                      <option value="" disabled>
                        Selecione uma categoria
                      </option>
                      {newData.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <ProductTypeFields
                  stockItems={newData.stockItems}
                  products={newData.comboProducts}
                  packagingChildProducts={newData.packagingChildProducts}
                  packagingParentProducts={newData.packagingParentProducts}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Preço de venda (R$) *
                    <input
                      name="salePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Custo de compra (R$)
                    <input
                      name="purchaseCost"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </label>
                </div>

                <div>
                  <p className="text-sm font-medium">Nova categoria</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={categoryName}
                      onChange={(event) => setCategoryName(event.target.value)}
                      placeholder="Nome da nova categoria"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 p-3"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isCreatingCategory || !categoryName.trim()}
                      onClick={handleCreateCategory}
                    >
                      {isCreatingCategory ? "Criando..." : "Criar categoria"}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {isEdit && editData && product ? (
              <>
                <div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Código *
                      <input
                        name="code"
                        required
                        defaultValue={product.code}
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>

                    <label className="text-sm font-medium">
                      Código de barras
                      <input
                        name="barcode"
                        defaultValue={product.barcode}
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>

                    <label className="text-sm font-medium sm:col-span-2">
                      Nome *
                      <input
                        name="name"
                        required
                        defaultValue={product.name}
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>

                    <label className="text-sm font-medium sm:col-span-2">
                      Descrição
                      <textarea
                        name="description"
                        defaultValue={product.description}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>

                    <label className="text-sm font-medium sm:col-span-2">
                      Categoria *
                      <select
                        name="categoryId"
                        defaultValue={product.categoryId}
                        required
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                      >
                        {editData.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Tipo de produto</p>
                    <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm">
                      {typeLabels[product.type] ?? product.type}
                    </p>
                    <input type="hidden" name="type" value={product.type} />
                  </div>

                  {product.hasStockItem ? (
                    <div>
                      <p className="text-sm font-medium">Unidade de controle</p>
                      <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm">
                        {product.unit === "UNIT"
                          ? "Unidade"
                          : product.unit === "ML"
                            ? "Mililitros (ml)"
                            : "Gramas (g)"}
                      </p>
                      <input type="hidden" name="unit" value={product.unit} />
                    </div>
                  ) : null}
                </div>

                {(product.type === "STANDARD" || product.type === "SUPPLY") && (
                  <EditPackagingFields
                    isSelfPackaging={product.isSelfPackaging}
                    products={editData.packagingProducts}
                    initialParentProductId={product.packagingParentProductId}
                    initialParentQuantity={product.packagingParentQuantity}
                    initialChildProductId={product.packagingChildProductId}
                    initialChildQuantity={product.packagingChildQuantity}
                  />
                )}

                {product.hasStockItem ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Estoque mínimo
                      <input
                        name="minStock"
                        type="number"
                        min="0"
                        step="0.001"
                        defaultValue={product.minStock}
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>

                    <label className="text-sm font-medium">
                      Custo de compra (R$)
                      <input
                        name="purchaseCost"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={product.purchaseCost}
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>
                  </div>
                ) : null}

                <EditProductFields
                  type={product.type}
                  stockItems={editData.stockItems}
                  products={editData.comboProducts}
                  initialCompositionGroups={editData.initialCompositionGroups}
                  initialComboItems={editData.initialComboItems}
                />

                <label className="block text-sm font-medium">
                  Preço de venda (R$) *
                  <input
                    name="salePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={product.salePrice}
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>
              </>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </form>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={isSaving || isLoading}
            onClick={handleSubmit}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}