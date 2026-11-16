
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Package,
  Pencil,
  Trash2,
  Filter,
  Boxes,
  AlertTriangle,
  X,
  Sprout,
  RefreshCw,
} from "lucide-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5001"
).replace(/\/$/, "");

const categories = [
  "All",
  "Nitrogen",
  "Phosphorus",
  "Potassium",
  "Complex",
];

const gradients = [
  "from-emerald-400 to-green-600",
  "from-purple-400 to-violet-600",
  "from-orange-400 to-amber-600",
  "from-blue-400 to-cyan-600",
  "from-pink-400 to-rose-600",
  "from-indigo-400 to-blue-600",
];

const emojis = ["🌱", "🌾", "🌿", "🌻", "🌺", "🍃"];

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("authToken")
  );
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Admin authentication token not found. Please log in again."
    );
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      data.message || "Your session has expired. Please log in again."
    );
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function mapProduct(item, index) {
  return {
    id: item.fertilizer_id,
    name: item.fertilizer_name,
    brand: item.brand_name,
    category: item.fertilizer_type || "Complex",
    size: `${item.bag_size_kg} kg`,
    purchasePrice: Number(item.purchase_price || 0),
    sellingPrice: Number(item.selling_price || 0),
    stock: Number(item.available_quantity || 0),
    isActive: Boolean(item.is_active),
    color: gradients[index % gradients.length],
    emoji: emojis[index % emojis.length],
  };
}

function StockBadge({ stock }) {
  if (stock === 0) {
    return (
      <span className="badge-danger rounded-full px-3 py-1 text-xs font-bold">
        Out of stock
      </span>
    );
  }

  if (stock <= 10) {
    return (
      <span className="badge-warning rounded-full px-3 py-1 text-xs font-bold">
        Low stock
      </span>
    );
  }

  return (
    <span className="badge-success rounded-full px-3 py-1 text-xs font-bold">
      In stock
    </span>
  );
}

export default function Fertilizers() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emptyForm = {
    name: "",
    brand: "",
    category: "Nitrogen",
    size: "",
    purchasePrice: "",
    sellingPrice: "",
    stock: "",
  };

  const [form, setForm] = useState(emptyForm);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/api/fertilizers");

      const mappedProducts = (data.fertilizers || [])
        .map(mapProduct)
        .filter((product) => product.isActive);

      setProducts(mappedProducts);
    } catch (err) {
      setError(err.message || "Unable to load fertilizers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        `${product.name} ${product.brand}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesCategory =
        category === "All" || product.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const totalStock = products.reduce(
    (total, product) => total + product.stock,
    0
  );

  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= 10
  ).length;

  const outOfStock = products.filter(
    (product) => product.stock === 0
  ).length;

  const openAddForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);

    setForm({
      name: product.name,
      brand: product.brand,
      category: product.category,
      size: product.size.replace(" kg", ""),
      purchasePrice: String(product.purchasePrice),
      sellingPrice: String(product.sellingPrice),
      stock: String(product.stock),
    });

    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    const productData = {
      fertilizer_name: form.name.trim(),
      brand_name: form.brand.trim(),
      fertilizer_type: form.category,
      bag_size_kg: Number(form.size),
      purchase_price: Number(form.purchasePrice),
      selling_price: Number(form.sellingPrice),
    };

    try {
      if (editingProduct) {
        await apiRequest(
          `/api/fertilizers/${editingProduct.id}`,
          {
            method: "PUT",
            body: JSON.stringify(productData),
          }
        );

        setSuccess("Fertilizer updated successfully.");
      } else {
        await apiRequest("/api/fertilizers", {
          method: "POST",
          body: JSON.stringify({
            ...productData,
            initial_quantity: Number(form.stock),
          }),
        });

        setSuccess("Fertilizer added successfully.");
      }

      setShowForm(false);
      setForm(emptyForm);

      await loadProducts();
    } catch (err) {
      setError(err.message || "Unable to save fertilizer.");
    } finally {
      setSaving(false);
    }
  };

  const deactivateProduct = async (product) => {
    const confirmed = window.confirm(
      `Deactivate ${product.name}? It will no longer appear in the active catalogue.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/api/fertilizers/${product.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_active: false,
          }),
        }
      );

      setSuccess(`${product.name} deactivated successfully.`);
      await loadProducts();
    } catch (err) {
      setError(err.message || "Unable to deactivate fertilizer.");
    }
  };

  return (
    <div className="animate-fade-in space-y-7">

      {/* PAGE HEADER */}
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <Sprout size={17} />
            BUSINESS MANAGEMENT
          </div>

          <h1 className="text-2xl font-bold text-[#302b50] md:text-3xl">
            Fertilizer Catalogue
          </h1>

          <p className="mt-2 text-sm text-[#89869e]">
            Manage your fertilizer products, prices and stock levels.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadProducts}
            disabled={loading}
            className="btn-secondary"
            title="Refresh fertilizers"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
          </button>

          <button onClick={openAddForm} className="btn-primary">
            <Plus size={18} />
            Add Fertilizer
          </button>
        </div>
      </section>

      {/* STATUS MESSAGES */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* SUMMARY CARDS */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-purple-100 p-3 text-purple-600">
            <Package size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Total Products</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {loading ? "..." : products.length}
            </h2>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <Boxes size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Total Stock</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {loading ? "..." : totalStock}
            </h2>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <AlertTriangle size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Stock Alerts</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {loading ? "..." : lowStock + outOfStock}
            </h2>
          </div>
        </div>

      </section>

      {/* SEARCH AND FILTERS */}
      <section className="glass-card space-y-4 p-5">

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-purple-100 bg-white/80 px-4 py-3">
            <Search size={19} className="text-purple-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by fertilizer or brand..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa5bd]"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-[#89869e]">
            <Filter size={17} />
            Filter category
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                category === item
                  ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md shadow-purple-200"
                  : "border border-purple-100 bg-white/70 text-[#77758d] hover:bg-purple-50"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

      </section>

      {/* PRODUCT GRID */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Available Fertilizers
            </h2>

            <p className="mt-1 text-sm text-[#89869e]">
              Showing {filteredProducts.length} products
            </p>
          </div>
        </div>

        {loading ? (
          <div className="glass-card p-12 text-center text-sm text-[#89869e]">
            Loading fertilizers from database...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">

            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="glass-card overflow-hidden transition duration-300 hover:-translate-y-1"
              >

                <div
                  className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${product.color}`}
                >
                  <div className="absolute inset-0 bg-white/10" />

                  <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/30 bg-white/20 text-5xl shadow-xl backdrop-blur-md">
                    {product.emoji}
                  </div>

                  <div className="absolute right-4 top-4">
                    <StockBadge stock={product.stock} />
                  </div>
                </div>

                <div className="p-5">

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#302b50]">
                        {product.name}
                      </h3>

                      <p className="mt-1 text-xs text-[#89869e]">
                        {product.brand} · {product.size}
                      </p>
                    </div>

                    <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-700">
                      {product.category}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">

                    <div className="rounded-xl bg-purple-50/80 p-3">
                      <p className="text-[11px] text-[#89869e]">
                        Purchase Price
                      </p>

                      <p className="mt-1 font-bold text-[#39364f]">
                        {formatCurrency(product.purchasePrice)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50/80 p-3">
                      <p className="text-[11px] text-[#89869e]">
                        Selling Price
                      </p>

                      <p className="mt-1 font-bold text-emerald-700">
                        {formatCurrency(product.sellingPrice)}
                      </p>
                    </div>

                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-purple-100 pt-4">
                    <div>
                      <p className="text-xs text-[#89869e]">
                        Available Quantity
                      </p>

                      <p className="mt-1 text-lg font-bold text-[#302b50]">
                        {product.stock}{" "}
                        <span className="text-xs font-medium text-[#89869e]">
                          bags
                        </span>
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditForm(product)}
                        aria-label={`Edit ${product.name}`}
                        className="rounded-xl bg-purple-50 p-2.5 text-purple-600 transition hover:bg-purple-100"
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        onClick={() => deactivateProduct(product)}
                        aria-label={`Deactivate ${product.name}`}
                        title="Deactivate fertilizer"
                        className="rounded-xl bg-rose-50 p-2.5 text-rose-500 transition hover:bg-rose-100"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            ))}

          </div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
            <Package size={38} className="text-purple-300" />

            <h3 className="mt-4 font-bold text-[#302b50]">
              No fertilizers found
            </h3>

            <p className="mt-2 text-sm text-[#89869e]">
              Try changing your search or category filter.
            </p>
          </div>
        )}
      </section>

      {/* ADD / EDIT PRODUCT MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">

          <div className="glass-panel my-auto w-full max-w-lg p-6 md:p-7">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#302b50]">
                  {editingProduct ? "Edit Fertilizer" : "Add Fertilizer"}
                </h2>

                <p className="mt-1 text-sm text-[#89869e]">
                  Enter the product information below.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl bg-purple-50 p-2 text-purple-600"
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Fertilizer Name
                </label>

                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Enter fertilizer name"
                  className="glass-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Brand
                  </label>

                  <input
                    required
                    value={form.brand}
                    onChange={(event) =>
                      setForm({ ...form, brand: event.target.value })
                    }
                    placeholder="Brand name"
                    className="glass-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Package Size (kg)
                  </label>

                  <input
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={form.size}
                    onChange={(event) =>
                      setForm({ ...form, size: event.target.value })
                    }
                    placeholder="Example: 50"
                    className="glass-input"
                  />
                </div>

              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Category
                </label>

                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  className="glass-input"
                >
                  {categories
                    .filter((item) => item !== "All")
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Purchase Price (₹)
                  </label>

                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.purchasePrice}
                    onChange={(event) =>
                      setForm({ ...form, purchasePrice: event.target.value })
                    }
                    placeholder="0"
                    className="glass-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Selling Price (₹)
                  </label>

                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.sellingPrice}
                    onChange={(event) =>
                      setForm({ ...form, sellingPrice: event.target.value })
                    }
                    placeholder="0"
                    className="glass-input"
                  />
                </div>

              </div>

              {!editingProduct && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Initial Stock (Bags)
                  </label>

                  <input
                    required
                    min="0"
                    step="1"
                    type="number"
                    value={form.stock}
                    onChange={(event) =>
                      setForm({ ...form, stock: event.target.value })
                    }
                    placeholder="Enter initial quantity"
                    className="glass-input"
                  />
                </div>
              )}

              {editingProduct && (
                <p className="rounded-xl bg-purple-50 p-3 text-xs text-[#77758d]">
                  Stock is managed through Inventory and Purchases. Edit the
                  product details here; use those modules to change stock.
                </p>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-3">

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={saving}
                >
                  {saving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Plus size={17} />
                      {editingProduct ? "Save Changes" : "Add Product"}
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
