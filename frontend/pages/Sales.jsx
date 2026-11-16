
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingBag,
  IndianRupee,
  TrendingUp,
  Search,
  Plus,
  X,
  Phone,
  Package,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trash2,
  Users,
  AlertCircle,
} from "lucide-react";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5001"
).replace(/\/$/, "");

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function getToken() {
  return (
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken")
  );
}

function normalizeFarmer(farmer) {
  return {
    id: Number(farmer.farmer_id),
    name: farmer.farmer_name || "",
    phone: farmer.mobile_number || "",
    village: farmer.village || "",
    active: Number(farmer.is_active) === 1,
  };
}

function normalizeProduct(product) {
  return {
    id: Number(product.fertilizer_id),
    name: product.fertilizer_name || "",
    brand: product.brand_name || "",
    size: Number(product.bag_size_kg || 0),
    price: Number(product.selling_price || 0),
    stock: Number(product.available_quantity || 0),
    active: Number(product.is_active) === 1,
  };
}

function normalizeSale(sale) {
  const items = (sale.items || []).map((item) => ({
    id: Number(item.fertilizer_id),
    name: item.fertilizer_name || "Fertilizer",
    quantity: Number(item.quantity || 0),
    price: Number(item.selling_price || 0),
    subtotal: Number(item.subtotal || 0),
  }));

  const total = Number(sale.total_amount || 0);
  const paid = Number(sale.amount_paid || 0);
  const outstanding = Math.max(
    0,
    Number(sale.outstanding_amount ?? total - paid)
  );

  const status =
    sale.sale_status === "CANCELLED"
      ? "Cancelled"
      : outstanding <= 0
        ? "Paid"
        : paid > 0
          ? "Partially Paid"
          : "Pending";

  const paymentMethods = [
    ...new Set(
      (sale.payments || []).map((payment) =>
        String(payment.payment_method || "").replaceAll("_", " ")
      )
    ),
  ];

  return {
    id: Number(sale.sale_id),
    invoice: sale.invoice_number || "",
    farmer: sale.farmer_name || "",
    phone: sale.mobile_number || "",
    items,
    total,
    subtotal: Number(sale.subtotal || 0),
    discount: Number(sale.discount || 0),
    paid,
    outstanding,
    payment: paymentMethods.length
      ? paymentMethods.join(", ")
      : paid > 0
        ? "Recorded payment"
        : "Credit",
    status,
    date: sale.sale_date,
    saleStatus: sale.sale_status,
  };
}

function PaymentBadge({ status }) {
  const styles = {
    Paid: "badge-success",
    Pending: "badge-warning",
    "Partially Paid": "bg-blue-100 text-blue-700",
    Cancelled: "bg-rose-100 text-rose-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        styles[status] || "badge-warning"
      }`}
    >
      {status}
    </span>
  );
}

function PaymentIcon({ method }) {
  const normalized = String(method || "").toUpperCase();

  if (normalized.includes("CASH")) {
    return <Banknote size={16} />;
  }

  if (normalized.includes("UPI")) {
    return <Smartphone size={16} />;
  }

  return <CreditCard size={16} />;
}

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [form, setForm] = useState({
    farmerMobile: "",
    discount: "0",
    notes: "",
    paymentType: "CASH",
    paymentAmount: "",
    items: [
      {
        fertilizerId: "",
        quantity: "",
        price: "",
      },
    ],
  });

  const request = useCallback(async (path, options = {}) => {
    const token = getToken();

    if (!token) {
      throw new Error("Your session has expired. Please log in again.");
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [salesData, farmersData, fertilizersData] =
        await Promise.all([
          request("/api/sales"),
          request("/api/farmers"),
          request("/api/fertilizers"),
        ]);

      setSales(
        Array.isArray(salesData.sales)
          ? salesData.sales.map(normalizeSale)
          : []
      );

      setFarmers(
        Array.isArray(farmersData.farmers)
          ? farmersData.farmers
              .map(normalizeFarmer)
              .filter((farmer) => farmer.active)
          : []
      );

      setProducts(
        Array.isArray(fertilizersData.fertilizers)
          ? fertilizersData.fertilizers
              .map(normalizeProduct)
              .filter((product) => product.active)
          : []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalSalesValue = sales
    .filter((sale) => sale.saleStatus === "COMPLETED")
    .reduce((sum, sale) => sum + sale.total, 0);

  const totalRevenue = sales
    .filter((sale) => sale.saleStatus === "COMPLETED")
    .reduce((sum, sale) => sum + sale.paid, 0);

  const totalCredit = sales
    .filter((sale) => sale.saleStatus === "COMPLETED")
    .reduce((sum, sale) => sum + sale.outstanding, 0);

  const paidSales = sales.filter(
    (sale) =>
      sale.saleStatus === "COMPLETED" &&
      sale.status === "Paid"
  ).length;

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const productNames = sale.items
        .map((item) => item.name)
        .join(" ");

      const matchesSearch = [
        sale.invoice,
        sale.farmer,
        sale.phone,
        productNames,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        filter === "All" ||
        (filter === "Paid" && sale.status === "Paid") ||
        (filter === "Pending" && sale.status === "Pending") ||
        (filter === "Partially Paid" &&
          sale.status === "Partially Paid") ||
        (filter === "Cancelled" &&
          sale.status === "Cancelled") ||
        sale.payment.toUpperCase().includes(filter.toUpperCase());

      return matchesSearch && matchesFilter;
    });
  }, [sales, search, filter]);

  const selectedFarmer = farmers.find(
    (farmer) => farmer.phone === form.farmerMobile
  );

  const itemSubtotal = form.items.reduce((sum, item) => {
    return (
      sum +
      Number(item.quantity || 0) * Number(item.price || 0)
    );
  }, 0);

  const discount = Number(form.discount || 0);

  const billTotal = Math.max(0, itemSubtotal - discount);

  const paymentAmount = Number(form.paymentAmount || 0);

  const remainingAmount = Math.max(
    0,
    billTotal - paymentAmount
  );

  const resetForm = () => {
    setForm({
      farmerMobile: "",
      discount: "0",
      notes: "",
      paymentType: "CASH",
      paymentAmount: "",
      items: [
        {
          fertilizerId: "",
          quantity: "",
          price: "",
        },
      ],
    });
  };

  const openSaleModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleProductChange = (index, productId) => {
    const product = products.find(
      (item) => item.id === Number(productId)
    );

    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              fertilizerId: productId,
              price: product ? String(product.price) : "",
              quantity: "",
            }
          : item
      ),
    }));
  };

  const handleItemChange = (index, field, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      ),
    }));
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          fertilizerId: "",
          quantity: "",
          price: "",
        },
      ],
    }));
  };

  const removeItem = (index) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFarmer) {
      alert("Please select a registered active farmer.");
      return;
    }

    if (form.items.length === 0) {
      alert("Add at least one fertilizer.");
      return;
    }

    const seenIds = new Set();

    const saleItems = [];

    for (const item of form.items) {
      const fertilizerId = Number(item.fertilizerId);
      const quantity = Number(item.quantity);
      const price = Number(item.price);

      const product = products.find(
        (entry) => entry.id === fertilizerId
      );

      if (
        !product ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        alert("Please enter valid fertilizer, quantity and price details.");
        return;
      }

      if (seenIds.has(fertilizerId)) {
        alert(
          "A fertilizer can only appear once per sale. Update its quantity instead."
        );
        return;
      }

      seenIds.add(fertilizerId);

      if (quantity > product.stock) {
        alert(
          `Insufficient stock for ${product.name}. Available: ${product.stock} bags.`
        );
        return;
      }

      saleItems.push({
        fertilizer_id: fertilizerId,
        quantity,
        selling_price: price,
      });
    }

    if (
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount > itemSubtotal
    ) {
      alert("Enter a valid discount that does not exceed the subtotal.");
      return;
    }

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount < 0 ||
      paymentAmount > billTotal
    ) {
      alert("Payment amount cannot exceed the total bill.");
      return;
    }

    if (
      paymentAmount > 0 &&
      !["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"].includes(
        form.paymentType
      )
    ) {
      alert("Select a valid payment method.");
      return;
    }

    const payload = {
      farmer_mobile: selectedFarmer.phone,
      discount,
      notes: form.notes.trim(),
      items: saleItems,
    };

    if (paymentAmount > 0) {
      payload.payment = {
        amount: paymentAmount,
        payment_method: form.paymentType,
      };
    }

    try {
      setSaving(true);

      const result = await request("/api/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowModal(false);
      resetForm();

      await loadData();

      alert(
        `Sale created successfully.\nInvoice: ${
          result.sale?.invoice_number || "Created"
        }`
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-7">
      {/* HEADER */}
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <ShoppingBag size={17} />
            FINANCIAL MANAGEMENT
          </div>

          <h1 className="text-2xl font-bold text-[#302b50] md:text-3xl">
            Sales Management
          </h1>

          <p className="mt-2 text-sm text-[#89869e]">
            Record fertilizer sales and manage farmer transactions.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary"
            title="Refresh sales"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
          </button>

          <button
            onClick={openSaleModal}
            className="btn-primary"
          >
            <Plus size={18} />
            Create New Sale
          </button>
        </div>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            onClick={loadData}
            className="font-bold underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-purple-100 p-3 text-purple-600">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Total Sales Value</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(totalSalesValue)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Completed sales
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Collected Revenue</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(totalRevenue)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Actual payments received
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Outstanding Credit</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(totalCredit)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Remaining collection
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Total Transactions</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {sales.length}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              {paidSales} fully paid transactions
            </p>
          </div>
        </div>
      </section>

      {/* SALES HISTORY */}
      <section className="glass-card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Sales History
            </h2>
            <p className="mt-1 text-sm text-[#89869e]">
              View and search all fertilizer sales.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-purple-100 bg-white/80 px-4 py-3">
              <Search size={18} className="text-purple-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoice, farmer, mobile or product..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa5bd]"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="glass-input md:max-w-52"
            >
              <option>All</option>
              <option>Paid</option>
              <option>Pending</option>
              <option>Partially Paid</option>
              <option>Cancelled</option>
              <option>Cash</option>
              <option>UPI</option>
              <option>Credit</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left">
            <thead>
              <tr className="border-y border-purple-100 bg-purple-50/50 text-xs uppercase tracking-wider text-[#9691a8]">
                <th className="px-6 py-4 font-semibold">Invoice</th>
                <th className="px-6 py-4 font-semibold">Farmer</th>
                <th className="px-6 py-4 font-semibold">Products</th>
                <th className="px-6 py-4 font-semibold">Quantity</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold">Paid</th>
                <th className="px-6 py-4 font-semibold">Outstanding</th>
                <th className="px-6 py-4 font-semibold">Payment</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Date</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="10"
                    className="p-12 text-center text-[#89869e]"
                  >
                    Loading sales...
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-purple-50 text-sm transition hover:bg-white/60"
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-purple-700">
                        {sale.invoice}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-[#39364f]">
                          {sale.farmer}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[#9994ac]">
                          <Phone size={12} />
                          {sale.phone}
                        </p>
                      </div>
                    </td>

                    <td className="max-w-56 px-6 py-4">
                      <div className="space-y-1">
                        {sale.items.map((item, index) => (
                          <p
                            key={`${sale.id}-${item.id}-${index}`}
                            className="text-xs text-[#77758d]"
                          >
                            {item.name}
                          </p>
                        ))}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-[#77758d]">
                      {sale.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                      )}{" "}
                      bags
                    </td>

                    <td className="px-6 py-4 font-bold text-[#39364f]">
                      {formatCurrency(sale.total)}
                    </td>

                    <td className="px-6 py-4 font-semibold text-emerald-600">
                      {formatCurrency(sale.paid)}
                    </td>

                    <td className="px-6 py-4 font-semibold text-orange-600">
                      {formatCurrency(sale.outstanding)}
                    </td>

                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-xs text-[#77758d]">
                        <PaymentIcon method={sale.payment} />
                        {sale.payment}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <PaymentBadge status={sale.status} />
                    </td>

                    <td className="px-6 py-4 text-[#77758d]">
                      {formatDate(sale.date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredSales.length === 0 && (
          <div className="p-12 text-center">
            <ShoppingBag
              size={35}
              className="mx-auto text-purple-300"
            />
            <p className="mt-3 font-bold text-[#302b50]">
              No sales found
            </p>
            <p className="mt-1 text-sm text-[#89869e]">
              {sales.length === 0
                ? "Your recorded sales will appear here."
                : "Try another search or filter."}
            </p>
          </div>
        )}
      </section>

      {/* NEW SALE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">
          <div className="glass-panel my-auto w-full max-w-2xl p-6 md:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#302b50]">
                  Create New Sale
                </h2>
                <p className="mt-1 text-sm text-[#89869e]">
                  Select a registered farmer and add fertilizer items.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
                className="rounded-xl bg-purple-50 p-2 text-purple-600"
                disabled={saving}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* FARMER DETAILS */}
              <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-purple-700">
                  <Users size={17} />
                  Farmer Information
                </h3>

                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Select Farmer
                </label>

                <select
                  required
                  value={form.farmerMobile}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      farmerMobile: event.target.value,
                    })
                  }
                  className="glass-input"
                >
                  <option value="">Choose a registered farmer</option>

                  {farmers.map((farmer) => (
                    <option key={farmer.id} value={farmer.phone}>
                      {farmer.name} — {farmer.phone}
                    </option>
                  ))}
                </select>

                {selectedFarmer && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 size={16} />
                    <span>
                      {selectedFarmer.name}
                      {selectedFarmer.village
                        ? ` · ${selectedFarmer.village}`
                        : ""}
                    </span>
                  </div>
                )}

                {farmers.length === 0 && (
                  <p className="mt-3 text-xs text-orange-700">
                    No active farmers found. Register a farmer first.
                  </p>
                )}
              </div>

              {/* FERTILIZER ITEMS */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#625d7b]">
                    <Package size={17} />
                    Fertilizer Items
                  </h3>

                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 text-sm font-bold text-purple-700 hover:text-purple-900"
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>

                <div className="space-y-4">
                  {form.items.map((item, index) => {
                    const selectedProduct = products.find(
                      (product) =>
                        product.id === Number(item.fertilizerId)
                    );

                    const alreadySelected = new Set(
                      form.items
                        .filter((_, itemIndex) => itemIndex !== index)
                        .map((entry) => Number(entry.fertilizerId))
                        .filter(Boolean)
                    );

                    return (
                      <div
                        key={index}
                        className="rounded-2xl border border-purple-100 bg-white/60 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-purple-600">
                            Item {index + 1}
                          </span>

                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                              title="Remove item"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                              Select Fertilizer
                            </label>

                            <select
                              required
                              value={item.fertilizerId}
                              onChange={(event) =>
                                handleProductChange(
                                  index,
                                  event.target.value
                                )
                              }
                              className="glass-input"
                            >
                              <option value="">
                                Choose a fertilizer
                              </option>

                              {products.map((product) => (
                                <option
                                  key={product.id}
                                  value={product.id}
                                  disabled={
                                    product.stock <= 0 ||
                                    alreadySelected.has(product.id)
                                  }
                                >
                                  {product.name}
                                  {product.brand
                                    ? ` (${product.brand})`
                                    : ""}
                                  {" — "}
                                  {product.stock} bags available
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                                Quantity (Bags)
                              </label>

                              <input
                                required
                                type="number"
                                min="1"
                                step="1"
                                max={selectedProduct?.stock || undefined}
                                value={item.quantity}
                                onChange={(event) =>
                                  handleItemChange(
                                    index,
                                    "quantity",
                                    event.target.value
                                  )
                                }
                                placeholder="Enter quantity"
                                className="glass-input"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                                Selling Price per Bag (₹)
                              </label>

                              <input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(event) =>
                                  handleItemChange(
                                    index,
                                    "price",
                                    event.target.value
                                  )
                                }
                                placeholder="Enter selling price"
                                className="glass-input"
                              />
                            </div>
                          </div>

                          {selectedProduct && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs">
                              <span className="flex items-center gap-2 text-emerald-700">
                                <Package size={15} />
                                Available: {selectedProduct.stock} bags
                                {selectedProduct.size > 0
                                  ? ` · ${selectedProduct.size} kg per bag`
                                  : ""}
                              </span>

                              <span className="font-bold text-emerald-700">
                                Item total:{" "}
                                {formatCurrency(
                                  Number(item.quantity || 0) *
                                    Number(item.price || 0)
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {products.length === 0 && (
                  <p className="mt-3 text-xs text-orange-700">
                    No active fertilizers found. Add fertilizers first.
                  </p>
                )}
              </div>

              {/* DISCOUNT AND NOTES */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Discount (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={itemSubtotal}
                    value={form.discount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        discount: event.target.value,
                      })
                    }
                    className="glass-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Notes (Optional)
                  </label>

                  <input
                    value={form.notes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        notes: event.target.value,
                      })
                    }
                    placeholder="Sale notes"
                    className="glass-input"
                  />
                </div>
              </div>

              {/* PAYMENT */}
              <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-purple-700">
                  <CreditCard size={17} />
                  Initial Payment
                </h3>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                    Amount Received (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    max={billTotal}
                    step="0.01"
                    value={form.paymentAmount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        paymentAmount: event.target.value,
                      })
                    }
                    placeholder="Enter 0 for full credit"
                    className="glass-input"
                  />

                  <p className="mt-1 text-xs text-[#89869e]">
                    Enter the amount actually received now. Leave blank or
                    enter 0 for a credit sale.
                  </p>
                </div>

                {paymentAmount > 0 && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                      Payment Method
                    </label>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        { label: "Cash", value: "CASH", icon: Banknote },
                        { label: "UPI", value: "UPI", icon: Smartphone },
                        {
                          label: "Bank Transfer",
                          value: "BANK_TRANSFER",
                          icon: CreditCard,
                        },
                        {
                          label: "Card",
                          value: "CARD",
                          icon: CreditCard,
                        },
                        {
                          label: "Other",
                          value: "OTHER",
                          icon: CreditCard,
                        },
                      ].map((method) => {
                        const Icon = method.icon;
                        const active =
                          form.paymentType === method.value;

                        return (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                paymentType: method.value,
                              })
                            }
                            className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                              active
                                ? "border-purple-400 bg-purple-100 text-purple-700"
                                : "border-purple-100 bg-white/60 text-[#89869e] hover:bg-purple-50"
                            }`}
                          >
                            <Icon size={17} />
                            {method.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* BILL SUMMARY */}
              <div className="rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50 to-emerald-50 p-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#77758d]">
                      Subtotal
                    </span>
                    <span className="font-semibold text-[#39364f]">
                      {formatCurrency(itemSubtotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#77758d]">
                      Discount
                    </span>
                    <span className="font-semibold text-[#39364f]">
                      - {formatCurrency(discount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-purple-200 pt-3">
                    <span className="font-bold text-[#39364f]">
                      Total Bill Amount
                    </span>
                    <span className="text-xl font-extrabold text-[#302b50]">
                      {formatCurrency(billTotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-700">
                      Initial Payment
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(paymentAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-orange-700">
                      Remaining Balance
                    </span>
                    <span className="font-bold text-orange-700">
                      {formatCurrency(remainingAmount)}
                    </span>
                  </div>
                </div>

                {remainingAmount > 0 && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-medium text-orange-700">
                    <AlertCircle size={15} />
                    The remaining amount will be recorded as outstanding credit.
                  </p>
                )}

                {billTotal > 0 && remainingAmount === 0 && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
                    <CheckCircle2 size={15} />
                    This sale will be fully paid.
                  </p>
                )}
              </div>

              {/* ACTIONS */}
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
                    farmers.length === 0 ||
                    products.length === 0
                  }
                >
                  <CheckCircle2 size={17} />
                  {saving ? "Saving Sale..." : "Complete Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
