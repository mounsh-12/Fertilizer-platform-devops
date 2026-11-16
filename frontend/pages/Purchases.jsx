
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingCart, Truck, Clock, Search, Plus, X, Package,
  FileText, CheckCircle2, AlertCircle, CalendarDays, Trash2,
  RefreshCw,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  if (!date) return "—";

  const normalized = String(date).slice(0, 10);
  const parsed = new Date(`${normalized}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? normalized
    : parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const today = () => new Date().toISOString().slice(0, 10);

function getToken() {
  return (
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("Your login session was not found. Please log in again.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Your session has expired or is unauthorized. Please log in again."
      );
    }

    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data;
}

function PurchaseBadge() {
  return (
    <span className="rounded-full px-3 py-1 text-xs font-bold badge-success">
      Recorded
    </span>
  );
}

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [fertilizers, setFertilizers] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    supplier_id: "",
    supplier_invoice_number: "",
    purchase_date: today(),
    notes: "",
    items: [
      {
        fertilizer_id: "",
        quantity: "",
        purchase_price: "",
      },
    ],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [purchaseData, supplierData, fertilizerData] =
        await Promise.all([
          apiRequest("/api/stock-purchases"),
          apiRequest("/api/suppliers"),
          apiRequest("/api/fertilizers"),
        ]);

      setPurchases(
        (purchaseData.purchases || []).map((purchase) => ({
          id: purchase.purchase_id,
          invoice:
            purchase.supplier_invoice_number ||
            `PUR-${purchase.purchase_id}`,
          supplier:
            purchase.company_name ||
            purchase.supplier_name ||
            "Unknown supplier",
          supplierName: purchase.supplier_name || "Unknown supplier",
          products: purchase.products || "—",
          quantity: Number(purchase.total_quantity || 0),
          itemCount: Number(purchase.item_count || 0),
          total: Number(purchase.total_amount || 0),
          date: purchase.purchase_date,
          notes: purchase.notes || "",
        }))
      );

      setSuppliers(
        (supplierData.suppliers || []).filter((supplier) =>
          Boolean(supplier.is_active)
        )
      );

      setFertilizers(
        (fertilizerData.fertilizers || []).filter((fertilizer) =>
          Boolean(fertilizer.is_active)
        )
      );
    } catch (loadError) {
      setError(
        loadError.message || "Unable to load purchase information."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPurchases = purchases.reduce(
    (sum, purchase) => sum + purchase.total,
    0
  );

  const totalQuantity = purchases.reduce(
    (sum, purchase) => sum + purchase.quantity,
    0
  );

  const totalRecords = purchases.length;

  const averagePurchase = totalRecords
    ? totalPurchases / totalRecords
    : 0;

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((purchase) =>
        [
          purchase.invoice,
          purchase.supplier,
          purchase.supplierName,
          purchase.products,
          purchase.notes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [purchases, search]
  );

  const purchaseTotal = form.items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.purchase_price || 0);

    return (
      sum +
      (Number.isFinite(quantity * price) ? quantity * price : 0)
    );
  }, 0);

  const resetForm = () =>
    setForm({
      supplier_id: "",
      supplier_invoice_number: "",
      purchase_date: today(),
      notes: "",
      items: [
        {
          fertilizer_id: "",
          quantity: "",
          purchase_price: "",
        },
      ],
    });

  const updateItem = (index, field, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "fertilizer_id") {
          const selected = fertilizers.find(
            (fertilizer) =>
              String(fertilizer.fertilizer_id) === value
          );

          return {
            ...item,
            fertilizer_id: value,
            purchase_price: selected
              ? String(selected.purchase_price)
              : item.purchase_price,
          };
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    }));
  };

  const addItem = () =>
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          fertilizer_id: "",
          quantity: "",
          purchase_price: "",
        },
      ],
    }));

  const removeItem = (index) =>
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter(
              (_, itemIndex) => itemIndex !== index
            ),
    }));

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!form.supplier_id) {
      setError("Please select a supplier.");
      return;
    }

    const seen = new Set();
    const items = [];

    for (const item of form.items) {
      const fertilizerId = Number(item.fertilizer_id);
      const quantity = Number(item.quantity);
      const price = Number(item.purchase_price);

      if (
        !Number.isInteger(fertilizerId) ||
        fertilizerId <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        setError(
          "Select a fertilizer and enter a positive whole-number quantity and a valid purchase price for every item."
        );
        return;
      }

      if (seen.has(fertilizerId)) {
        setError(
          "Each fertilizer can be added only once. Combine quantities for duplicate products."
        );
        return;
      }

      seen.add(fertilizerId);

      items.push({
        fertilizer_id: fertilizerId,
        quantity,
        purchase_price: price,
      });
    }

    setSaving(true);

    try {
      const result = await apiRequest("/api/stock-purchases", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: Number(form.supplier_id),
          supplier_invoice_number:
            form.supplier_invoice_number.trim() || null,
          purchase_date: form.purchase_date,
          notes: form.notes.trim() || null,
          items,
        }),
      });

      setNotice(
        result.message ||
          "Purchase recorded and inventory updated."
      );

      setShowModal(false);
      resetForm();

      await loadData();
    } catch (submitError) {
      setError(
        submitError.message || "Unable to save purchase."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-7">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <ShoppingCart size={17} />
            BUSINESS MANAGEMENT
          </div>

          <h1 className="text-2xl font-bold text-[#302b50] md:text-3xl">
            Purchase Management
          </h1>

          <p className="mt-2 text-sm text-[#89869e]">
            Manage supplier purchases, invoices and incoming fertilizer stock.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          <button
            onClick={() => {
              setError("");
              setNotice("");
              setShowModal(true);
            }}
            className="btn-primary"
          >
            <Plus size={18} />
            Record Purchase
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-purple-100 p-3 text-purple-600">
            <ShoppingCart size={24} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Total Purchases</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(totalPurchases)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              {totalRecords} purchase records
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <CheckCircle2 size={24} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Average Purchase</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(averagePurchase)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Per purchase record
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <Clock size={24} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Purchase Records</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {totalRecords}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Saved in MySQL
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
            <Package size={24} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Purchased Quantity</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {totalQuantity}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Total bags purchased
            </p>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Purchase History
            </h2>
            <p className="mt-1 text-sm text-[#89869e]">
              Purchase records retrieved from your database.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-purple-100 bg-white/80 px-4 py-3">
              <Search size={18} className="text-purple-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoice, supplier or product..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa5bd]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead>
              <tr className="border-y border-purple-100 bg-purple-50/50 text-xs uppercase tracking-wider text-[#9691a8]">
                <th className="px-6 py-4 font-semibold">Supplier Invoice</th>
                <th className="px-6 py-4 font-semibold">Supplier</th>
                <th className="px-6 py-4 font-semibold">Fertilizers</th>
                <th className="px-6 py-4 font-semibold">Quantity</th>
                <th className="px-6 py-4 font-semibold">Items</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredPurchases.map((purchase) => (
                <tr
                  key={purchase.id}
                  className="border-b border-purple-50 text-sm transition hover:bg-white/60"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-bold text-purple-700">
                      <FileText size={17} />
                      {purchase.invoice}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[#625d7b]">
                      <Truck size={16} className="text-[#aaa5bd]" />
                      {purchase.supplier}
                    </div>
                  </td>

                  <td className="max-w-[260px] px-6 py-4 text-[#625d7b]">
                    {purchase.products}
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {purchase.quantity} bags
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {purchase.itemCount}
                  </td>

                  <td className="px-6 py-4 font-bold text-[#39364f]">
                    {formatCurrency(purchase.total)}
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {formatDate(purchase.date)}
                  </td>

                  <td className="px-6 py-4">
                    <PurchaseBadge />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="p-10 text-center text-sm text-[#89869e]">
            Loading purchase records...
          </div>
        )}

        {!loading && filteredPurchases.length === 0 && (
          <div className="p-12 text-center">
            <ShoppingCart
              size={35}
              className="mx-auto text-purple-300"
            />

            <p className="mt-3 font-bold text-[#302b50]">
              No purchases found
            </p>

            <p className="mt-1 text-sm text-[#89869e]">
              Your saved purchase records will appear here.
            </p>
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">
          <div className="glass-panel my-auto w-full max-w-3xl p-6 md:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#302b50]">
                  Record New Purchase
                </h2>

                <p className="mt-1 text-sm text-[#89869e]">
                  Add supplier invoice and one or more fertilizer items.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
                className="rounded-xl bg-purple-50 p-2 text-purple-600"
              >
                <X size={19} />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Supplier
                  </label>

                  <select
                    required
                    value={form.supplier_id}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        supplier_id: event.target.value,
                      })
                    }
                    className="glass-input"
                  >
                    <option value="">Select supplier</option>

                    {suppliers.map((supplier) => (
                      <option
                        key={supplier.supplier_id}
                        value={supplier.supplier_id}
                      >
                        {supplier.company_name || supplier.supplier_name}
                      </option>
                    ))}
                  </select>

                  {suppliers.length === 0 && (
                    <p className="mt-1 text-xs text-orange-600">
                      No active suppliers found. Add a supplier first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Supplier Invoice Number
                  </label>

                  <input
                    maxLength={100}
                    value={form.supplier_invoice_number}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        supplier_invoice_number: event.target.value,
                      })
                    }
                    placeholder="Supplier invoice reference"
                    className="glass-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Purchase Date
                  </label>

                  <input
                    required
                    type="date"
                    value={form.purchase_date}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        purchase_date: event.target.value,
                      })
                    }
                    className="glass-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Notes
                  </label>

                  <input
                    value={form.notes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        notes: event.target.value,
                      })
                    }
                    placeholder="Optional purchase notes"
                    className="glass-input"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#302b50]">
                    Fertilizer Items
                  </h3>

                  <button
                    type="button"
                    onClick={addItem}
                    className="btn-secondary"
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>

                {form.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border border-purple-100 bg-white/60 p-4 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] sm:items-end"
                  >
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#625d7b]">
                        Fertilizer
                      </label>

                      <select
                        required
                        value={item.fertilizer_id}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "fertilizer_id",
                            event.target.value
                          )
                        }
                        className="glass-input"
                      >
                        <option value="">Select fertilizer</option>

                        {fertilizers.map((fertilizer) => (
                          <option
                            key={fertilizer.fertilizer_id}
                            value={fertilizer.fertilizer_id}
                          >
                            {fertilizer.fertilizer_name} —{" "}
                            {fertilizer.brand_name} (
                            {fertilizer.bag_size_kg} kg)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#625d7b]">
                        Quantity (Bags)
                      </label>

                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "quantity",
                            event.target.value
                          )
                        }
                        placeholder="Bags"
                        className="glass-input"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#625d7b]">
                        Price per Bag (₹)
                      </label>

                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.purchase_price}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "purchase_price",
                            event.target.value
                          )
                        }
                        placeholder="Price"
                        className="glass-input"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={form.items.length === 1}
                      aria-label="Remove item"
                      className="rounded-xl p-3 text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}

                {fertilizers.length === 0 && (
                  <p className="text-sm text-orange-600">
                    No active fertilizers found. Add a fertilizer first.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50 to-emerald-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#77758d]">
                      Purchase Total
                    </p>

                    <p className="mt-1 text-xs text-[#9994ac]">
                      Calculated from all item quantities and prices
                    </p>
                  </div>

                  <p className="text-2xl font-extrabold text-[#302b50]">
                    {formatCurrency(purchaseTotal)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={
                    saving ||
                    suppliers.length === 0 ||
                    fertilizers.length === 0
                  }
                >
                  {saving ? (
                    "Saving Purchase..."
                  ) : (
                    <>
                      <Plus size={17} />
                      Save Purchase
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
