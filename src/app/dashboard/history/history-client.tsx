"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DateRangeFilter } from "@/components/data-table/date-range-filter";
import { ListPagination } from "@/components/data-table/list-pagination";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { SortDirection } from "@/lib/list-query";
import type {
  HistoryCashRegisterItem,
  HistoryCreditItem,
  HistorySaleItem,
} from "@/modules/history/list";
import type { PaginatedResult } from "@/lib/list-query";
import { getSaleCode } from "@/lib/sale-code";
import {
  getCashRegisterDetailsAction,
  listHistoryCashRegistersAction,
  listHistoryCreditsAction,
  listHistorySalesAction,
} from "./actions";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const paymentLabels: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
};

type HistoryClientProps = {
  initialSales: PaginatedResult<HistorySaleItem>;
  initialCredits: PaginatedResult<HistoryCreditItem>;
  initialCashRegisters: PaginatedResult<HistoryCashRegisterItem>;
};

function getSalePayments(sale: HistorySaleItem) {
  return sale.payments.length > 0 ? sale.payments : sale.deliveryPayments;
}

function paymentLabel(sale: HistorySaleItem) {
  const labels = getSalePayments(sale).map(
    (item) => paymentLabels[item.paymentMethod] ?? item.paymentMethod,
  );
  if (sale.accountAmount > 0) labels.push("Fiado");
  return labels.length > 0 ? labels.join(", ") : "Não informado";
}

export function HistoryClient({
  initialSales,
  initialCredits,
  initialCashRegisters,
}: HistoryClientProps) {
  const [tab, setTab] = useState<"SALES" | "CREDITS" | "CASH_REGISTERS">(
    "SALES",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [payment, setPayment] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [singleDay, setSingleDay] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [selectedSale, setSelectedSale] = useState<HistorySaleItem | null>(
    null,
  );
  const [selectedCredit, setSelectedCredit] =
    useState<HistoryCreditItem | null>(null);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<
    string | null
  >(null);

  const debouncedSearch = useDebouncedValue(search, 250);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      status,
      payment,
      startDate,
      endDate,
      page,
      pageSize: 20,
      sortBy,
      sortDir,
    }),
    [
      debouncedSearch,
      status,
      payment,
      startDate,
      endDate,
      page,
      sortBy,
      sortDir,
    ],
  );

  function resetPageAnd(updater: () => void) {
    updater();
    setPage(1);
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "createdAt" || column === "openedAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  const salesQuery = useQuery({
    queryKey: ["history-sales", filters],
    queryFn: () => listHistorySalesAction(filters),
    enabled: tab === "SALES",
    initialData:
      tab === "SALES" &&
      page === 1 &&
      !debouncedSearch &&
      status === "ALL" &&
      payment === "ALL" &&
      !startDate &&
      !endDate &&
      sortBy === "createdAt" &&
      sortDir === "desc"
        ? initialSales
        : undefined,
    placeholderData: keepPreviousData,
  });

  const creditsQuery = useQuery({
    queryKey: ["history-credits", filters],
    queryFn: () => listHistoryCreditsAction(filters),
    enabled: tab === "CREDITS",
    initialData:
      tab === "CREDITS" &&
      page === 1 &&
      !debouncedSearch &&
      status === "ALL" &&
      payment === "ALL" &&
      !startDate &&
      !endDate &&
      sortBy === "createdAt" &&
      sortDir === "desc"
        ? initialCredits
        : undefined,
    placeholderData: keepPreviousData,
  });

  const cashRegistersQuery = useQuery({
    queryKey: ["history-cash-registers", filters],
    queryFn: () => listHistoryCashRegistersAction(filters),
    enabled: tab === "CASH_REGISTERS",
    initialData:
      tab === "CASH_REGISTERS" &&
      page === 1 &&
      !debouncedSearch &&
      !startDate &&
      !endDate &&
      sortBy === "openedAt" &&
      sortDir === "desc"
        ? initialCashRegisters
        : undefined,
    placeholderData: keepPreviousData,
  });

  const cashRegisterDetailsQuery = useQuery({
    queryKey: ["history-cash-register", selectedCashRegisterId],
    queryFn: () => getCashRegisterDetailsAction(selectedCashRegisterId!),
    enabled: Boolean(selectedCashRegisterId),
  });

  const activeResult =
    tab === "SALES"
      ? salesQuery.data
      : tab === "CREDITS"
        ? creditsQuery.data
        : cashRegistersQuery.data;

  const isFetching =
    tab === "SALES"
      ? salesQuery.isFetching
      : tab === "CREDITS"
        ? creditsQuery.isFetching
        : cashRegistersQuery.isFetching;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["SALES", "Vendas"],
            ["CREDITS", "Créditos / Fiados"],
            ["CASH_REGISTERS", "Caixas"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={tab === value ? "default" : "outline"}
            onClick={() => {
              setTab(value);
              setPage(1);
              setSortBy(value === "CASH_REGISTERS" ? "openedAt" : "createdAt");
              setSortDir("desc");
              setStatus("ALL");
              setPayment("ALL");
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-[14rem]">
            <Input
              value={search}
              onChange={(event) =>
                resetPageAnd(() => setSearch(event.target.value))
              }
              placeholder={
                tab === "SALES"
                  ? "Buscar por código (#...), cliente ou funcionário..."
                  : "Buscar..."
              }
            />
          </div>

          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            singleDay={singleDay}
            onSingleDayChange={(value) =>
              resetPageAnd(() => setSingleDay(value))
            }
            onStartDateChange={(value) =>
              resetPageAnd(() => setStartDate(value))
            }
            onEndDateChange={(value) => resetPageAnd(() => setEndDate(value))}
          />
        </div>

        {tab !== "CASH_REGISTERS" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Select
              value={status}
              onValueChange={(value) =>
                resetPageAnd(() => setStatus(value ?? "ALL"))
              }
            >
              <SelectTrigger className="w-full sm:w-[14rem]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                {tab === "SALES" ? (
                  <>
                    <SelectItem value="ALL">Todas as situações</SelectItem>
                    <SelectItem value="COMPLETED">Concluídas</SelectItem>
                    <SelectItem value="CANCELLED">Canceladas</SelectItem>
                    <SelectItem value="PENDING_DELIVERY">
                      Aguardando entrega
                    </SelectItem>
                    <SelectItem value="DELIVERY">Todas as entregas</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="ALL">Todos os créditos</SelectItem>
                    <SelectItem value="DEBT_RECEIPT">
                      Recebimento de fiado
                    </SelectItem>
                    <SelectItem value="CANCELLATION_CREDIT">
                      Crédito por cancelamento
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>

            <Select
              value={payment}
              onValueChange={(value) =>
                resetPageAnd(() => setPayment(value ?? "ALL"))
              }
            >
              <SelectTrigger className="w-full sm:w-[14rem]">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as formas</SelectItem>
                <SelectItem value="CASH">Dinheiro</SelectItem>
                <SelectItem value="PIX">Pix</SelectItem>
                <SelectItem value="CREDIT_CARD">Crédito</SelectItem>
                <SelectItem value="DEBIT_CARD">Débito</SelectItem>
                {tab === "SALES" && (
                  <SelectItem value="FIADO">Fiado</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      {isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando lista...</p>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        {tab === "SALES" && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[7.5rem]">Código</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Data"
                    column="createdAt"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Funcionário"
                    column="employee"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Total"
                    column="total"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Status"
                    column="status"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(salesQuery.data?.items ?? []).map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-sm font-semibold tracking-wide">
                    #{getSaleCode(sale.id)}
                  </TableCell>
                  <TableCell>
                    {new Date(sale.createdAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{sale.employee}</p>
                      {sale.customer && (
                        <p className="text-xs text-muted-foreground">
                          {sale.customer.name}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{paymentLabel(sale)}</TableCell>
                  <TableCell className="font-semibold">
                    {currency.format(sale.total)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sale.status === "COMPLETED"
                          ? "default"
                          : sale.status === "CANCELLED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {sale.status === "COMPLETED"
                        ? "Concluída"
                        : sale.status === "CANCELLED"
                          ? "Cancelada"
                          : "Aguardando entrega"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setSelectedSale(sale)}
                    >
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {tab === "CREDITS" && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Data"
                    column="createdAt"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Funcionário"
                    column="employee"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Valor"
                    column="amount"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(creditsQuery.data?.items ?? []).map((credit) => (
                <TableRow key={credit.id}>
                  <TableCell>
                    {new Date(credit.createdAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{credit.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        por {credit.employee}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {credit.kind === "CANCELLATION_CREDIT"
                      ? "Crédito por cancelamento"
                      : "Recebimento de fiado"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {currency.format(credit.amount)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setSelectedCredit(credit)}
                    >
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {tab === "CASH_REGISTERS" && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Abertura"
                    column="openedAt"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>Aberto por</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Abertura R$"
                    column="openingAmount"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Status"
                    column="status"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cashRegistersQuery.data?.items ?? []).map((register) => (
                <TableRow key={register.id}>
                  <TableCell>
                    {new Date(register.openedAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{register.openedBy}</TableCell>
                  <TableCell>
                    {currency.format(register.openingAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        register.status === "OPEN" ? "secondary" : "default"
                      }
                    >
                      {register.status === "OPEN" ? "Aberto" : "Fechado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setSelectedCashRegisterId(register.id)}
                    >
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="border-t px-4">
          <ListPagination
            page={activeResult?.page ?? page}
            pageCount={activeResult?.pageCount ?? 1}
            total={activeResult?.total ?? 0}
            pageSize={activeResult?.pageSize ?? 20}
            isLoading={isFetching}
            onPageChange={setPage}
          />
        </div>
      </section>

      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-lg font-bold tracking-wide text-primary">
                  #{getSaleCode(selectedSale.id)}
                </p>
                <h2 className="text-xl font-bold">Detalhes da venda</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedSale(null)}
              >
                ×
              </Button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <strong>Data:</strong>{" "}
                {new Date(selectedSale.createdAt).toLocaleString("pt-BR")}
              </p>
              <p>
                <strong>Funcionário:</strong> {selectedSale.employee}
              </p>
              <p>
                <strong>Status:</strong> {selectedSale.status}
              </p>
              <p>
                <strong>Pagamento:</strong> {paymentLabel(selectedSale)}
              </p>
              <div>
                <strong>Itens:</strong>
                <ul className="mt-1 list-disc pl-5">
                  {selectedSale.items.map((item) => (
                    <li key={item.id}>
                      {item.productName} × {item.quantity} —{" "}
                      {currency.format(item.total)}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-lg font-bold">
                Total: {currency.format(selectedSale.total)}
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-background p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold">
                {selectedCredit.kind === "CANCELLATION_CREDIT"
                  ? "Crédito por cancelamento"
                  : "Recebimento de fiado"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedCredit(null)}
              >
                ×
              </Button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <strong>Cliente:</strong> {selectedCredit.customer.name}
              </p>
              <p>
                <strong>Funcionário:</strong> {selectedCredit.employee}
              </p>
              {selectedCredit.description && (
                <p>
                  <strong>Descrição:</strong> {selectedCredit.description}
                </p>
              )}
              <p className="text-lg font-bold">
                {currency.format(selectedCredit.amount)}
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedCashRegisterId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold">Detalhes do caixa</h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedCashRegisterId(null)}
              >
                ×
              </Button>
            </div>
            {cashRegisterDetailsQuery.isLoading && (
              <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
            )}
            {cashRegisterDetailsQuery.data && (
              <div className="mt-4 space-y-3 text-sm">
                <p>
                  <strong>Aberto por:</strong>{" "}
                  {cashRegisterDetailsQuery.data.openedBy}
                </p>
                <p>
                  <strong>Abertura:</strong>{" "}
                  {currency.format(
                    cashRegisterDetailsQuery.data.openingAmount,
                  )}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {cashRegisterDetailsQuery.data.status}
                </p>
                <p>
                  <strong>Vendas na sessão:</strong>{" "}
                  {cashRegisterDetailsQuery.data.sales.length}
                </p>
                <p>
                  <strong>Movimentações:</strong>{" "}
                  {cashRegisterDetailsQuery.data.movements.length}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
