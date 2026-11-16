
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  IndianRupee,
  Package,
  ShoppingBag,
  Wallet,
  Boxes,
  AlertTriangle,
  Clock,
  Users,
  Sparkles,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardIllustration from "../components/DashboardIllustration";

// DEMONSTRATION DATA — We will connect the database later.

const revenueData = [
  { month: "Jan", revenue: 32000 },
  { month: "Feb", revenue: 41000 },
  { month: "Mar", revenue: 36000 },
  { month: "Apr", revenue: 52000 },
  { month: "May", revenue: 47000 },
  { month: "Jun", revenue: 65000 },
  { month: "Jul", revenue: 58000 },
  { month: "Aug", revenue: 74000 },
  { month: "Sep", revenue: 68000 },
  { month: "Oct", revenue: 89000 },
  { month: "Nov", revenue: 82000 },
  { month: "Dec", revenue: 98000 },
];

const transactions = [
  {
    id: "INV-1025",
    farmer: "Ramesh Kumar",
    product: "Urea Fertilizer",
    amount: 12500,
    status: "Paid",
    date: "Today, 10:30 AM",
  },
  {
    id: "INV-1024",
    farmer: "Suresh Reddy",
    product: "DAP Fertilizer",
    amount: 8500,
    status: "Credit",
    date: "Today, 09:15 AM",
  },
  {
    id: "INV-1023",
    farmer: "Ravi Kumar",
    product: "MOP Fertilizer",
    amount: 6200,
    status: "Paid",
    date: "Yesterday",
  },
  {
    id: "INV-1022",
    farmer: "Venkat Reddy",
    product: "NPK Fertilizer",
    amount: 15800,
    status: "Paid",
    date: "Yesterday",
  },
];

const stockAlerts = [
  {
    name: "Urea",
    quantity: "8 bags left",
    level: "Low",
    color: "bg-orange-400",
    width: "40%",
  },
  {
    name: "DAP",
    quantity: "12 bags left",
    level: "Low",
    color: "bg-yellow-400",
    width: "40%",
  },
  {
    name: "MOP",
    quantity: "6 bags left",
    level: "Critical",
    color: "bg-rose-400",
    width: "20%",
  },
];

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  theme,
  positive = true,
  description,
}) {
  return (
    <div className={`stat-card ${theme} animate-fade-in`}>
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/85">
            {title}
          </p>

          <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
            {value}
          </h2>

          <p className="mt-3 flex items-center gap-1 text-xs text-white/90">
            {positive ? (
              <ArrowUpRight size={15} />
            ) : (
              <ArrowDownRight size={15} />
            )}

            <span className="font-semibold">{change}</span>

            <span className="text-white/75">{description}</span>
          </p>
        </div>

        <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-md">
          <Icon size={25} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-[#29263f]">
          {title}
        </h2>

        <p className="mt-1 text-sm text-[#89869e]">
          {subtitle}
        </p>
      </div>

      {action}
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="animate-fade-in space-y-7">

      {/* =================================
          WELCOME BANNER
      ================================= */}

      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#7958df] via-[#8b69e9] to-[#b07bea] p-6 text-white shadow-xl shadow-purple-200/60 md:p-8">

        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

        <div className="absolute -bottom-24 right-40 h-52 w-52 rounded-full bg-pink-300/20 blur-3xl" />

        <div className="relative z-10 flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">

          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
              <Sparkles size={14} />
              Business Overview
            </div>

            <h1 className="text-2xl font-bold md:text-3xl">
              Welcome back, Admin! 👋
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/80">
              Here's what's happening with Sri Byraweswara Traders
              today. Keep track of your sales, inventory and
              business performance.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#704ed5] shadow-lg transition hover:-translate-y-1">
                <ShoppingBag size={17} />
                Create New Sale
              </button>

              <button className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20">
                <Package size={17} />
                Manage Inventory
              </button>
            </div>
          </div>

          {/* CUSTOM 3D ILLUSTRATION */}
          <div className="mx-auto w-full max-w-[280px] shrink-0 md:mx-0">
            <DashboardIllustration />
          </div>

        </div>
      </section>

      {/* =================================
          BUSINESS STATISTICS
      ================================= */}

      <section>
        <SectionTitle
          title="Business Overview"
          subtitle="Your business performance at a glance"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            title="Total Revenue"
            value="₹2,45,800"
            change="+12.8%"
            description="vs last month"
            icon={IndianRupee}
            theme="stat-purple"
          />

          <StatCard
            title="Total Sales"
            value="148"
            change="+8.2%"
            description="vs last month"
            icon={ShoppingBag}
            theme="stat-green"
          />

          <StatCard
            title="Pending Credits"
            value="₹42,800"
            change="Needs attention"
            description="from farmers"
            icon={Wallet}
            theme="stat-orange"
            positive={false}
          />

          <StatCard
            title="Inventory Value"
            value="₹3,85,000"
            change="+5.4%"
            description="vs last month"
            icon={Boxes}
            theme="stat-blue"
          />

        </div>
      </section>

      {/* =================================
          REVENUE CHART AND STOCK ALERTS
      ================================= */}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* REVENUE ANALYTICS */}

        <div className="glass-card p-5 md:p-6 xl:col-span-2">

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#29263f]">
                Revenue Analytics
              </h2>

              <p className="mt-1 text-sm text-[#89869e]">
                Monthly revenue performance
              </p>
            </div>

            <div className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700">
              This Year
            </div>
          </div>

          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>

                <defs>
                  <linearGradient
                    id="revenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#9273f2"
                      stopOpacity={0.35}
                    />

                    <stop
                      offset="95%"
                      stopColor="#9273f2"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#eeeaf7"
                />

                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9994ac", fontSize: 12 }}
                  dy={10}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9994ac", fontSize: 11 }}
                  tickFormatter={(value) => `₹${value / 1000}k`}
                />

                <Tooltip
                  formatter={(value) => [
                    `₹${Number(value).toLocaleString("en-IN")}`,
                    "Revenue",
                  ]}
                  contentStyle={{
                    borderRadius: "14px",
                    border: "1px solid #eeeaf7",
                    boxShadow: "0 8px 25px rgba(70,50,120,0.1)",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8060e8"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                  activeDot={{
                    r: 6,
                    fill: "#8060e8",
                  }}
                />

              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* STOCK ALERTS */}

        <div className="glass-card p-5 md:p-6">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#29263f]">
                Stock Alerts
              </h2>

              <p className="mt-1 text-sm text-[#89869e]">
                Products requiring attention
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 p-3 text-orange-500">
              <AlertTriangle size={21} />
            </div>
          </div>

          <div className="space-y-4">
            {stockAlerts.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-[#f0edf7] bg-white/65 p-4"
              >

                <div className="flex items-center justify-between gap-2">

                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600">
                      <Package size={19} />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#39364f]">
                        {item.name}
                      </h3>

                      <p className="mt-1 text-xs text-[#9994ac]">
                        {item.quantity}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      item.level === "Critical"
                        ? "badge-danger"
                        : "badge-warning"
                    }`}
                  >
                    {item.level}
                  </span>

                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f0edf7]">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: item.width }}
                  />
                </div>

              </div>
            ))}
          </div>

          <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-50 py-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-100">
            View All Inventory
            <ArrowRight size={16} />
          </button>

        </div>
      </section>

      {/* =================================
          RECENT TRANSACTIONS
      ================================= */}

      <section className="glass-card overflow-hidden">

        <div className="flex flex-wrap items-center justify-between gap-3 p-5 md:p-6">

          <div>
            <h2 className="text-lg font-bold text-[#29263f]">
              Recent Transactions
            </h2>

            <p className="mt-1 text-sm text-[#89869e]">
              Latest sales from your business
            </p>
          </div>

          <button className="flex items-center gap-2 rounded-xl bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-100">
            View All
            <ArrowRight size={16} />
          </button>

        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left">

            <thead>
              <tr className="border-y border-[#f0edf7] bg-white/40 text-xs uppercase tracking-wider text-[#9691a8]">
                <th className="px-6 py-4 font-semibold">Invoice</th>
                <th className="px-6 py-4 font-semibold">Farmer</th>
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Date</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-b border-[#f4f1f9] text-sm transition hover:bg-white/60"
                >

                  <td className="px-6 py-4 font-semibold text-purple-700">
                    {transaction.id}
                  </td>

                  <td className="px-6 py-4 font-medium text-[#39364f]">
                    {transaction.farmer}
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {transaction.product}
                  </td>

                  <td className="px-6 py-4 font-semibold text-[#39364f]">
                    ₹{transaction.amount.toLocaleString("en-IN")}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        transaction.status === "Paid"
                          ? "badge-success"
                          : "badge-warning"
                      }`}
                    >
                      {transaction.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-xs text-[#9994ac]">
                    {transaction.date}
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </section>

      {/* =================================
          QUICK ACTIONS
      ================================= */}

      <section>

        <SectionTitle
          title="Quick Actions"
          subtitle="Frequently used business operations"
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

          {[
            {
              title: "New Sale",
              subtitle: "Create a farmer bill",
              icon: ShoppingBag,
              color: "text-purple-600",
              bg: "bg-purple-100",
            },
            {
              title: "Add Fertilizer",
              subtitle: "Register a product",
              icon: Package,
              color: "text-emerald-600",
              bg: "bg-emerald-100",
            },
            {
              title: "Add Farmer",
              subtitle: "Register a farmer",
              icon: Users,
              color: "text-orange-600",
              bg: "bg-orange-100",
            },
            {
              title: "Payments",
              subtitle: "Manage collections",
              icon: Wallet,
              color: "text-blue-600",
              bg: "bg-blue-100",
            },
          ].map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.title}
                className="glass-card p-5 text-left transition hover:-translate-y-1"
              >

                <div
                  className={`mb-4 inline-flex rounded-2xl p-3 ${action.bg} ${action.color}`}
                >
                  <Icon size={23} />
                </div>

                <h3 className="text-sm font-bold text-[#39364f]">
                  {action.title}
                </h3>

                <p className="mt-1 text-xs text-[#9994ac]">
                  {action.subtitle}
                </p>

              </button>
            );
          })}

        </div>
      </section>

      {/* =================================
          FOOTER
      ================================= */}

      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 text-xs text-[#9994ac]">
        <p>© Sri Byraweswara Traders</p>

        <p className="flex items-center gap-2">
          <Clock size={13} />
          Dashboard Overview
        </p>
      </div>

    </div>
  );
}
