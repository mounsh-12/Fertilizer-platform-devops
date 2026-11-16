
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Clock3,
  Search,
  Plus,
  X,
  Phone,
  CalendarDays,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Banknote,
  Smartphone,
  CreditCard,
  History,
  RefreshCw,
  Loader2,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";

const getToken = () =>
  localStorage.getItem("adminToken") ||
  sessionStorage.getItem("adminToken") ||
  localStorage.getItem("token");

const getHeaders = () => {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10);
};

const formatDate = (date) => {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

const getStatus = (credit, today) => {
  if (credit.outstanding <= 0) return "Paid";
  if (credit.paid > 0) return "Partial";

  return "Pending";
};

const statusStyles = {
  Paid: "bg-emerald-100 text-emerald-700",
  Partial: "bg-blue-100 text-blue-700",
  Pending: "bg-orange-100 text-orange-700",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        statusStyles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

export default function FarmerCredits() {
  const [credits, setCredits] = useState([]);
  const [history, setHistory] = useState([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [selectedCredit, setSelectedCredit] = useState(null);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [paymentCredit, setPaymentCredit] = useState(null);

  const [paymentForm, setPaymentForm] = useState({
    saleId: "",
    amount: "",
    method: "CASH",
    reference: "",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = localDate();

  // ==========================================
  // LOAD FARMER CREDIT DATA
  // ==========================================
  const loadCredits = useCallback(async () => {
    const response = await fetch(
      `${API_URL}/api/credits/farmers`,
      { headers: getHeaders() }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load farmer credits."
      );
    }

    const farmers = (data.farmers || []).map((farmer) => ({
      id: Number(farmer.farmer_id),
      farmer: farmer.farmer_name,
      phone: farmer.mobile_number,
      village: farmer.village || "-",
      total: Number(farmer.total_sales || 0),
      paid: Number(farmer.total_paid || 0),
      outstanding: Number(farmer.outstanding_balance || 0),
      invoiceCount: Number(
        farmer.outstanding_invoice_count || 0
      ),
    }));

    setCredits(farmers);
  }, []);

  // ==========================================
  // LOAD PAYMENT HISTORY
  // ==========================================
  const loadHistory = useCallback(async () => {
    const response = await fetch(
      `${API_URL}/api/payments`,
      { headers: getHeaders() }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load repayment history."
      );
    }

    const rows = (data.payments || []).map((payment) => ({
      id: payment.payment_id,
      saleId: payment.sale_id,
      farmer: payment.farmer_name || "-",
      invoice: payment.invoice_number || "-",
      amount: Number(payment.amount || 0),
      method: normalizeMethod(payment.payment_method),
      date: payment.payment_date,
      reference: payment.transaction_reference || "-",
    }));

    setHistory(rows);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadCredits(),
        loadHistory(),
      ]);
    } catch (err) {
      console.error("Farmer credits loading error:", err);
      setError(err.message || "Unable to load farmer credits.");
    } finally {
      setLoading(false);
    }
  }, [loadCredits, loadHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================
  // SUMMARY CALCULATIONS
  // ==========================================
  const totalIssued = credits.reduce(
    (sum, credit) => sum + credit.total,
    0
  );

  const totalCollected = credits.reduce(
    (sum, credit) => sum + credit.paid,
    0
  );

  const totalOutstanding = credits.reduce(
    (sum, credit) => sum + credit.outstanding,
    0
  );

  // The current controller does not return invoice due dates.
  // Therefore, overdue amounts cannot yet be calculated reliably.
  const overdueAmount = 0;

  // ==========================================
  // SEARCH AND FILTER
  // ==========================================
  const filteredCredits = useMemo(() => {
    return credits.filter((credit) => {
      const matchesSearch = [
        credit.farmer,
        credit.phone,
        credit.village,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const status = getStatus(credit, today);

      const matchesFilter =
        filter === "All" || status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [credits, search, filter, today]);

  // ==========================================
  // LOAD ONE FARMER'S OUTSTANDING INVOICES
  // ==========================================
  const openDetails = async (credit) => {
    setSelectedCredit(credit.id);
    setSelectedInvoices([]);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/credits/farmers/${credit.id}`,
        { headers: getHeaders() }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load farmer details."
        );
      }

      setSelectedInvoices(data.invoices || []);
    } catch (err) {
      console.error("Farmer detail error:", err);
      setError(err.message);
    }
  };

  const activeDetailCredit = credits.find(
    (credit) => credit.id === selectedCredit
  );

  // ==========================================
  // OPEN PAYMENT FORM
  // ==========================================
  const openPaymentModal = async (credit) => {
    setPaymentCredit(credit);

    setPaymentForm({
      saleId: "",
      amount: "",
      method: "CASH",
      reference: "",
      notes: "",
    });

    setSelectedCredit(null);
    setSelectedInvoices([]);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/credits/farmers/${credit.id}`,
        { headers: getHeaders() }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load outstanding invoices."
        );
      }

      setSelectedInvoices(data.invoices || []);
    } catch (err) {
      console.error("Outstanding invoices error:", err);
      setError(err.message);
    }
  };

  const activeInvoice = selectedInvoices.find(
    (invoice) =>
      Number(invoice.sale_id) === Number(paymentForm.saleId)
  );

  // ==========================================
  // RECORD PAYMENT
  // ==========================================
  const handlePayment = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (!activeInvoice) {
      setError("Please select an outstanding invoice.");
      return;
    }

    const amount = Number(paymentForm.amount);
    const outstanding = Number(
      activeInvoice.outstanding_amount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > outstanding
    ) {
      setError(
        `Enter an amount between ₹0.01 and ${currency(outstanding)}.`
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/payments`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            sale_id: Number(activeInvoice.sale_id),
            amount,
            payment_method: paymentForm.method,
            transaction_reference:
              paymentForm.reference.trim() || null,
            notes: paymentForm.notes.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to record payment."
        );
      }

      setPaymentCredit(null);
      setSelectedInvoices([]);

      await loadData();

      alert("Farmer payment recorded successfully.");

    } catch (err) {
      console.error("Farmer credit payment error:", err);
      setError(err.message || "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  const farmerHistory = history.filter(
    (payment) =>
      payment.saleId &&
      selectedInvoices.some(
        (invoice) =>
          Number(invoice.sale_id) === Number(payment.saleId)
      )
  );

  return (
    <div className="animate-fade-in space-y-7 text-[#39364f]">

      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-600">
            <CreditCard size={18} />
            FINANCIAL MANAGEMENT
          </div>

          <h1 className="text-2xl font-extrabold text-[#302b50] md:text-3xl">
            Farmer Credits
          </h1>

          <p className="mt-2 text-sm text-[#89869e]">
            Manage farmer dues, credit repayments and outstanding amounts.
          </p>
        </div>

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
      </div>

      {/* ERROR */}
      {error && !paymentCredit && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={18} />
            Farmer Credits Error
          </div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-purple-100 p-3 text-purple-600">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">
              Total Credit Issued
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {currency(totalIssued)}
            </h2>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">
              Total Collected
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {currency(totalCollected)}
            </h2>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <Clock3 size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">
              Outstanding Credits
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {currency(totalOutstanding)}
            </h2>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-red-100 p-3 text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">
              Overdue Amount
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {currency(overdueAmount)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Due dates are not configured in the current API.
            </p>
          </div>
        </div>

      </div>

      {/* FARMER CREDIT RECORDS */}
      <section className="glass-card overflow-hidden">

        <div className="space-y-4 p-5 md:p-6">
          <div>
            <h2 className="text-lg font-bold">
              Farmer Credit Records
            </h2>
            <p className="mt-1 text-sm text-[#89869e]">
              Review farmer balances and collect outstanding payments.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">

            <div className="flex flex-1 items-center gap-3 rounded-xl border border-purple-100 bg-white/80 px-4 py-3">
              <Search size={18} className="text-purple-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search farmer, mobile or village..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa5bd]"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="glass-input md:max-w-48"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>

          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-y border-purple-100 bg-purple-50/50 text-xs uppercase tracking-wider text-[#9691a8]">
                <th className="px-5 py-4">Farmer</th>
                <th className="px-5 py-4">Village</th>
                <th className="px-5 py-4">Total Sales</th>
                <th className="px-5 py-4">Paid</th>
                <th className="px-5 py-4">Balance</th>
                <th className="px-5 py-4">Open Invoices</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCredits.map((credit) => {
                const status = getStatus(credit, today);

                return (
                  <tr
                    key={credit.id}
                    className="border-b border-purple-50 text-sm transition hover:bg-purple-50/30"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold">{credit.farmer}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#9994ac]">
                        <Phone size={12} />
                        {credit.phone}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-[#77758d]">
                      {credit.village}
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      {currency(credit.total)}
                    </td>

                    <td className="px-5 py-4 font-semibold text-emerald-600">
                      {currency(credit.paid)}
                    </td>

                    <td className="px-5 py-4 font-bold text-orange-600">
                      {currency(credit.outstanding)}
                    </td>

                    <td className="px-5 py-4">
                      {credit.invoiceCount}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">

                        <button
                          onClick={() => openDetails(credit)}
                          title="View credit details"
                          className="rounded-lg bg-purple-100 p-2 text-purple-600 transition hover:bg-purple-200"
                        >
                          <Eye size={17} />
                        </button>

                        {credit.outstanding > 0 && (
                          <button
                            onClick={() => openPaymentModal(credit)}
                            title="Collect payment"
                            className="rounded-lg bg-emerald-100 p-2 text-emerald-600 transition hover:bg-emerald-200"
                          >
                            <Plus size={17} />
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="flex justify-center p-10 text-purple-600">
            <Loader2 size={28} className="animate-spin" />
          </div>
        )}

        {!loading && filteredCredits.length === 0 && (
          <div className="p-12 text-center text-sm text-[#89869e]">
            No farmer credit records match your search.
          </div>
        )}

      </section>

      {/* REPAYMENT HISTORY */}
      <section className="glass-card overflow-hidden">

        <div className="flex items-center gap-3 p-5 md:p-6">
          <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
            <History size={21} />
          </div>

          <div>
            <h2 className="text-lg font-bold">
              Credit Repayment History
            </h2>
            <p className="mt-1 text-sm text-[#89869e]">
              Payments recorded against farmer invoices.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead>
              <tr className="border-y border-purple-100 bg-purple-50/50 text-xs uppercase tracking-wider text-[#9691a8]">
                <th className="px-6 py-4">Farmer</th>
                <th className="px-6 py-4">Invoice</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>

            <tbody>
              {history.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-purple-50 text-sm"
                >
                  <td className="px-6 py-4 font-bold">
                    {payment.farmer}
                  </td>

                  <td className="px-6 py-4 text-purple-700">
                    {payment.invoice}
                  </td>

                  <td className="px-6 py-4 font-bold text-emerald-600">
                    {currency(payment.amount)}
                  </td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2">
                      {payment.method === "Cash" ? (
                        <Banknote size={16} className="text-emerald-600" />
                      ) : (
                        <Smartphone size={16} className="text-blue-600" />
                      )}
                      {payment.method}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {payment.reference}
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {formatDate(payment.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && history.length === 0 && (
          <div className="p-10 text-center text-sm text-[#89869e]">
            No payment history found.
          </div>
        )}

      </section>

      {/* CREDIT DETAILS MODAL */}
      {activeDetailCredit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">
          <div className="glass-panel my-auto w-full max-w-xl p-6">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Credit Details
                </h2>
                <p className="mt-1 text-sm text-[#89869e]">
                  {activeDetailCredit.farmer}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedCredit(null);
                  setSelectedInvoices([]);
                }}
                aria-label="Close details"
                className="rounded-xl bg-purple-50 p-2 text-purple-600"
              >
                <X size={19} />
              </button>
            </div>

            <div className="rounded-2xl bg-purple-50 p-4">
              <h3 className="font-bold">
                {activeDetailCredit.farmer}
              </h3>
              <p className="mt-1 text-sm text-[#89869e]">
                {activeDetailCredit.phone}
              </p>
              <p className="mt-1 text-sm text-[#89869e]">
                {activeDetailCredit.village}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/70 p-4">
                <p className="text-xs text-[#89869e]">Total Sales</p>
                <p className="mt-2 font-bold">
                  {currency(activeDetailCredit.total)}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-[#89869e]">Amount Paid</p>
                <p className="mt-2 font-bold text-emerald-700">
                  {currency(activeDetailCredit.paid)}
                </p>
              </div>

              <div className="rounded-xl bg-orange-50 p-4">
                <p className="text-xs text-[#89869e]">Outstanding</p>
                <p className="mt-2 font-bold text-orange-700">
                  {currency(activeDetailCredit.outstanding)}
                </p>
              </div>

              <div className="rounded-xl bg-white/70 p-4">
                <p className="text-xs text-[#89869e]">Open Invoices</p>
                <p className="mt-2 font-bold">
                  {activeDetailCredit.invoiceCount}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="mb-3 font-bold">
                Outstanding Invoices
              </h3>

              {selectedInvoices.length === 0 ? (
                <p className="text-sm text-[#89869e]">
                  No outstanding invoices for this farmer.
                </p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {selectedInvoices.map((invoice) => (
                    <div
                      key={invoice.sale_id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-purple-700">
                          {invoice.invoice_number}
                        </p>
                        <p className="mt-1 text-xs text-[#89869e]">
                          {formatDate(invoice.sale_date)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-orange-700">
                          {currency(invoice.outstanding_amount)}
                        </p>
                        <p className="text-xs text-[#89869e]">
                          Outstanding
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeDetailCredit.outstanding > 0 && (
              <button
                onClick={() => openPaymentModal(activeDetailCredit)}
                className="btn-primary mt-5 w-full"
              >
                <Plus size={17} />
                Collect Payment
              </button>
            )}

          </div>
        </div>
      )}

      {/* COLLECT PAYMENT MODAL */}
      {paymentCredit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">
          <div className="glass-panel my-auto w-full max-w-lg p-6">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Collect Credit Payment
                </h2>
                <p className="mt-1 text-sm text-[#89869e]">
                  {paymentCredit.farmer}
                </p>
              </div>

              <button
                onClick={() => {
                  setPaymentCredit(null);
                  setSelectedInvoices([]);
                }}
                aria-label="Close payment form"
                className="rounded-xl bg-purple-50 p-2 text-purple-600"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mb-5 rounded-2xl bg-orange-50 p-4">
              <p className="text-sm text-orange-700">
                Farmer Outstanding Balance
              </p>
              <p className="mt-1 text-2xl font-extrabold text-orange-700">
                {currency(paymentCredit.outstanding)}
              </p>
              <p className="mt-2 text-xs text-orange-600">
                {paymentCredit.farmer} · {paymentCredit.phone}
              </p>
            </div>

            <form onSubmit={handlePayment} className="space-y-4">

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Select Invoice
                </label>

                <select
                  required
                  value={paymentForm.saleId}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      saleId: event.target.value,
                      amount: "",
                    }))
                  }
                  className="glass-input"
                >
                  <option value="">Choose an outstanding invoice</option>

                  {selectedInvoices.map((invoice) => (
                    <option
                      key={invoice.sale_id}
                      value={invoice.sale_id}
                    >
                      {invoice.invoice_number} — Due{" "}
                      {currency(invoice.outstanding_amount)}
                    </option>
                  ))}
                </select>
              </div>

              {activeInvoice && (
                <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                  <div className="flex items-center gap-2 font-bold text-[#39364f]">
                    <Receipt size={17} className="text-purple-600" />
                    {activeInvoice.invoice_number}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-[#89869e]">Bill Amount</p>
                      <p className="font-bold">
                        {currency(activeInvoice.total_amount)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#89869e]">Already Paid</p>
                      <p className="font-bold text-emerald-700">
                        {currency(activeInvoice.total_paid)}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <p className="text-xs text-[#89869e]">
                        Remaining Balance
                      </p>
                      <p className="text-lg font-extrabold text-orange-700">
                        {currency(activeInvoice.outstanding_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Payment Amount (₹)
                </label>

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={activeInvoice?.outstanding_amount || undefined}
                  disabled={!activeInvoice}
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="Enter amount received"
                  className="glass-input"
                />

                {activeInvoice && (
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentForm((current) => ({
                        ...current,
                        amount: String(
                          activeInvoice.outstanding_amount
                        ),
                      }))
                    }
                    className="mt-2 text-xs font-bold text-purple-600 hover:underline"
                  >
                    Pay Full Balance
                  </button>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Payment Method
                </label>

                <select
                  value={paymentForm.method}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
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
                <label className="mb-2 block text-sm font-semibold">
                  Transaction Reference (Optional)
                </label>

                <input
                  value={paymentForm.reference}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                  placeholder="UPI ID or receipt number"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Notes (Optional)
                </label>

                <textarea
                  rows={2}
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Additional payment details"
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
                  onClick={() => {
                    setPaymentCredit(null);
                    setSelectedInvoices([]);
                    setError("");
                  }}
                  className="btn-secondary flex-1"
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={saving || !activeInvoice}
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
