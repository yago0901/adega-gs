"use client";

import { useMemo, useState, useTransition } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPagination } from "@/components/data-table/list-pagination";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePaginatedListState } from "@/hooks/use-paginated-list";
import type { PaginatedResult } from "@/lib/list-query";
import type { MotoboyListItem } from "@/modules/motoboys/list";
import {
  deactivateMotoboy,
  listMotoboysAction,
  reactivateMotoboy,
  saveMotoboy,
} from "./actions";

type MotoboyFormState = {
  open: boolean;
  motoboy: MotoboyListItem | null;
  name: string;
  phone: string;
  notes: string;
  error: string;
};

type MotoboysListClientProps = {
  initial: PaginatedResult<MotoboyListItem>;
  initialActiveTotal: number;
};

export function MotoboysListClient({
  initial,
  initialActiveTotal,
}: MotoboysListClientProps) {
  const queryClient = useQueryClient();
  const [isSaving, startSaveTransition] = useTransition();

  const [form, setForm] = useState<MotoboyFormState>({
    open: false,
    motoboy: null,
    name: "",
    phone: "",
    notes: "",
    error: "",
  });

  const [active, setActive] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  function openCreateModal() {
    setForm({
      open: true,
      motoboy: null,
      name: "",
      phone: "",
      notes: "",
      error: "",
    });
  }

  function openEditModal(motoboy: MotoboyListItem) {
    setForm({
      open: true,
      motoboy,
      name: motoboy.name,
      phone: motoboy.phone,
      notes: motoboy.notes ?? "",
      error: "",
    });
  }

  function closeFormModal() {
    setForm((current) => ({ ...current, open: false, error: "" }));
  }

  function handleSaveMotoboy() {
    startSaveTransition(async () => {
      const payload = new FormData();
      payload.set("name", form.name.trim());
      payload.set("phone", form.phone.trim());
      payload.set("notes", form.notes.trim());

      const result = await saveMotoboy(payload, form.motoboy?.id);

      if ("error" in result && result.error) {
        setForm((current) => ({ ...current, error: result.error }));
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["motoboys"] });
      closeFormModal();
    });
  }

  const {
    search,
    page,
    sortBy,
    sortDir,
    filters: baseFilters,
    debouncedSearch,
    setPage,
    toggleSort,
    onSearchChange,
    resetPageAnd,
  } = usePaginatedListState({
    sortBy: "name",
    sortDir: "asc",
    pageSize: 20,
  });

  const filters = useMemo(
    () => ({
      ...baseFilters,
      active,
    }),
    [baseFilters, active],
  );

  const query = useQuery({
    queryKey: ["motoboys", filters],
    queryFn: () => listMotoboysAction(filters),
    initialData:
      page === 1 &&
      !debouncedSearch &&
      active === "ALL" &&
      sortBy === "name" &&
      sortDir === "asc"
        ? initial
        : undefined,
    placeholderData: keepPreviousData,
  });

  const result = query.data;
  const items = result?.items ?? [];

  const totalCadastrados =
    active === "ALL" ? (result?.total ?? initial.total) : initial.total;
  const displayedActiveTotal =
    active === "ACTIVE"
      ? (result?.total ?? initialActiveTotal)
      : initialActiveTotal;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <a
            href="/dashboard"
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Dashboard
          </a>
          <h1 className="mt-3 text-2xl font-bold">Motoboys</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastro e gerenciamento dos motoboys da adega.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Novo motoboy
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Motoboys cadastrados</p>
          <p className="mt-2 text-2xl font-bold">{totalCadastrados}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Motoboys ativos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {active === "INACTIVE" ? "—" : displayedActiveTotal}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nome, telefone ou observações..."
        />
        <Select
          value={active}
          onValueChange={(value) =>
            resetPageAnd(() =>
              setActive((value as "ALL" | "ACTIVE" | "INACTIVE") ?? "ALL"),
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="ACTIVE">Ativos</SelectItem>
            <SelectItem value="INACTIVE">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando lista...</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="font-semibold">Nenhum motoboy encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {search || active !== "ALL"
                ? "Tente outros filtros."
                : "Comece cadastrando o primeiro motoboy da adega."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Motoboy"
                    column="name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Telefone"
                    column="phone"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Status"
                    column="active"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((motoboy) => (
                <TableRow key={motoboy.id}>
                  <TableCell className="font-semibold">{motoboy.name}</TableCell>
                  <TableCell>{motoboy.phone}</TableCell>
                  <TableCell className="max-w-xs text-muted-foreground">
                    {motoboy.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={motoboy.active ? "default" : "secondary"}>
                      {motoboy.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => openEditModal(motoboy)}
                      >
                        Editar
                      </Button>
                      {motoboy.active ? (
                        <form
                          action={deactivateMotoboy.bind(null, motoboy.id)}
                        >
                          <Button
                            type="submit"
                            variant="link"
                            className="h-auto p-0 text-destructive"
                          >
                            Desativar
                          </Button>
                        </form>
                      ) : (
                        <form
                          action={reactivateMotoboy.bind(null, motoboy.id)}
                        >
                          <Button
                            type="submit"
                            variant="link"
                            className="h-auto p-0"
                          >
                            Reativar
                          </Button>
                        </form>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="border-t px-4">
          <ListPagination
            page={result?.page ?? page}
            pageCount={result?.pageCount ?? 1}
            total={result?.total ?? 0}
            pageSize={result?.pageSize ?? 20}
            isLoading={query.isFetching}
            onPageChange={setPage}
          />
        </div>
      </section>

      <Dialog
        open={form.open}
        onOpenChange={(open) => {
          if (!open) {
            closeFormModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.motoboy ? "Editar motoboy" : "Novo motoboy"}
            </DialogTitle>
            <DialogDescription>
              {form.motoboy
                ? `Atualize os dados de ${form.motoboy.name}.`
                : "Cadastre nome, telefone e observações do motoboy."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="motoboy-name">Nome completo *</Label>
              <Input
                id="motoboy-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    error: "",
                  }))
                }
                placeholder="Nome do motoboy"
                minLength={2}
                maxLength={120}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="motoboy-phone">Telefone com DDD *</Label>
              <Input
                id="motoboy-phone"
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                    error: "",
                  }))
                }
                placeholder="(11) 99999-9999"
                minLength={10}
                maxLength={20}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="motoboy-notes">Observações</Label>
              <textarea
                id="motoboy-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={4}
                maxLength={1000}
                placeholder="Informações adicionais..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            {form.error ? (
              <p className="text-sm text-destructive">{form.error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeFormModal}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={
                isSaving ||
                form.name.trim().length < 2 ||
                form.phone.trim().length < 10
              }
              onClick={handleSaveMotoboy}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}