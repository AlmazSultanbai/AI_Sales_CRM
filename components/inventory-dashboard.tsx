"use client";

import { useEffect, useMemo, useState } from "react";
import { allowedUnits, categoryLabels, unitLabels } from "@/lib/product-utils";
import {
  Product,
  ProductCategory,
  ProductPayload,
  StoreDebt,
  StoreDebtPayload,
  UnitType,
} from "@/lib/types";

const defaultForm: ProductPayload = {
  category: "material",
  collection_name: "",
  model: "",
  color: "",
  price: 0,
  unit: "m2",
  stock: 0,
};

const defaultDebtForm: StoreDebtPayload = {
  shop_name: "",
  owner_name: "",
  phone: "",
  debt_amount: 0,
  note: "",
};

type SaveState = "idle" | "saving";

export function InventoryDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [filter, setFilter] = useState<"all" | ProductCategory>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ProductPayload>(defaultForm);
  const [debtForm, setDebtForm] = useState<StoreDebtPayload>(defaultDebtForm);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [debtSaveState, setDebtSaveState] = useState<SaveState>("idle");
  const [rowState, setRowState] = useState<Record<string, SaveState>>({});
  const [debtRowState, setDebtRowState] = useState<Record<string, SaveState>>({});

  useEffect(() => {
    void Promise.all([loadProducts(), loadStores()]);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = filter === "all" || product.category === filter;
      const haystack = [
        product.title,
        product.collection_name,
        product.model,
        product.color,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesCategory && haystack.includes(search.trim().toLowerCase());
    });
  }, [filter, products, search]);

  const stats = useMemo(() => {
    const totalStock = products.reduce((sum, item) => sum + Number(item.stock), 0);
    const debtSum = stores
      .filter((store) => store.is_active)
      .reduce((sum, store) => sum + Number(store.debt_amount), 0);

    return {
      total: products.length,
      materials: products.filter((item) => item.category === "material").length,
      accessories: products.filter((item) => item.category !== "material").length,
      totalStock,
      storesWithDebt: stores.filter((store) => store.is_active).length,
      debtSum,
    };
  }, [products, stores]);

  async function loadProducts() {
    const response = await fetch("/api/products");
    const data = (await response.json()) as Product[] | { error: string };

    if (!response.ok || !Array.isArray(data)) {
      showMessage("Не удалось загрузить товары", "error");
      setLoading(false);
      return;
    }

    setProducts(data);
    setLoading(false);
  }

  async function loadStores() {
    const response = await fetch("/api/stores");
    const data = (await response.json()) as StoreDebt[] | { error: string };

    if (!response.ok || !Array.isArray(data)) {
      showMessage("Не удалось загрузить долги магазинов", "error");
      return;
    }

    setStores(data);
  }

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  function changeCategory(category: ProductCategory) {
    setForm((current) => ({
      ...current,
      category,
      unit: allowedUnits(category)[0],
      collection_name: category === "material" ? current.collection_name ?? "" : "",
      model: category === "material" ? current.model ?? "" : "",
      color: category === "material" ? "" : current.color ?? "",
    }));
  }

  async function submitForm() {
    setSaveState("saving");
    setMessage("");

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = (await response.json()) as Product | { error: string };

    if (!response.ok || "error" in data) {
      showMessage("error" in data ? data.error : "Не удалось добавить товар", "error");
      setSaveState("idle");
      return;
    }

    setProducts((current) => [data, ...current]);
    setForm({
      ...defaultForm,
      category: form.category,
      unit: allowedUnits(form.category)[0],
    });
    showMessage("Товар успешно добавлен", "success");
    setSaveState("idle");
  }

  async function submitDebtForm() {
    setDebtSaveState("saving");
    const response = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(debtForm),
    });

    const data = (await response.json()) as StoreDebt | { error: string };
    if (!response.ok || "error" in data) {
      showMessage("error" in data ? data.error : "Не удалось добавить долг", "error");
      setDebtSaveState("idle");
      return;
    }

    setStores((current) => [data, ...current]);
    setDebtForm(defaultDebtForm);
    showMessage(`Магазин "${data.shop_name}" добавлен в долги`, "success");
    setDebtSaveState("idle");
  }

  async function updateProductRow(id: string, patch: Partial<Product>) {
    const target = products.find((item) => item.id === id);
    if (!target) return;

    setRowState((current) => ({ ...current, [id]: "saving" }));

    const response = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: target.category,
        price: patch.price ?? target.price,
        stock: patch.stock ?? target.stock,
        unit: patch.unit ?? target.unit,
        is_active: patch.is_active ?? target.is_active,
      }),
    });

    const data = (await response.json()) as Product | { error: string };

    if (!response.ok || "error" in data) {
      showMessage("error" in data ? data.error : "Не удалось обновить товар", "error");
      setRowState((current) => ({ ...current, [id]: "idle" }));
      return;
    }

    setProducts((current) => current.map((item) => (item.id === id ? data : item)));
    showMessage(`Позиция "${data.title}" обновлена`, "success");
    setRowState((current) => ({ ...current, [id]: "idle" }));
  }

  async function updateStoreRow(id: string, patch: Partial<StoreDebt>) {
    const target = stores.find((item) => item.id === id);
    if (!target) return;

    setDebtRowState((current) => ({ ...current, [id]: "saving" }));

    const response = await fetch(`/api/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_name: patch.shop_name ?? target.shop_name,
        owner_name: patch.owner_name ?? target.owner_name,
        phone: patch.phone ?? target.phone,
        debt_amount: patch.debt_amount ?? target.debt_amount,
        note: patch.note ?? target.note,
        is_active: patch.is_active ?? target.is_active,
      }),
    });

    const data = (await response.json()) as StoreDebt | { error: string };
    if (!response.ok || "error" in data) {
      showMessage("error" in data ? data.error : "Не удалось обновить долг", "error");
      setDebtRowState((current) => ({ ...current, [id]: "idle" }));
      return;
    }

    setStores((current) => current.map((item) => (item.id === id ? data : item)));
    showMessage(`Долг магазина "${data.shop_name}" обновлен`, "success");
    setDebtRowState((current) => ({ ...current, [id]: "idle" }));
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Supabase Warehouse</span>
        <h1>Умный склад для материалов и комплектующих</h1>
        <p>
          Теперь в системе есть больше воздуха между блоками и отдельный раздел
          по магазинам с долгами, чтобы вы видели не только остатки, но и
          задолженность клиентов.
        </p>
      </section>

      <section className="stats">
        <div className="stat-card">
          <div className="stat-label">Всего позиций</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Материалы</div>
          <div className="stat-value">{stats.materials}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Комплектующие</div>
          <div className="stat-value">{stats.accessories}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Общий остаток</div>
          <div className="stat-value">{stats.totalStock}</div>
        </div>
        <div className="stat-card danger-card">
          <div className="stat-label">Долги магазинов</div>
          <div className="stat-value danger-text">{stats.debtSum} c</div>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>Новая позиция</h2>
          <p>Создавайте материалы, профиль, заглушки и фиксаторы по вашим правилам.</p>

          <div className="form-grid">
            <div className="field">
              <label>Категория</label>
              <select
                value={form.category}
                onChange={(event) => changeCategory(event.target.value as ProductCategory)}
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {form.category === "material" ? (
              <>
                <div className="field">
                  <label>Название коллекции</label>
                  <input
                    value={form.collection_name ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, collection_name: event.target.value }))
                    }
                    placeholder="Например: Лиссабон"
                  />
                </div>
                <div className="field">
                  <label>Модель</label>
                  <input
                    value={form.model ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, model: event.target.value }))
                    }
                    placeholder="Например: 01"
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <label>Цвет</label>
                <input
                  value={form.color ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, color: event.target.value }))
                  }
                  placeholder="Например: антрацит"
                />
              </div>
            )}

            <div className="field-row">
              <div className="field">
                <label>Цена</label>
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, price: Number(event.target.value) }))
                  }
                />
              </div>
              <div className="field">
                <label>Единица</label>
                <select
                  value={form.unit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, unit: event.target.value as UnitType }))
                  }
                >
                  {allowedUnits(form.category).map((unit) => (
                    <option key={unit} value={unit}>
                      {unitLabels[unit]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Остаток</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stock: Number(event.target.value) }))
                }
              />
            </div>

            <div className="button-row">
              <button
                className="primary-btn"
                onClick={() => void submitForm()}
                disabled={saveState === "saving"}
              >
                {saveState === "saving" ? "Сохраняю..." : "Добавить товар"}
              </button>
              <button
                className="secondary-btn"
                onClick={() =>
                  setForm({
                    ...defaultForm,
                    category: form.category,
                    unit: allowedUnits(form.category)[0],
                  })
                }
                disabled={saveState === "saving"}
              >
                Очистить
              </button>
            </div>
          </div>
        </aside>

        <section className="panel">
          <div className="toolbar">
            <div>
              <h2>Позиции склада</h2>
              <p>Ячейки стали шире и отделены друг от друга, чтобы таблица читалась легче.</p>
            </div>
            <div className="toolbar-controls">
              <input
                className="search"
                placeholder="Поиск по названию, модели, цвету"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="chip-group">
            <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
              Все
            </button>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <button
                key={value}
                className={`chip ${filter === value ? "active" : ""}`}
                onClick={() => setFilter(value as ProductCategory)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={`message ${messageType}`}>{message}</div>

          {loading ? (
            <div className="empty-state">Загружаю товары...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">Ничего не найдено. Попробуйте другой фильтр или добавьте новую позицию.</div>
          ) : (
            <div className="table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th className="spacious-cell">Название</th>
                    <th>Категория</th>
                    <th>Цена</th>
                    <th>Единица</th>
                    <th>Остаток</th>
                    <th>Статус</th>
                    <th className="action-cell">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const saving = rowState[product.id] === "saving";
                    return (
                      <tr key={product.id}>
                        <td className="spacious-cell">
                          <div className="table-title">{product.title}</div>
                          <div className="subtle">
                            {product.category === "material"
                              ? `Коллекция: ${product.collection_name} · Модель: ${product.model}`
                              : `Цвет: ${product.color}`}
                          </div>
                        </td>
                        <td>{categoryLabels[product.category]}</td>
                        <td>
                          <input
                            className="inline-input"
                            type="number"
                            min="0"
                            value={product.price}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setProducts((current) =>
                                current.map((item) =>
                                  item.id === product.id ? { ...item, price: value } : item
                                )
                              );
                            }}
                          />
                        </td>
                        <td>
                          <select
                            className="inline-select"
                            value={product.unit}
                            onChange={(event) => {
                              const unit = event.target.value as UnitType;
                              setProducts((current) =>
                                current.map((item) =>
                                  item.id === product.id ? { ...item, unit } : item
                                )
                              );
                            }}
                          >
                            {allowedUnits(product.category).map((unit) => (
                              <option key={unit} value={unit}>
                                {unitLabels[unit]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="inline-input"
                            type="number"
                            min="0"
                            value={product.stock}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setProducts((current) =>
                                current.map((item) =>
                                  item.id === product.id ? { ...item, stock: value } : item
                                )
                              );
                            }}
                          />
                        </td>
                        <td>
                          <button
                            className={`chip ${product.is_active ? "active" : ""}`}
                            onClick={() => {
                              setProducts((current) =>
                                current.map((item) =>
                                  item.id === product.id
                                    ? { ...item, is_active: !item.is_active }
                                    : item
                                )
                              );
                            }}
                          >
                            {product.is_active ? "Активный" : "Скрыт"}
                          </button>
                        </td>
                        <td className="action-cell">
                          <button
                            className="primary-btn"
                            onClick={() => void updateProductRow(product.id, product)}
                            disabled={saving}
                          >
                            {saving ? "..." : "Сохранить"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <section className="debts-layout">
        <aside className="panel">
          <h2>Магазины с долгами</h2>
          <p>Добавляйте магазины, сумму долга, контакт и заметку по оплате.</p>

          <div className="form-grid">
            <div className="field">
              <label>Название магазина</label>
              <input
                value={debtForm.shop_name}
                onChange={(event) =>
                  setDebtForm((current) => ({ ...current, shop_name: event.target.value }))
                }
                placeholder="Например: Магазин Бишкек"
              />
            </div>
            <div className="field">
              <label>Ответственный</label>
              <input
                value={debtForm.owner_name ?? ""}
                onChange={(event) =>
                  setDebtForm((current) => ({ ...current, owner_name: event.target.value }))
                }
                placeholder="Имя клиента"
              />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input
                value={debtForm.phone ?? ""}
                onChange={(event) =>
                  setDebtForm((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="+996 ..."
              />
            </div>
            <div className="field">
              <label>Сумма долга</label>
              <input
                type="number"
                min="0"
                value={debtForm.debt_amount}
                onChange={(event) =>
                  setDebtForm((current) => ({
                    ...current,
                    debt_amount: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="field">
              <label>Заметка</label>
              <input
                value={debtForm.note ?? ""}
                onChange={(event) =>
                  setDebtForm((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="Когда обещали закрыть долг"
              />
            </div>

            <div className="button-row">
              <button
                className="primary-btn"
                onClick={() => void submitDebtForm()}
                disabled={debtSaveState === "saving"}
              >
                {debtSaveState === "saving" ? "Сохраняю..." : "Добавить долг"}
              </button>
            </div>
          </div>
        </aside>

        <section className="panel">
          <div className="toolbar">
            <div>
              <h2>Список должников</h2>
              <p>
                Активных магазинов с долгами: <strong>{stats.storesWithDebt}</strong>
              </p>
            </div>
            <span className="pill-note">Общий долг: {stats.debtSum} c</span>
          </div>

          {stores.length === 0 ? (
            <div className="empty-state">Пока нет магазинов с долгами.</div>
          ) : (
            <div className="form-grid">
              {stores.map((store) => {
                const saving = debtRowState[store.id] === "saving";
                return (
                  <div key={store.id} className="debt-card">
                    <div className="debt-header">
                      <div>
                        <div className="debt-title">{store.shop_name}</div>
                        <div className="debt-meta">
                          {store.owner_name || "Без ответственного"} · {store.phone || "Телефон не указан"}
                        </div>
                      </div>
                      <span className={`status-badge ${store.is_active ? "" : "inactive"}`}>
                        {store.is_active ? "Есть долг" : "Закрыт"}
                      </span>
                    </div>

                    <div className="field-row">
                      <div className="field">
                        <label>Сумма долга</label>
                        <input
                          type="number"
                          min="0"
                          value={store.debt_amount}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setStores((current) =>
                              current.map((item) =>
                                item.id === store.id ? { ...item, debt_amount: value } : item
                              )
                            );
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Телефон</label>
                        <input
                          value={store.phone ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setStores((current) =>
                              current.map((item) =>
                                item.id === store.id ? { ...item, phone: value } : item
                              )
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label>Заметка</label>
                      <input
                        value={store.note ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setStores((current) =>
                            current.map((item) =>
                              item.id === store.id ? { ...item, note: value } : item
                            )
                          );
                        }}
                      />
                    </div>

                    <div className="button-row">
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          setStores((current) =>
                            current.map((item) =>
                              item.id === store.id
                                ? { ...item, is_active: !item.is_active }
                                : item
                            )
                          );
                        }}
                      >
                        {store.is_active ? "Отметить как закрыт" : "Вернуть в долги"}
                      </button>
                      <button
                        className="primary-btn"
                        onClick={() => void updateStoreRow(store.id, store)}
                        disabled={saving}
                      >
                        {saving ? "..." : "Сохранить"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
