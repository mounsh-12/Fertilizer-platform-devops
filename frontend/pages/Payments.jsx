
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Banknote,
  Smartphone,
  Clock,
  Search,
  Plus,
  X,
  Phone,
  Receipt,
  CheckCircle2,
  CreditCard,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getToken = () =>
  localStorage.getItem("adminToken") ||
  sessionStorage.getItem("adminToken") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  sessionStorage.getItem("authToken");

const getHeaders = () => {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const normalizeMethod = (method) => {
  const methods = {
    CASH: "Cash",
    UPI: "UPI",
    BANK_TRANSFER: "Bank Transfer",
    CARD: "Card",
    OTHER: "Other",
  };

  return methods[String(method || "").toUpperCase()] || method || "-";
};

const normalizePayment = (payment) => ({
  id: payment.payment_id,
  saleId: payment.sale_id,
  transactionId: `PAY-${payment.payment_id}`,
  invoice: payment.invoice_number || `Sale #${payment.sale_id}`,
  farmer: payment.farmer_name || "Unknown Farmer",
  phone: payment.mobile_number || "-",
  amount: Number(payment.amount || 0),
  method: normalizeMethod(payment.payment_method),
  date: payment.payment_date,
  reference: payment.transaction_reference || "-",
});

const normalizeSale = (sale) => {
  const total = Number(sale.total_amount || 0);
  const paid = Number(
    sale.amount_paid ?? sale.total_paid ?? 0
  );

  const outstanding = Number(
    sale.outstanding_amount ?? Math.max(total - paid, 0)
  );

  return {
    id: Number(sale.sale_id),
    invoice: sale.invoice_number || `Sale #${sale.sale_id}`,
    farmer: sale.farmer_name || "Unknown Farmer",
    phone: sale.mobile_number || "-",
    total,
    paid,
    outstanding: Math.max(outstanding, 0),
    status: sale.sale_status,
    date: sale.sale_date,
  };
};

function MethodBadge({ method }) {
  const styles = {
    Cash: "bg-emerald-100 text-emerald-700",
    UPI: "bg-blue-100 text-blue-700",
    "Bank Transfer": "bg-indigo-100 text-indigo-700",
    Card: "bg-purple-100 text-purple-700",
    Other: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
        styles[method] || "bg-purple-100 text-purple-700"
      }`}
    >
      {method === "Cash" ? (
        <Banknote size={14} />
      ) : (
        <Smartphone size={14} />
      )}
      {method}
    </span>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [sales, setSales] = useState([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    saleId: "",
    amount: "",
    method: "CASH",
    reference: "",
    notes: "",
  });

  // ==========================================
  // LOAD PAYMENTS AND SALES FROM DATABASE
  // ==========================================
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const headers = getHeaders();

      const [paymentResponse, salesResponse] = await Promise.all([
        fetch(`${API_URL}/api/payments`, { headers }),
        fetch(`${API_URL}/api/sales`, { headers }),
      ]);

      const paymentData = await paymentResponse.json();
      const salesData = await salesResponse.json();

      if (!paymentResponse.ok) {
        throw new Error(
          paymentData.message || "Unable to load payment history."
        );
      }

      if (!salesResponse.ok) {
        throw new Error(
          salesData.message || "Unable to load sales."
        );
      }

      const paymentRows =
        paymentData.payments ||
        paymentData.data ||
        [];

      const salesRows =
        salesData.sales ||
        salesData.data ||
        [];

      setPayments(paymentRows.map(normalizePayment));
      setSales(salesRows.map(normalizeSale));

    } catch (err) {
      console.error("Payments loading error:", err);
      setError(err.message || "Unable to load payment information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================
  // SUMMARY CALCULATIONS
  // ==========================================
  const totalCollected = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const cashCollected = payments
    .filter((payment) => payment.method === "Cash")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const upiCollected = payments
    .filter((payment) => payment.method === "UPI")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const outstandingSales = sales.filter(
    (sale) =>
      sale.status === "COMPLETED" &&
      sale.outstanding > 0
  );

  const outstandingAmount = outstandingSales.reduce(
    (sum, sale) => sum + sale.outstanding,
    0
  );

  // ==========================================
  // SEARCH AND FILTER
  // ==========================================
  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesSearch = [
        payment.transactionId,
        payment.invoice,
        payment.farmer,
        payment.phone,
        payment.reference,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        filter === "All" || payment.method === filter;

      return matchesSearch && matchesFilter;
    });
  }, [payments, search, filter]);

  // ==========================================
  // OPEN PAYMENT MODAL
  // ==========================================
  const openModal = (sale = null) => {
    setForm({
      saleId: sale ? String(sale.id) : "",
      amount: "",
      method: "CASH",
      reference: "",
      notes: "",
    });

    setError("");
    setShowModal(true);
  };

  const selectedSale = sales.find(
    (sale) => sale.id === Number(form.saleId)
  );

  // ==========================================
  // RECORD PAYMENT IN MYSQL
  // ==========================================
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (!form.saleId || !selectedSale) {
      alert("Please select a valid invoice.");
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    if (amount > selectedSale.outstanding) {
      alert(
        `Payment cannot exceed the outstanding balance of ${formatCurrency(
          selectedSale.outstanding
        )}.`
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/payments`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          sale_id: selectedSale.id,
          amount,
          payment_method: form.method,
          transaction_reference: form.reference.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Payment could not be recorded."
        );
      }

      // Close only after the backend confirms success.
      setShowModal(false);

      // Fetch the saved records from MySQL.
      await loadData();

      alert("Payment recorded successfully.");

    } catch (err) {
      console.error("Payment submission error:", err);
      setError(err.message || "Failed to record payment.");
      alert(err.message || "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // UI
  // ==========================================
  return (
    <div className="animate-fade-in space-y-7">

      {/* HEADER */}
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <Wallet size={17} />
            FINANCIAL MANAGEMENT
          </div>

          <h1 className="text-2xl font-bold text-[#302b50] md:text-3xl">
            Payments Management
          </h1>

          <p className="mt-2 text-sm text-[#89869e]">
            Track farmer payments, collections and outstanding balances.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            onClick={() => openModal()}
            className="btn-primary"
          >
            <Plus size={18} />
            Record Payment
          </button>
        </div>
      </section>

      {/* ERROR */}
      {error && !showModal && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={18} />
            Payment module error
          </div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-purple-100 p-3 text-purple-600">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Total Collected</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(totalCollected)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Saved payment records
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <Banknote size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Cash Collections</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(cashCollected)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Payments received in cash
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
            <Smartphone size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">UPI Collections</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(upiCollected)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Digital payments received
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Outstanding Balance</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(outstandingAmount)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Remaining invoice dues
            </p>
          </div>
        </div>

      </section>

      {/* OUTSTANDING SALES */}
      <section className="glass-card p-5 md:p-6">

        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-orange-100 p-3 text-orange-600">
            <AlertCircle size={21} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Outstanding Farmer Balances
            </h2>
            <p className="mt-1 text-sm text-[#89869e]">
              Collect pending amounts against existing invoices.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8 text-purple-500">
            <Loader2 className="animate-spin" size={25} />
          </div>
        ) : outstandingSales.length === 0 ? (
          <p className="py-5 text-center text-sm text-[#89869e]">
            No outstanding invoice balances.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {outstandingSales.map((sale) => {
              const progress =
                sale.total > 0
                  ? Math.min((sale.paid / sale.total) * 100, 100)
                  : 0;

              return (
                <div
                  key={sale.id}
                  className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[#39364f]">
                        {sale.farmer}
                      </h3>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#89869e]">
                        <Phone size={12} />
                        {sale.phone}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-purple-600">
                        {sale.invoice}
                      </p>
                    </div>

                    <span className="rounded-lg bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">
                      Pending
                    </span>
                  </div>

                  <div className="mt-4 flex justify-between text-xs text-[#89869e]">
                    <span>Paid: {formatCurrency(sale.paid)}</span>
                    <span>Bill: {formatCurrency(sale.total)}</span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-orange-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-[#89869e]">
                      Remaining
                    </span>
                    <span className="font-extrabold text-orange-700">
                      {formatCurrency(sale.outstanding)}
                    </span>
                  </div>

                  <button
                    onClick={() => openModal(sale)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm font-bold text-orange-700 transition hover:bg-orange-100"
                  >
                    <Plus size={16} />
                    Collect Payment
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </section>

      {/* PAYMENT HISTORY */}
      <section className="glass-card overflow-hidden">

        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Payment History
            </h2>
            <p className="mt-1 text-sm text-[#89869e]">
              Review payments saved in your database.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-purple-100 bg-white/80 px-4 py-3">
              <Search size={18} className="text-purple-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search farmer, invoice or transaction..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa5bd]"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="glass-input md:max-w-52"
            >
              <option value="All">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead>
              <tr className="border-y border-purple-100 bg-purple-50/50 text-xs uppercase tracking-wider text-[#9691a8]">
                <th className="px-6 py-4 font-semibold">Transaction</th>
                <th className="px-6 py-4 font-semibold">Farmer</th>
                <th className="px-6 py-4 font-semibold">Invoice</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Method</th>
                <th className="px-6 py-4 font-semibold">Reference</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-purple-50 text-sm transition hover:bg-white/60"
                >
                  <td className="px-6 py-4 font-bold text-purple-700">
                    {payment.transactionId}
                  </td>

                  <td className="px-6 py-4">
                    <p className="font-bold text-[#39364f]">
                      {payment.farmer}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#9994ac]">
                      <Phone size={12} />
                      {payment.phone}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-purple-700">
                    {payment.invoice}
                  </td>

                  <td className="px-6 py-4 font-bold text-[#39364f]">
                    {formatCurrency(payment.amount)}
                  </td>

                  <td className="px-6 py-4">
                    <MethodBadge method={payment.method} />
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {payment.reference}
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {formatDate(payment.date)}
                  </td>

                  <td className="px-6 py-4">
                    <span className="badge-success rounded-full px-3 py-1 text-xs font-bold">
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        Received
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredPayments.length === 0 && (
          <div className="p-12 text-center">
            <Wallet
              size={35}
              className="mx-auto text-purple-300"
            />
            <p className="mt-3 font-bold text-[#302b50]">
              No payments found
            </p>
            <p className="mt-1 text-sm text-[#89869e]">
              {payments.length === 0
                ? "No payment records are currently available in the database."
                : "Try another search or payment method."}
            </p>
          </div>
        )}

      </section>

      {/* RECORD PAYMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">
          <div className="glass-panel my-auto w-full max-w-xl p-6 md:p-7">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#302b50]">
                  Record Farmer Payment
                </h2>
                <p className="mt-1 text-sm text-[#89869e]">
                  Record a payment against an existing invoice.
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

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Select Invoice
                </label>

                <select
                  required
                  value={form.saleId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      saleId: event.target.value,
                      amount: "",
                    }))
                  }
                  className="glass-input"
                >
                  <option value="">Choose an outstanding invoice</option>

                  {outstandingSales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.invoice} — {sale.farmer} — Due{" "}
                      {formatCurrency(sale.outstanding)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSale && (
                <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                  <div className="flex items-center gap-2 font-bold text-[#39364f]">
                    <Receipt size={17} className="text-purple-600" />
                    {selectedSale.invoice}
                  </div>

                  <p className="mt-2 text-sm text-[#77758d]">
                    Farmer: {selectedSale.farmer}
                  </p>

                  <p className="text-sm text-[#77758d]">
                    Mobile: {selectedSale.phone}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-[#89869e]">Bill Amount</p>
                      <p className="font-bold text-[#302b50]">
                        {formatCurrency(selectedSale.total)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#89869e]">Outstanding</p>
                      <p className="font-bold text-orange-700">
                        {formatCurrency(selectedSale.outstanding)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Payment Amount (₹)
                </label>

                <input
                  required
                  type="number"
                  min="0.01"
                  max={selectedSale?.outstanding || undefined}
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="Enter payment amount"
                  className="glass-input"
                  disabled={!selectedSale}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Payment Method
                </label>

                <select
                  value={form.method}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      method: event.target.value,
                    }))
                  }
                  className="glass-input"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Transaction Reference (Optional)
                </label>

                <input
                  value={form.reference}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                  placeholder="UPI transaction ID or receipt number"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Notes (Optional)
                </label>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Additional payment details"
                  rows={2}
                  className="glass-input"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-3">
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
                  disabled={saving || !selectedSale}
                >
                  {saving ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={17} />
                      Save Payment
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
