
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Package,
  Boxes,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  Warehouse,
  IndianRupee,
} from "lucide-react";

const formatCurrency = (amount) =>
  `₹${Number(amount).toLocaleString("en-IN")}`;

function StockStatus({ product }) {
  if (product.quantity === 0) {
    return (
      <span className="badge-danger rounded-full px-3 py-1 text-xs font-bold">
        Out of stock
      </span>
    );
  }

  if (product.quantity <= product.minimumStock) {
    return (
      <span className="badge-warning rounded-full px-3 py-1 text-xs font-bold">
        Low stock
      </span>
    );
  }

  return (
    <span className="badge-success rounded-full px-3 py-1 text-xs font-bold">
      Available
    </span>
  );
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function getAdminToken() {
  return (
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function apiRequest(path, options = {}) {
  const token = getAdminToken();
  if (!token) {
    throw new Error("Your session has expired. Please log in again.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }
  return data;
}

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const mapInventoryItem = (item, fertilizer = {}) => ({
  id: toNumber(item.fertilizer_id),
  name: item.fertilizer_name || fertilizer.fertilizer_name || "Unknown fertilizer",
  brand: item.brand_name || fertilizer.brand_name || "—",
  size: `${item.bag_size_kg ?? fertilizer.bag_size_kg ?? "—"} kg`,
  quantity: toNumber(item.available_quantity),
  minimumStock: toNumber(item.reorder_level),
  purchasePrice: toNumber(fertilizer.purchase_price),
  sellingPrice: toNumber(fertilizer.selling_price),
  unit: "bags",
});

const mapMovement = (movement, productName) => ({
  id: movement.movement_id,
  product: productName,
  type:
    movement.movement_type === "PURCHASE" ||
    (movement.movement_type === "ADJUSTMENT" &&
      toNumber(movement.new_quantity) > toNumber(movement.previous_quantity))
      ? "Stock In"
      : movement.movement_type === "SALE" ||
          (movement.movement_type === "ADJUSTMENT" &&
            toNumber(movement.new_quantity) < toNumber(movement.previous_quantity))
        ? "Stock Out"
        : movement.movement_type || "Adjustment",
  quantity: toNumber(movement.quantity),
  date: movement.created_at
    ? new Date(movement.created_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Date unavailable",
  note: movement.notes || movement.movement_type || "Stock movement",
});

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementType, setMovementType] = useState("Stock In");
  const [form, setForm] = useState({ productId: "", quantity: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadInventory = async () => {
    setLoading(true);
    setError("");
    try {
      const [inventoryData, fertilizerData] = await Promise.all([
        apiRequest("/api/inventory"),
        apiRequest("/api/fertilizers"),
      ]);

      const fertilizerRows = fertilizerData.fertilizers || [];
      const fertilizerById = new Map(
        fertilizerRows.map((item) => [toNumber(item.fertilizer_id), item])
      );
      const inventoryRows = (inventoryData.inventory || []).map((item) =>
        mapInventoryItem(item, fertilizerById.get(toNumber(item.fertilizer_id)))
      );
      setInventory(inventoryRows);

      const movementResults = await Promise.all(
        inventoryRows.map(async (product) => {
          try {
            const result = await apiRequest(`/api/inventory/${product.id}/movements`);
            return (result.movements || []).map((movement) =>
              mapMovement(movement, product.name)
            );
          } catch (movementError) {
            console.error(`Could not load movements for ${product.name}:`, movementError);
            return [];
          }
        })
      );
      setMovements(
        movementResults
          .flat()
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 20)
      );
    } catch (loadError) {
      setError(loadError.message || "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const totalQuantity = inventory.reduce((sum, product) => sum + product.quantity, 0);
  const totalValue = inventory.reduce(
    (sum, product) => sum + product.quantity * product.purchasePrice,
    0
  );
  const lowStockCount = inventory.filter(
    (product) => product.quantity > 0 && product.quantity <= product.minimumStock
  ).length;
  const outOfStockCount = inventory.filter((product) => product.quantity === 0).length;

  const filteredInventory = useMemo(() => {
    return inventory.filter((product) => {
      const matchesSearch = `${product.name} ${product.brand}`
        .toLowerCase()
        .includes(search.toLowerCase());
      let matchesFilter = true;
      if (filter === "Available") {
        matchesFilter = product.quantity > product.minimumStock;
      }
      if (filter === "Low Stock") {
        matchesFilter =
          product.quantity > 0 && product.quantity <= product.minimumStock;
      }
      if (filter === "Out of Stock") {
        matchesFilter = product.quantity === 0;
      }
      return matchesSearch && matchesFilter;
    });
  }, [inventory, search, filter]);

  const openMovementForm = (type) => {
    setMovementType(type);
    setForm({ productId: "", quantity: "", note: "" });
    setError("");
    setNotice("");
    setShowMovementForm(true);
  };

  const handleMovement = async (event) => {
    event.preventDefault();
    const productId = Number(form.productId);
    const quantity = Number(form.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      setError("Select a product and enter a valid positive quantity.");
      return;
    }
    if (!form.note.trim()) {
      setError("Please enter a reason for this stock adjustment.");
      return;
    }

    const selectedProduct = inventory.find((product) => product.id === productId);
    if (!selectedProduct) return;
    if (movementType === "Stock Out" && quantity > selectedProduct.quantity) {
      setError("Insufficient stock. Please enter a smaller quantity.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/inventory/${productId}/adjust`, {
        method: "PATCH",
        body: JSON.stringify({
          adjustment_quantity: movementType === "Stock In" ? quantity : -quantity,
          notes: form.note.trim(),
        }),
      });
      setShowMovementForm(false);
      setNotice(`${movementType} recorded successfully.`);
      await loadInventory();
    } catch (saveError) {
      setError(saveError.message || "Unable to save stock movement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-7">

      {/* PAGE HEADER */}

      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <Warehouse size={17} />
            BUSINESS MANAGEMENT
          </div>

          <h1 className="text-2xl font-bold text-[#302b50] md:text-3xl">
            Inventory Management
          </h1>

          <p className="mt-2 text-sm text-[#89869e]">
            Monitor fertilizer stock, stock movements and inventory value.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => openMovementForm("Stock Out")}
            className="btn-secondary"
          >
            <Minus size={17} />
            Stock Out
          </button>

          <button
            onClick={() => openMovementForm("Stock In")}
            className="btn-primary"
          >
            <Plus size={18} />
            Stock In
          </button>
        </div>
      </section>

      {(error || notice) && (
        <div
          role="alert"
          className={`rounded-xl border p-4 text-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || notice}
        </div>
      )}

      {/* INVENTORY SUMMARY */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-purple-100 p-3 text-purple-600">
            <Boxes size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Total Stock</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {totalQuantity}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">Bags available</p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <IndianRupee size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Stock Value</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(totalValue)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">Purchase value</p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <AlertTriangle size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Low Stock</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {lowStockCount}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">Products to reorder</p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-rose-100 p-3 text-rose-600">
            <Package size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Out of Stock</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {outOfStockCount}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">Unavailable products</p>
          </div>
        </div>

      </section>

      {/* STOCK ALERTS */}

      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-rose-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-orange-100 p-3 text-orange-600">
              <AlertTriangle size={22} />
            </div>

            <div className="flex-1">
              <h2 className="font-bold text-[#a45b26]">
                Inventory Attention Required
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#98745d]">
                {lowStockCount} product(s) have low stock and{" "}
                {outOfStockCount} product(s) are out of stock.
                Review your inventory and arrange replenishment.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* INVENTORY TABLE */}

      <section className="glass-card overflow-hidden">

        <div className="flex flex-col gap-4 p-5 md:p-6">

          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Stock Overview
            </h2>

            <p className="mt-1 text-sm text-[#89869e]">
              Current product-wise stock information
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">

            <div className="flex flex-1 items-center gap-3 rounded-xl border border-purple-100 bg-white/80 px-4 py-3">
              <Search size={18} className="text-purple-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search fertilizer or brand..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa5bd]"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="glass-input md:max-w-48"
            >
              <option>All</option>
              <option>Available</option>
              <option>Low Stock</option>
              <option>Out of Stock</option>
            </select>

          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">

            <thead>
              <tr className="border-y border-purple-100 bg-purple-50/50 text-xs uppercase tracking-wider text-[#9691a8]">
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">Brand</th>
                <th className="px-6 py-4 font-semibold">Stock</th>
                <th className="px-6 py-4 font-semibold">Minimum Stock</th>
                <th className="px-6 py-4 font-semibold">Purchase Price</th>
                <th className="px-6 py-4 font-semibold">Stock Value</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#89869e]">
                    Loading inventory from database...
                  </td>
                </tr>
              ) : filteredInventory.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-purple-50 text-sm transition hover:bg-white/60"
                >

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                        <Package size={19} />
                      </div>

                      <div>
                        <p className="font-bold text-[#39364f]">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-[#9994ac]">
                          {product.size}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {product.brand}
                  </td>

                  <td className="px-6 py-4">
                    <span className="font-bold text-[#39364f]">
                      {product.quantity}
                    </span>

                    <span className="ml-1 text-xs text-[#9994ac]">
                      {product.unit}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {product.minimumStock} {product.unit}
                  </td>

                  <td className="px-6 py-4 font-medium text-[#39364f]">
                    {formatCurrency(product.purchasePrice)}
                  </td>

                  <td className="px-6 py-4 font-bold text-[#39364f]">
                    {formatCurrency(
                      product.quantity * product.purchasePrice
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <StockStatus product={product} />
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>

        {!loading && filteredInventory.length === 0 && (
          <div className="p-12 text-center">
            <Package size={35} className="mx-auto text-purple-300" />

            <p className="mt-3 font-bold text-[#302b50]">
              No inventory found
            </p>

            <p className="mt-1 text-sm text-[#89869e]">
              Try changing your search or filter.
            </p>
          </div>
        )}

      </section>

      {/* STOCK MOVEMENT HISTORY */}

      <section className="glass-card p-5 md:p-6">

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
            <History size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Stock Movement History
            </h2>

            <p className="mt-1 text-sm text-[#89869e]">
              Recent inventory changes
            </p>
          </div>
        </div>

        <div className="space-y-4">

          {movements.map((movement) => (
            <div
              key={movement.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-100 bg-white/60 p-4"
            >

              <div className="flex items-center gap-3">
                <div
                  className={`rounded-xl p-3 ${
                    movement.type === "Stock In"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-orange-100 text-orange-600"
                  }`}
                >
                  {movement.type === "Stock In" ? (
                    <ArrowDownToLine size={20} />
                  ) : (
                    <ArrowUpFromLine size={20} />
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-[#39364f]">
                    {movement.product}
                  </h3>

                  <p className="mt-1 text-xs text-[#89869e]">
                    {movement.note}
                  </p>

                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[#aaa5bd]">
                    <History size={12} />
                    {movement.date}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p
                  className={`text-lg font-bold ${
                    movement.type === "Stock In"
                      ? "text-emerald-600"
                      : "text-orange-600"
                  }`}
                >
                  {movement.type === "Stock In" ? "+" : "-"}
                  {movement.quantity}
                </p>

                <p className="text-xs text-[#9994ac]">
                  {movement.type}
                </p>
              </div>

            </div>
          ))}

          {movements.length === 0 && (
            <p className="py-8 text-center text-sm text-[#89869e]">
              No stock movements recorded yet.
            </p>
          )}

        </div>

      </section>

      {/* STOCK MOVEMENT MODAL */}

      {showMovementForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">

          <div className="glass-panel my-auto w-full max-w-lg p-6 md:p-7">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#302b50]">
                  {movementType}
                </h2>

                <p className="mt-1 text-sm text-[#89869e]">
                  Record an inventory stock movement.
                </p>
              </div>

              <button
                onClick={() => setShowMovementForm(false)}
                aria-label="Close form"
                className="rounded-xl bg-purple-50 p-2 text-purple-600"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleMovement} className="space-y-4">
              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Movement Type
                </label>

                <select
                  value={movementType}
                  onChange={(event) => setMovementType(event.target.value)}
                  className="glass-input"
                >
                  <option>Stock In</option>
                  <option>Stock Out</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Select Fertilizer
                </label>

                <select
                  required
                  value={form.productId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      productId: event.target.value,
                    })
                  }
                  className="glass-input"
                >
                  <option value="">Choose a product</option>

                  {inventory.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — {product.quantity} {product.unit} available
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Quantity (Bags)
                </label>

                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      quantity: event.target.value,
                    })
                  }
                  placeholder="Enter quantity"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Notes
                </label>

                <input
                  value={form.note}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      note: event.target.value,
                    })
                  }
                  placeholder="Purchase, sale or adjustment reason"
                  className="glass-input"
                />
              </div>

              <div className="flex gap-3 pt-3">

                <button
                  type="button"
                  onClick={() => setShowMovementForm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {movementType === "Stock In" ? (
                    <TrendingUp size={17} />
                  ) : (
                    <TrendingDown size={17} />
                  )}

                  {saving ? "Saving..." : `Confirm ${movementType}`}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
