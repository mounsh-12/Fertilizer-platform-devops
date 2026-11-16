
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  IndianRupee,
  ShoppingBag,
  Clock,
  Pencil,
  Trash2,
  X,
  Sprout,
  Eye,
  UserCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5001"
).replace(/\/$/, "");

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

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

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        status === "Active" ? "badge-success" : "badge-danger"
      }`}
    >
      {status}
    </span>
  );
}

function normalizeFarmer(item) {
  return {
    id: Number(item.farmer_id),
    name: item.farmer_name || "",
    phone: item.mobile_number || "",
    village: item.village || "",
    address: item.address || "",
    purchases: Number(item.purchase_count || 0),
    totalPurchases: Number(item.total_purchases || 0),
    totalPaid: Number(item.total_paid || 0),
    outstanding: Number(item.outstanding || 0),
    status: Number(item.is_active) === 1 ? "Active" : "Inactive",
  };
}

export default function Farmers() {
  const [farmers, setFarmers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const emptyForm = {
    name: "",
    phone: "",
    village: "",
    address: "",
    status: "Active",
  };

  const [form, setForm] = useState(emptyForm);

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
      throw new Error(data.message || "Something went wrong.");
    }

    return data;
  }, []);

  const loadFarmers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await request("/api/farmers");

      setFarmers(
        Array.isArray(data.farmers)
          ? data.farmers.map(normalizeFarmer)
          : []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadFarmers();
  }, [loadFarmers]);

  const totalOutstanding = farmers.reduce(
    (sum, farmer) => sum + farmer.outstanding,
    0
  );

  const totalPurchases = farmers.reduce(
    (sum, farmer) => sum + farmer.totalPurchases,
    0
  );

  const activeFarmers = farmers.filter(
    (farmer) => farmer.status === "Active"
  ).length;

  const filteredFarmers = useMemo(() => {
    return farmers.filter((farmer) => {
      const matchesSearch = [
        farmer.name,
        farmer.phone,
        farmer.village,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        filter === "All" || farmer.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [farmers, search, filter]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (farmer) => {
    setEditingId(farmer.id);

    setForm({
      name: farmer.name,
      phone: farmer.phone,
      village: farmer.village,
      address: farmer.address,
      status: farmer.status,
    });

    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();
    const village = form.village.trim();
    const address = form.address.trim();

    if (!name || !village || !/^[6-9]\d{9}$/.test(phone)) {
      alert(
        "Enter a valid name, village and 10-digit Indian mobile number."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        farmer_name: name,
        mobile_number: phone,
        village,
        address,
      };

      if (editingId) {
        await request(`/api/farmers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        const currentlyActive = farmers.find(
          (farmer) => farmer.id === editingId
        )?.status === "Active";

        const shouldBeActive = form.status === "Active";

        if (currentlyActive !== shouldBeActive) {
          await request(`/api/farmers/${editingId}/status`, {
            method: "PATCH",
            body: JSON.stringify({
              is_active: shouldBeActive,
            }),
          });
        }
      } else {
        const result = await request("/api/farmers", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (form.status === "Inactive" && result.farmer_id) {
          await request(`/api/farmers/${result.farmer_id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ is_active: false }),
          });
        }
      }

      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadFarmers();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (farmer) => {
    const shouldActivate = farmer.status === "Inactive";

    const confirmed = window.confirm(
      shouldActivate
        ? `Activate ${farmer.name}?`
        : `Deactivate ${farmer.name}?`
    );

    if (!confirmed) return;

    try {
      await request(`/api/farmers/${farmer.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: shouldActivate,
        }),
      });

      await loadFarmers();
    } catch (err) {
      alert(err.message);
    }
  };

  const openDetails = (farmer) => {
    setSelectedFarmer(farmer);
    setShowDetails(true);
  };

  return (
    <div className="animate-fade-in space-y-7">
      {/* HEADER */}
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <Sprout size={17} />
            BUSINESS MANAGEMENT
          </div>

          <h1 className="text-2xl font-bold text-[#302b50] md:text-3xl">
            Farmers Management
          </h1>

          <p className="mt-2 text-sm text-[#89869e]">
            Manage farmer information, purchase records and credit balances.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadFarmers}
            disabled={loading}
            className="btn-secondary"
            title="Refresh farmers"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>

          <button onClick={openAddModal} className="btn-primary">
            <UserPlus size={18} />
            Add Farmer
          </button>
        </div>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            onClick={loadFarmers}
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
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Total Farmers</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {farmers.length}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Registered farmers
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Active Farmers</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {activeFarmers}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Currently active
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Outstanding Credits</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(totalOutstanding)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Amount to be collected
            </p>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-sm text-[#89869e]">Total Purchases</p>
            <h2 className="mt-1 text-xl font-bold text-[#302b50]">
              {formatCurrency(totalPurchases)}
            </h2>
            <p className="mt-1 text-xs text-[#9994ac]">
              Across all farmers
            </p>
          </div>
        </div>
      </section>

      {/* FARMER DIRECTORY */}
      <section className="glass-card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Farmer Directory
            </h2>
            <p className="mt-1 text-sm text-[#89869e]">
              Search and manage registered farmers.
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
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-y border-purple-100 bg-purple-50/50 text-xs uppercase tracking-wider text-[#9691a8]">
                <th className="px-6 py-4 font-semibold">Farmer</th>
                <th className="px-6 py-4 font-semibold">Mobile</th>
                <th className="px-6 py-4 font-semibold">Village</th>
                <th className="px-6 py-4 font-semibold">Purchases</th>
                <th className="px-6 py-4 font-semibold">Total Value</th>
                <th className="px-6 py-4 font-semibold">Outstanding</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-[#89869e]">
                    Loading farmers...
                  </td>
                </tr>
              ) : filteredFarmers.map((farmer) => (
                <tr
                  key={farmer.id}
                  className="border-b border-purple-50 text-sm transition hover:bg-white/60"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-green-500 font-bold text-white shadow-sm">
                        {farmer.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-[#39364f]">
                        {farmer.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[#77758d]">
                      <Phone size={15} className="text-purple-400" />
                      {farmer.phone}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[#77758d]">
                      <MapPin size={15} className="text-purple-400" />
                      {farmer.village || "—"}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-[#77758d]">
                    {farmer.purchases}
                  </td>

                  <td className="px-6 py-4 font-semibold text-[#39364f]">
                    {formatCurrency(farmer.totalPurchases)}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`font-bold ${
                        farmer.outstanding > 0
                          ? "text-orange-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {formatCurrency(farmer.outstanding)}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <StatusBadge status={farmer.status} />
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDetails(farmer)}
                        title="View farmer"
                        aria-label={`View ${farmer.name}`}
                        className="rounded-lg bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        onClick={() => openEditModal(farmer)}
                        title="Edit farmer"
                        aria-label={`Edit ${farmer.name}`}
                        className="rounded-lg bg-purple-50 p-2 text-purple-600 transition hover:bg-purple-100"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        onClick={() => handleStatusChange(farmer)}
                        title={farmer.status === "Active" ? "Deactivate farmer" : "Activate farmer"}
                        aria-label={`${farmer.status === "Active" ? "Deactivate" : "Activate"} ${farmer.name}`}
                        className={`rounded-lg p-2 transition ${
                          farmer.status === "Active"
                            ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        }`}
                      >
                        {farmer.status === "Active" ? (
                          <Trash2 size={16} />
                        ) : (
                          <UserCheck size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredFarmers.length === 0 && (
          <div className="p-12 text-center">
            <Users size={35} className="mx-auto text-purple-300" />
            <p className="mt-3 font-bold text-[#302b50]">
              No farmers found
            </p>
            <p className="mt-1 text-sm text-[#89869e]">
              {farmers.length === 0
                ? "Register your first farmer to get started."
                : "Try another search or filter."}
            </p>
          </div>
        )}
      </section>

      {/* ADD / EDIT FARMER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">
          <div className="glass-panel my-auto w-full max-w-lg p-6 md:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#302b50]">
                  {editingId ? "Edit Farmer" : "Register New Farmer"}
                </h2>
                <p className="mt-1 text-sm text-[#89869e]">
                  Enter the farmer's contact information.
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
                  Farmer Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Enter farmer name"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Mobile Number
                </label>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="10-digit mobile number"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Village
                </label>
                <input
                  required
                  value={form.village}
                  onChange={(event) =>
                    setForm({ ...form, village: event.target.value })
                  }
                  placeholder="Enter village name"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Address
                </label>
                <textarea
                  value={form.address}
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                  placeholder="Enter address (optional)"
                  rows={2}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                  className="glass-input"
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>

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
                  disabled={saving}
                >
                  <UserPlus size={17} />
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Farmer"
                      : "Register Farmer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FARMER DETAILS MODAL */}
      {showDetails && selectedFarmer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">
          <div className="glass-panel my-auto w-full max-w-lg p-6 md:p-7">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#302b50]">
                Farmer Details
              </h2>

              <button
                onClick={() => setShowDetails(false)}
                aria-label="Close details"
                className="rounded-xl bg-purple-50 p-2 text-purple-600"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-purple-50 p-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 text-xl font-bold text-white">
                {selectedFarmer.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#302b50]">
                  {selectedFarmer.name}
                </h3>
                <StatusBadge status={selectedFarmer.status} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <span className="flex items-center gap-2 text-sm text-[#89869e]">
                  <Phone size={16} />
                  Mobile
                </span>
                <span className="font-semibold text-[#39364f]">
                  {selectedFarmer.phone}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <span className="flex items-center gap-2 text-sm text-[#89869e]">
                  <MapPin size={16} />
                  Village
                </span>
                <span className="font-semibold text-[#39364f]">
                  {selectedFarmer.village || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <span className="flex items-center gap-2 text-sm text-[#89869e]">
                  <ShoppingBag size={16} />
                  Purchase Count
                </span>
                <span className="font-semibold text-[#39364f]">
                  {selectedFarmer.purchases}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <span className="flex items-center gap-2 text-sm text-[#89869e]">
                  <IndianRupee size={16} />
                  Total Purchases
                </span>
                <span className="font-bold text-[#39364f]">
                  {formatCurrency(selectedFarmer.totalPurchases)}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <span className="flex items-center gap-2 text-sm text-[#89869e]">
                  <IndianRupee size={16} />
                  Total Paid
                </span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(selectedFarmer.totalPaid)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-[#89869e]">
                  <Clock size={16} />
                  Outstanding Credit
                </span>
                <span className="font-bold text-orange-600">
                  {formatCurrency(selectedFarmer.outstanding)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowDetails(false)}
              className="btn-primary mt-7 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
