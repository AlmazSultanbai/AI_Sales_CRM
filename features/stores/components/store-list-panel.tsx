"use client";

import { ArrowDown, CheckCircle2, CircleAlert, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Store } from "@/types/domain";
import { formatCurrency, storeDebtIndicator } from "@/features/stores/lib/view-utils";

type StoreFilter = "all" | "with_debt" | "without_debt" | "inactive";
type StoreSort = "name" | "debt" | "activity";

export function StoreListPanel({
  stores,
  selectedStoreId,
  searchValue,
  onSearchValueChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  onSelectStore,
}: {
  stores: Store[];
  selectedStoreId?: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  filter: StoreFilter;
  onFilterChange: (value: StoreFilter) => void;
  sort: StoreSort;
  onSortChange: (value: StoreSort) => void;
  onSelectStore: (storeId: string) => void;
}) {
  return (
    <aside className="flex h-[calc(100vh-10.5rem)] flex-col rounded-2xl border border-border bg-white">
      <div className="space-y-3 border-b border-border p-4">
        <p className="text-sm font-semibold text-ink">Магазины</p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Поиск магазина..."
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <select
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as StoreFilter)}
          >
            <option value="all">Все магазины</option>
            <option value="with_debt">С долгом</option>
            <option value="without_debt">Без долга</option>
            <option value="inactive">Неактивные</option>
          </select>

          <select
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as StoreSort)}
          >
            <option value="name">Сортировка: по названию</option>
            <option value="debt">Сортировка: по долгу</option>
            <option value="activity">Сортировка: по активности</option>
          </select>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {stores.length ? (
          stores.map((store) => {
            const debt = Number(store.current_debt_sum ?? store.debt_balance ?? 0);
            const active = store.id === selectedStoreId;

            return (
              <button
                key={store.id}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition",
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-slate-50 text-slate-900 hover:bg-slate-100"
                )}
                onClick={() => onSelectStore(store.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{store.name}</p>
                    <p className={cn("mt-1 truncate text-xs", active ? "text-slate-300" : "text-muted")}>
                      {store.contact_person || "Без контакта"}
                    </p>
                  </div>

                  <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", storeDebtIndicator(debt))} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  {debt > 0 ? (
                    <span className={cn("text-xs font-medium", active ? "text-rose-300" : "text-rose-600")}>
                      -{formatCurrency(debt)}
                    </span>
                  ) : (
                    <span className={cn("inline-flex items-center gap-1 text-xs", active ? "text-emerald-300" : "text-emerald-700")}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      0
                    </span>
                  )}

                  <span className={cn("inline-flex items-center gap-1 text-xs", active ? "text-slate-300" : "text-slate-500")}>
                    <ArrowDown className="h-3.5 w-3.5 rotate-45" />
                    {store.is_active === false ? "Неактивный" : "Активный"}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
            <CircleAlert className="mx-auto mb-2 h-5 w-5 text-slate-400" />
            Магазины не найдены
          </div>
        )}
      </div>
    </aside>
  );
}
