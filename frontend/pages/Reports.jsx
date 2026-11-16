
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

import {
  TrendingUp,
  IndianRupee,
  ShoppingBag,
  CreditCard,
  Download,
  CalendarDays,
  ChartNoAxesCombined,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";

const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#64748b"];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

function ReportCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div className="stat-card glass-card p-5 transition duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#89869e]">
            {title}
          </p>

          <h3 className="mt-2 text-2xl font-extrabold text-[#302b50]">
            {value}
          </h3>

          <p className="mt-2 text-xs font-medium text-[#89869e]">
            {subtitle}
          </p>
        </div>

        <div className={`rounded-2xl p-3 ${color}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

function Reports() {
  const [period, setPeriod] = useState("This Year");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token =
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken");

  useEffect(() => {
    const controller = new AbortController();

    const fetchReports = async () => {
      try {
        setLoading(true);
        setError("");

        if (!token) {
          throw new Error("Admin authentication token not found. Please log in again.");
        }

        const response = await fetch(
          `${API_BASE_URL}/api/reports?period=${encodeURIComponent(period)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load business reports.");
        }

        setReport(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Reports loading error:", err);
          setError(err.message || "Unable to load reports.");
          setReport(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchReports();

    return () => controller.abort();
  }, [period, token]);

  const monthlyData = report?.monthlyData || [];
  const paymentData = report?.paymentData || [];
  const productData = report?.productData || [];

  const summary = report?.summary || {
    totalSales: 0,
    totalPurchases: 0,
    estimatedProfit: 0,
    totalPayments: 0,
    outstandingCredit: 0,
  };

  const totalPayments = useMemo(
    () =>
      paymentData
        .filter((item) => item.name !== "Credit")
        .reduce((sum, item) => sum + Number(item.value || 0), 0),
    [paymentData]
  );

  const handleExport = () => {
    if (!report) return;

    const rows = [
      ["Report Period", period],
      ["Start Date", report.dateRange?.startDate || ""],
      ["End Date", report.dateRange?.endDate || ""],
      [],
      ["Month", "Sales (INR)", "Purchases (INR)"],
      ...monthlyData.map((item) => [
        item.month,
        item.sales,
        item.purchases,
      ]),
      [],
      ["Payment Method", "Amount (INR)"],
      ...paymentData.map((item) => [
        item.name,
        item.value,
      ]),
      [],
      ["Fertilizer", "Quantity Sold"],
      ...productData.map((item) => [
        item.name,
        item.quantity,
      ]),
      [],
      ["Summary", "Amount (INR)"],
      ["Total Sales", summary.totalSales],
      ["Total Purchases", summary.totalPurchases],
      ["Estimated Difference", summary.estimatedProfit],
      ["Recorded Collections", summary.totalPayments],
      ["Outstanding Credit", summary.outstandingCredit],
    ];

    const csvContent = rows
      .map((row) =>
        row
          .map((value) => {
            const safeValue = String(value ?? "").replace(/"/g, '""');
            return `"${safeValue}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "sri-byraweswara-business-reports.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  if (loading && !report) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="font-semibold text-[#514c70]">
          Loading business reports...
        </p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-lg font-extrabold text-red-600">
          Unable to load reports
        </h2>

        <p className="mt-2 text-sm text-[#77758d]">
          {error}
        </p>

        <button
          onClick={() => setPeriod((current) => current)}
          className="btn-primary mt-4 rounded-xl px-4 py-2 text-sm font-bold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-7">

      {/* PAGE HEADING */}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-[#302b50]">
            Business Reports
          </h1>

          <p className="mt-1 text-sm text-[#89869e]">
            Understand your business performance and financial activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          <div className="flex items-center gap-2 rounded-xl border border-purple-100 bg-white px-3 py-2.5">
            <CalendarDays size={17} className="text-purple-500" />

            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="bg-transparent text-sm font-semibold text-[#514c70] outline-none"
            >
              <option>This Year</option>
              <option>Last 6 Months</option>
              <option>Last 3 Months</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            disabled={!report}
            className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={17} />
            Export CSV
          </button>

        </div>
      </div>

      {loading && (
        <p className="text-sm font-medium text-purple-600">
          Updating reports...
        </p>
      )}

      {error && (
        <p className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

        <ReportCard
          title="Total Sales"
          value={formatCurrency(summary.totalSales)}
          subtitle="Completed sales for selected period"
          icon={TrendingUp}
          color="stat-purple text-purple-600"
        />

        <ReportCard
          title="Total Purchases"
          value={formatCurrency(summary.totalPurchases)}
          subtitle="Purchase expenses"
          icon={ShoppingBag}
          color="stat-blue text-blue-600"
        />

        <ReportCard
          title="Estimated Difference"
          value={formatCurrency(summary.estimatedProfit)}
          subtitle="Sales minus purchases"
          icon={IndianRupee}
          color="stat-green text-emerald-600"
        />

        <ReportCard
          title="Recorded Collections"
          value={formatCurrency(totalPayments)}
          subtitle="Actual payments received"
          icon={CreditCard}
          color="stat-orange text-orange-600"
        />

      </div>

      {/* SALES AND PURCHASE CHART */}

      <div className="glass-card p-5 md:p-6">

        <div className="mb-6">
          <h2 className="text-lg font-extrabold text-[#302b50]">
            Sales vs Purchases
          </h2>

          <p className="mt-1 text-sm text-[#89869e]">
            Monthly business performance
          </p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>

                <linearGradient id="purchaseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#eee9fa"
              />

              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#89869e", fontSize: 12 }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#89869e", fontSize: 12 }}
                tickFormatter={(value) => `₹${value / 1000}k`}
              />

              <Tooltip
                formatter={(value) => formatCurrency(value)}
              />

              <Legend />

              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="#8b5cf6"
                strokeWidth={3}
                fill="url(#salesGradient)"
              />

              <Area
                type="monotone"
                dataKey="purchases"
                name="Purchases"
                stroke="#10b981"
                strokeWidth={3}
                fill="url(#purchaseGradient)"
              />

            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* PAYMENT AND PRODUCT ANALYSIS */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* PAYMENT BREAKDOWN */}

        <div className="glass-card p-5 md:p-6">

          <h2 className="text-lg font-extrabold text-[#302b50]">
            Payment Breakdown
          </h2>

          <p className="mt-1 text-sm text-[#89869e]">
            Collections and outstanding credit
          </p>

          <div className="mt-5 grid grid-cols-1 items-center gap-4 md:grid-cols-2">

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData.filter((item) => item.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={5}
                  >
                    {paymentData
                      .filter((item) => item.value > 0)
                      .map((entry) => {
                        const index = paymentData.indexOf(entry);

                        return (
                          <Cell
                            key={entry.name}
                            fill={COLORS[index % COLORS.length]}
                          />
                        );
                      })}
                  </Pie>

                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                  />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              {paymentData.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />

                    <span className="text-sm font-semibold text-[#77758d]">
                      {item.name}
                    </span>
                  </div>

                  <span className="text-sm font-extrabold text-[#302b50]">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* PRODUCT QUANTITY */}

        <div className="glass-card p-5 md:p-6">

          <h2 className="text-lg font-extrabold text-[#302b50]">
            Product Sales Analysis
          </h2>

          <p className="mt-1 text-sm text-[#89869e]">
            Actual quantity sold by fertilizer
          </p>

          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData} barSize={32}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#eee9fa"
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#89869e", fontSize: 12 }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#89869e", fontSize: 12 }}
                />

                <Tooltip />

                <Bar
                  dataKey="quantity"
                  name="Quantity"
                  fill="#8b5cf6"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>

      </div>

      {/* BUSINESS INSIGHT */}

      <div className="glass-card overflow-hidden p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

          <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-emerald-500 p-4 text-white shadow-lg">
            <ChartNoAxesCombined size={28} />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-[#302b50]">
              Business Performance Overview
            </h2>

            <p className="mt-1 text-sm text-[#89869e]">
              Your estimated difference between sales and purchases is{" "}
              <span className="font-bold text-emerald-600">
                {formatCurrency(summary.estimatedProfit)}
              </span>{" "}
              for the selected period.
            </p>

            <p className="mt-2 text-xs text-[#aaa5bd]">
              This is not net profit. Operating expenses, taxes, inventory
              adjustments and other costs are not included.
            </p>
          </div>

        </div>
      </div>

      <p className="text-center text-xs text-[#aaa5bd]">
        Reports are generated from actual business records in your database.
      </p>

    </div>
  );
}

export default Reports;
