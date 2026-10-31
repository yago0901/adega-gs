
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/permissions";
import { createCategory, createProduct } from "../actions";

export default async function NewProductPage() {
    return (
        <Suspense
            fallback={
                <div className="p-8 text-sm text-slate-500">
                    Carregando cadastro de produtos...
                </div>
            }
        >
            <NewProductContent />
        </Suspense>
    );
}

async function NewProductContent() {
    await requireModuleAccess("PRODUCTS");

    const categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
    });

    return (
        <main className="min-h-screen bg-slate-100 p-5 md:p-8">
            <div className="mx-auto max-w-3xl">
                <Link
                    href="/dashboard/products"
                    className="text-sm text-emerald-700 hover:underline"
                >
                    ← Voltar para produtos
                </Link>

                <h1 className="mt-4 text-2xl font-bold">Novo produto</h1>

                <p className="mt-1 text-sm text-slate-500">
                    Cadastre os dados comerciais e o estoque inicial.
                </p>

                <form
                    action={createProduct}
                    className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                    <section>
                        <h2 className="mb-4 font-bold">Informações básicas</h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-medium">
                                Código *
                                <input
                                    name="code"
                                    required
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                    placeholder="Ex.: CERV001"
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
                                    placeholder="Ex.: Cerveja lata 350ml"
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

                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </section>

                    <section className="border-t border-slate-100 pt-6">
                        <h2 className="mb-4 font-bold">
                            Classificação e unidade
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-medium">
                                Tipo de produto
                                <select
                                    name="type"
                                    defaultValue="STANDARD"
                                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                                >
                                    <option value="STANDARD">Produto comum</option>
                                    <option value="SUPPLY">
                                        Descartável / insumo
                                    </option>
                                    <option value="FRACTIONAL">Fracionado</option>
                                    <option value="COMPOSITE">Composição</option>
                                    <option value="COMBO">Combo</option>
                                </select>
                            </label>

                            <label className="text-sm font-medium">
                                Unidade
                                <select
                                    name="unit"
                                    defaultValue="UNIT"
                                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                                >
                                    <option value="UNIT">Unidade</option>
                                    <option value="ML">Mililitros (ml)</option>
                                    <option value="GRAM">Gramas (g)</option>
                                </select>
                            </label>
                        </div>
                    </section>

                    <section className="border-t border-slate-100 pt-6">
                        <h2 className="mb-4 font-bold">Valores e estoque</h2>

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
                                Custo de compra (R$) *
                                <input
                                    name="purchaseCost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                />
                            </label>

                            <label className="text-sm font-medium">
                                Estoque mínimo
                                <input
                                    name="minStock"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    defaultValue="0"
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                />
                            </label>

                            <label className="text-sm font-medium">
                                Quantidade inicial
                                <input
                                    name="initialStock"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    defaultValue="0"
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                />
                            </label>
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                            A quantidade inicial será registrada como uma
                            movimentação de entrada. O saldo não será editado
                            diretamente.
                        </p>
                    </section>

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
                        <Link
                            href="/dashboard/products"
                            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold"
                        >
                            Cancelar
                        </Link>

                        <button
                            type="submit"
                            className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                            Salvar produto
                        </button>
                    </div>
                </form>

                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-bold">Gerenciar categorias</h2>

                    <p className="mt-1 text-sm text-slate-500">
                        Cadastre categorias para utilizar nos produtos.
                    </p>

                    <form
                        action={createCategory}
                        className="mt-4 flex flex-wrap gap-2"
                    >
                        <input
                            name="name"
                            required
                            placeholder="Nome da nova categoria"
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 p-3"
                        />

                        <button
                            type="submit"
                            className="rounded-lg bg-slate-800 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                        >
                            Criar categoria
                        </button>
                    </form>

                    {categories.length > 0 && (
                        <div className="mt-5 border-t border-slate-100 pt-4">
                            <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                                Categorias cadastradas
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {categories.map((category) => (
                                    <span
                                        key={category.id}
                                        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"
                                    >
                                        {category.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
