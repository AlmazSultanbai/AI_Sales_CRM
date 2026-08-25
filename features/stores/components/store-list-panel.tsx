"use client";

import { ChevronRight, CircleAlert, MapPin, Phone, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Store } from "@/types/domain";
import { formatCurrency } from "@/features/stores/lib/view-utils";

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
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          className="crm-search"
          placeholder="Поиск: имя, телефон, адрес..."
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as StoreFilter)}
        >
          <option value="all">Все клиенты</option>
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

      <div className="max-h-[26rem] space-y-2.5 overflow-y-auto pr-0.5">
        {stores.length ? (
          stores.map((store) => {
            const debt = Number(store.current_debt_sum ?? store.debt_balance ?? 0);
            const active = store.id === selectedStoreId;

            return (
              <button
                key={store.id}
                type="button"
                onClick={() => onSelectStore(store.id)}
                className={cn(
                  "crm-row crm-row-link flex w-full items-center gap-3 text-left",
                  active ? "border-accent ring-1 ring-accent/25" : ""
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <User className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="crm-row-title block truncate">{store.name}</span>

                  {store.phone ? (
                    <span className="crm-row-sub flex items-center gap-1.5 truncate">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {store.phone}
                    </span>
                  ) : null}

                  {store.address ? (
                    <span className="crm-row-sub flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {store.address}
                    </span>
                  ) : null}

                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    {debt > 0 ? (
                      <span className="crm-pill bg-rose-50 text-rose-700">Долг {formatCurrency(debt)}</span>
                    ) : (
                      <span className="crm-pill bg-emerald-50 text-emerald-700">Без долга</span>
                    )}
                    {store.is_active === false ? <span className="crm-pill crm-pill-soft">Неактивный</span> : null}
                  </span>
                </span>

                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            <CircleAlert className="mx-auto mb-2 h-5 w-5 text-slate-400" />
            Клиенты не найдены
          </div>
        )}
      </div>
    </div>
  );
}
