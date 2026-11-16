
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Truck,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  X,
  Users,
  IndianRupee,
  ShoppingBag,
  Building2,
  UserRound,
} from "lucide-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5001"
).replace(/\/$/, "");

const emptyForm = {
  name: "",
  contact: "",
  phone: "",
  email: "",
  location: "",
};

function getToken() {
  return (
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token")
  );
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("Your admin session has expired. Please log in again.");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || data.success === false) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failed. Please log in again.");
    }

    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data;
}

function mapSupplier(item) {
  return {
    id: item.supplier_id,
    name: item.supplier_name || item.company_name || "Unnamed supplier",
    companyName: item.company_name || "",
    contact: item.contact_person || "—",
    phone: item.mobile_number || "—",
    email: item.email || "—",
    location: item.address || "—",
    gstNumber: item.gst_number || "",
    purchases: Number(item.total_purchases || 0),
    outstanding: Number(item.outstanding_amount || 0),
    status: Number(item.is_active) === 1 || item.is_active === true
      ? "Active"
      : "Inactive",
  };
}

const formatCurrency = (amount) =>
  `₹${Number(amount).toLocaleString("en-IN")}`;

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest("/api/suppliers");
      setSuppliers((data.suppliers || []).map(mapSupplier));
    } catch (err) {
      setError(err.message || "Unable to load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) =>
      `${supplier.name} ${supplier.contact} ${supplier.phone}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [suppliers, search]);

  const totalPurchases = suppliers.reduce(
    (sum, supplier) => sum + supplier.purchases,
    0
  );

  const totalOutstanding = suppliers.reduce(
    (sum, supplier) => sum + supplier.outstanding,
    0
  );

  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.status === "Active"
  ).length;

  const openAddForm = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (supplier) => {
    setEditingSupplier(supplier);

    setForm({
      name: supplier.name,
      contact: supplier.contact,
      phone: supplier.phone,
      email: supplier.email,
      location: supplier.location,
    });

    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    const payload = {
      supplier_name: form.name.trim(),
      company_name: form.name.trim(),
      contact_person: form.contact.trim(),
      mobile_number: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.location.trim(),
    };

    try {
      setSaving(true);

      if (editingSupplier) {
        await apiRequest(`/api/suppliers/${editingSupplier.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice("Supplier updated successfully.");
      } else {
        await apiRequest("/api/suppliers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Supplier added successfully.");
      }

      setShowForm(false);
      setEditingSupplier(null);
      setForm(emptyForm);
      await loadSuppliers();
    } catch (err) {
      setError(err.message || "Unable to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = async (supplier) => {
    const nextActiveState = supplier.status !== "Active";
    const action = nextActiveState ? "activate" : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${supplier.name}?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await apiRequest(`/api/suppliers/${supplier.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActiveState }),
      });

      setNotice(`Supplier ${nextActiveState ? "activated" : "deactivated"} successfully.`);
      await loadSuppliers();
    } catch (err) {
      setError(err.message || `Unable to ${action} supplier.`);
    }
  };

  return (
    <div className="animate-fade-in space-y-7">

      {/* PAGE HEADER */}

      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <Truck size={17} />
            BUSINESS MANAGEMENT
          </div>

          <h1 className="text-2xl font-bold text-[#302b50] md:text-3xl">
            Suppliers
          </h1>

          <p className="mt-2 text-sm text-[#89869e]">
            Manage supplier relationships, purchases and outstanding payments.
          </p>
        </div>

        <button onClick={openAddForm} className="btn-primary">
          <Plus size={18} />
          Add Supplier
        </button>
      </section>

      {(error || notice) && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm font-medium ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || notice}
        </div>
      )}

      {loading && (
        <div className="glass-card p-6 text-center text-sm text-[#77758d]">
          Loading suppliers from the database...
        </div>
      )}

      {/* SUMMARY CARDS */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-purple-100 p-3 text-purple-600">
            <Users size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Total Suppliers</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {suppliers.length}
            </h2>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <ShoppingBag size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Total Purchases</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {formatCurrency(totalPurchases)}
            </h2>
          </div>
        </div>

        <div className="glass-card flex items-center gap-4 p-5">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <IndianRupee size={25} />
          </div>

          <div>
            <p className="text-sm text-[#89869e]">Outstanding Payments</p>
            <h2 className="mt-1 text-2xl font-bold text-[#302b50]">
              {formatCurrency(totalOutstanding)}
            </h2>
          </div>
        </div>

      </section>

      {/* SEARCH */}

      <section className="glass-card p-5">
        <div className="flex items-center gap-3 rounded-xl border border-purple-100 bg-white/80 px-4 py-3">
          <Search size={19} className="text-purple-400" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search supplier, contact person or phone..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa5bd]"
          />
        </div>
      </section>

      {/* SUPPLIER DIRECTORY */}

      <section>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#302b50]">
              Supplier Directory
            </h2>

            <p className="mt-1 text-sm text-[#89869e]">
              Showing {filteredSuppliers.length} suppliers
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            {activeSuppliers} Active Suppliers
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="glass-card p-5 transition duration-300 hover:-translate-y-1 md:p-6"
            >

              {/* SUPPLIER HEADER */}

              <div className="flex items-start justify-between gap-3">

                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-400 to-violet-600 text-white shadow-lg shadow-purple-200">
                    <Building2 size={26} />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#302b50]">
                      {supplier.name}
                    </h3>

                    <p className="mt-1 text-xs text-[#89869e]">
                      Supplier ID: SUP-{String(supplier.id).padStart(3, "0")}
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    supplier.status === "Active"
                      ? "badge-success"
                      : "badge-warning"
                  }`}
                >
                  {supplier.status}
                </span>

              </div>

              {/* CONTACT DETAILS */}

              <div className="mt-6 space-y-3">

                <div className="flex items-center gap-3 text-sm text-[#77758d]">
                  <UserRound size={17} className="text-purple-500" />
                  {supplier.contact}
                </div>

                <div className="flex items-center gap-3 text-sm text-[#77758d]">
                  <Phone size={17} className="text-emerald-500" />
                  {supplier.phone}
                </div>

                <div className="flex items-center gap-3 text-sm text-[#77758d]">
                  <Mail size={17} className="text-orange-500" />
                  <span className="break-all">{supplier.email}</span>
                </div>

                <div className="flex items-center gap-3 text-sm text-[#77758d]">
                  <MapPin size={17} className="text-blue-500" />
                  {supplier.location}
                </div>

              </div>

              {/* FINANCIAL DETAILS */}

              <div className="mt-6 grid grid-cols-2 gap-3">

                <div className="rounded-2xl bg-purple-50/80 p-4">
                  <p className="text-xs text-[#89869e]">
                    Total Purchases
                  </p>

                  <p className="mt-2 text-lg font-bold text-[#39364f]">
                    {formatCurrency(supplier.purchases)}
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50/80 p-4">
                  <p className="text-xs text-[#89869e]">
                    Outstanding
                  </p>

                  <p className="mt-2 text-lg font-bold text-orange-600">
                    {formatCurrency(supplier.outstanding)}
                  </p>
                </div>

              </div>

              {/* ACTIONS */}

              <div className="mt-5 flex justify-end gap-2 border-t border-purple-100 pt-4">

                <button
                  onClick={() => openEditForm(supplier)}
                  className="flex items-center gap-2 rounded-xl bg-purple-50 px-4 py-2.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100"
                >
                  <Pencil size={15} />
                  Edit
                </button>

                <button
                  onClick={() => deleteSupplier(supplier)}
                  className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-500 transition hover:bg-rose-100"
                >
                  <Trash2 size={15} />
                  {supplier.status === "Active" ? "Deactivate" : "Activate"}
                </button>

              </div>

            </div>
          ))}

        </div>

        {!loading && filteredSuppliers.length === 0 && (
          <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
            <Truck size={38} className="text-purple-300" />

            <h3 className="mt-4 font-bold text-[#302b50]">
              No suppliers found
            </h3>

            <p className="mt-2 text-sm text-[#89869e]">
              Try another search or add a new supplier.
            </p>
          </div>
        )}

      </section>

      {/* ADD / EDIT SUPPLIER MODAL */}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-purple-950/30 p-4 backdrop-blur-sm">

          <div className="glass-panel my-auto w-full max-w-lg p-6 md:p-7">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#302b50]">
                  {editingSupplier ? "Edit Supplier" : "Add Supplier"}
                </h2>

                <p className="mt-1 text-sm text-[#89869e]">
                  Enter supplier contact information.
                </p>
              </div>

              <button
                onClick={() => !saving && setShowForm(false)}
                aria-label="Close form"
                className="rounded-xl bg-purple-50 p-2 text-purple-600"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Supplier / Company Name
                </label>

                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Enter company name"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Contact Person
                </label>

                <input
                  required
                  value={form.contact}
                  onChange={(event) =>
                    setForm({ ...form, contact: event.target.value })
                  }
                  placeholder="Enter contact person"
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
                  maxLength={10}
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="10-digit mobile number"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Email Address
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="supplier@example.com"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#625d7b]">
                  Location
                </label>

                <input
                  required
                  value={form.location}
                  onChange={(event) =>
                    setForm({ ...form, location: event.target.value })
                  }
                  placeholder="City, State"
                  className="glass-input"
                />
              </div>

              <div className="flex gap-3 pt-3">

                <button
                  type="button"
                  onClick={() => !saving && setShowForm(false)}
                  disabled={saving}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  <Plus size={17} />
                  {saving ? "Saving..." : editingSupplier ? "Save Changes" : "Add Supplier"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
