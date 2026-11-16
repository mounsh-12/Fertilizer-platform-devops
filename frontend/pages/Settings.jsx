
import { useEffect, useState } from "react";
import {
  Store,
  Phone,
  FileText,
  Settings as SettingsIcon,
  ShieldCheck,
  Save,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";

const defaultSettings = {
  business: {
    name: "Sri Byraweswara Traders",
    owner: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "Andhra Pradesh",
    pincode: "",
    gst: "",
  },
  invoice: {
    prefix: "SBT",
    nextNumber: "1001",
    footer: "Thank you for your business!",
    showLogo: true,
    showBusinessAddress: true,
    showFarmerPhone: true,
  },
  preferences: {
    currency: "INR",
    language: "English",
    dateFormat: "DD/MM/YYYY",
    notifications: true,
    lowStockAlerts: true,
  },
  security: {
    sessionTimeout: "30",
    confirmDelete: true,
    requireConfirmation: true,
  },
};

function InputField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#514c70]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-purple-300"
      />
    </div>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-purple-100 py-4 last:border-0">
      <div>
        <p className="text-sm font-bold text-[#514c70]">{label}</p>
        <p className="mt-1 text-xs text-[#9994ac]">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-purple-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function Settings() {
  const [activeTab, setActiveTab] = useState("Business Profile");
  const [business, setBusiness] = useState(defaultSettings.business);
  const [invoice, setInvoice] = useState(defaultSettings.invoice);
  const [preferences, setPreferences] = useState(defaultSettings.preferences);
  const [security, setSecurity] = useState(defaultSettings.security);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const token =
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken");

  const tabs = [
    { name: "Business Profile", icon: Store },
    { name: "Contact Information", icon: Phone },
    { name: "Invoice Preferences", icon: FileText },
    { name: "Application Preferences", icon: SettingsIcon },
    { name: "Security Settings", icon: ShieldCheck },
  ];

  const applySettings = (settings) => {
    setBusiness({
      ...defaultSettings.business,
      ...(settings.business || {}),
    });

    setInvoice({
      ...defaultSettings.invoice,
      ...(settings.invoice || {}),
    });

    setPreferences({
      ...defaultSettings.preferences,
      ...(settings.preferences || {}),
    });

    setSecurity({
      ...defaultSettings.security,
      ...(settings.security || {}),
    });
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError("");

        if (!token) {
          throw new Error("Admin token not found. Please log in again.");
        }

        const response = await fetch(`${API_BASE_URL}/api/settings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load settings.");
        }

        applySettings(data.settings || defaultSettings);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Settings loading error:", err);
          setError(err.message || "Unable to load settings.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => controller.abort();
  }, [token]);

  const updateBusiness = (field, value) => {
    setBusiness((previous) => ({ ...previous, [field]: value }));
    setSaved(false);
  };

  const updateInvoice = (field, value) => {
    setInvoice((previous) => ({ ...previous, [field]: value }));
    setSaved(false);
  };

  const updatePreferences = (field, value) => {
    setPreferences((previous) => ({ ...previous, [field]: value }));
    setSaved(false);
  };

  const updateSecurity = (field, value) => {
    setSecurity((previous) => ({ ...previous, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaved(false);
      setError("");

      if (!token) {
        throw new Error("Admin token not found. Please log in again.");
      }

      const settings = {
        business,
        invoice,
        preferences,
        security,
      };

      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save settings.");
      }

      applySettings(data.settings || settings);
      setSaved(true);
    } catch (err) {
      console.error("Settings save error:", err);
      setError(err.message || "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSaved(false);
    setError("");

    switch (activeTab) {
      case "Business Profile":
      case "Contact Information":
        setBusiness({ ...defaultSettings.business });
        break;

      case "Invoice Preferences":
        setInvoice({ ...defaultSettings.invoice });
        break;

      case "Application Preferences":
        setPreferences({ ...defaultSettings.preferences });
        break;

      case "Security Settings":
        setSecurity({ ...defaultSettings.security });
        break;

      default:
        break;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "Business Profile":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-[#302b50]">
                Business Profile
              </h3>
              <p className="mt-1 text-sm text-[#89869e]">
                Manage your business identity and registration details.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InputField
                label="Business Name"
                value={business.name}
                onChange={(v) => updateBusiness("name", v)}
                placeholder="Enter business name"
              />
              <InputField
                label="Owner Name"
                value={business.owner}
                onChange={(v) => updateBusiness("owner", v)}
                placeholder="Enter owner name"
              />
              <InputField
                label="GST Number"
                value={business.gst}
                onChange={(v) => updateBusiness("gst", v)}
                placeholder="Enter GST number"
              />
            </div>
          </div>
        );

      case "Contact Information":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-[#302b50]">
                Contact Information
              </h3>
              <p className="mt-1 text-sm text-[#89869e]">
                Manage your business contact and location details.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InputField
                label="Mobile Number"
                value={business.phone}
                onChange={(v) => updateBusiness("phone", v)}
                placeholder="Enter mobile number"
                type="tel"
              />
              <InputField
                label="Email Address"
                value={business.email}
                onChange={(v) => updateBusiness("email", v)}
                placeholder="Enter email address"
                type="email"
              />
              <div className="md:col-span-2">
                <InputField
                  label="Business Address"
                  value={business.address}
                  onChange={(v) => updateBusiness("address", v)}
                  placeholder="Enter full business address"
                />
              </div>
              <InputField
                label="City / Village"
                value={business.city}
                onChange={(v) => updateBusiness("city", v)}
                placeholder="Enter city or village"
              />
              <InputField
                label="State"
                value={business.state}
                onChange={(v) => updateBusiness("state", v)}
                placeholder="Enter state"
              />
              <InputField
                label="PIN Code"
                value={business.pincode}
                onChange={(v) => updateBusiness("pincode", v)}
                placeholder="Enter PIN code"
              />
            </div>
          </div>
        );

      case "Invoice Preferences":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-[#302b50]">
                Invoice Preferences
              </h3>
              <p className="mt-1 text-sm text-[#89869e]">
                Configure how your customer invoices should appear.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InputField
                label="Invoice Prefix"
                value={invoice.prefix}
                onChange={(v) => updateInvoice("prefix", v)}
                placeholder="SBT"
              />
              <InputField
                label="Next Invoice Number"
                value={invoice.nextNumber}
                onChange={(v) => updateInvoice("nextNumber", v)}
                placeholder="1001"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#514c70]">
                Invoice Footer Message
              </label>
              <textarea
                value={invoice.footer}
                onChange={(event) => updateInvoice("footer", event.target.value)}
                rows={3}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>

            <div className="rounded-2xl border border-purple-100 px-4">
              <Toggle
                label="Show Business Logo"
                description="Display your business logo on invoices."
                checked={invoice.showLogo}
                onChange={(v) => updateInvoice("showLogo", v)}
              />
              <Toggle
                label="Show Business Address"
                description="Include your business address on invoices."
                checked={invoice.showBusinessAddress}
                onChange={(v) => updateInvoice("showBusinessAddress", v)}
              />
              <Toggle
                label="Show Farmer Mobile Number"
                description="Display the farmer's mobile number."
                checked={invoice.showFarmerPhone}
                onChange={(v) => updateInvoice("showFarmerPhone", v)}
              />
            </div>
          </div>
        );

      case "Application Preferences":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-[#302b50]">
                Application Preferences
              </h3>
              <p className="mt-1 text-sm text-[#89869e]">
                Customize regional and notification preferences.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514c70]">
                  Currency
                </label>
                <select
                  value={preferences.currency}
                  onChange={(e) => updatePreferences("currency", e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                >
                  <option value="INR">Indian Rupee (₹)</option>
                  <option value="USD">US Dollar ($)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514c70]">
                  Language
                </label>
                <select
                  value={preferences.language}
                  onChange={(e) => updatePreferences("language", e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                >
                  <option>English</option>
                  <option>Telugu</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514c70]">
                  Date Format
                </label>
                <select
                  value={preferences.dateFormat}
                  onChange={(e) => updatePreferences("dateFormat", e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                >
                  <option>DD/MM/YYYY</option>
                  <option>MM/DD/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-purple-100 px-4">
              <Toggle
                label="Notifications"
                description="Enable application notifications."
                checked={preferences.notifications}
                onChange={(v) => updatePreferences("notifications", v)}
              />
              <Toggle
                label="Low Stock Alerts"
                description="Show alerts when fertilizer stock is low."
                checked={preferences.lowStockAlerts}
                onChange={(v) => updatePreferences("lowStockAlerts", v)}
              />
            </div>
          </div>
        );

      case "Security Settings":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-[#302b50]">
                Security Settings
              </h3>
              <p className="mt-1 text-sm text-[#89869e]">
                Configure basic application security preferences.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#514c70]">
                Session Timeout
              </label>
              <select
                value={security.sessionTimeout}
                onChange={(e) => updateSecurity("sessionTimeout", e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none md:w-1/2"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
                <option value="120">120 minutes</option>
              </select>
            </div>

            <div className="rounded-2xl border border-purple-100 px-4">
              <Toggle
                label="Confirm Before Deleting"
                description="Ask for confirmation before deleting records."
                checked={security.confirmDelete}
                onChange={(v) => updateSecurity("confirmDelete", v)}
              />
              <Toggle
                label="Confirm Important Actions"
                description="Require confirmation for important operations."
                checked={security.requireConfirmation}
                onChange={(v) => updateSecurity("requireConfirmation", v)}
              />
            </div>

            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              <ShieldCheck size={19} className="mb-2" />
              These settings are stored as preferences. Actual authentication,
              session expiration and access control must be enforced separately
              by the backend.
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="font-semibold text-[#514c70]">
          Loading application settings...
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold text-[#302b50]">
          Application Settings
        </h1>
        <p className="mt-1 text-sm text-[#89869e]">
          Manage your business profile and application preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
        <div className="glass-card p-3 lg:col-span-1">
          <p className="px-3 py-3 text-xs font-extrabold tracking-wider text-[#aaa5bd]">
            SETTINGS MENU
          </p>

          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.name;

              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                    active
                      ? "bg-purple-100 text-purple-700"
                      : "text-[#77758d] hover:bg-purple-50"
                  }`}
                >
                  <Icon size={18} />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-5 md:p-7 lg:col-span-3">
          {renderContent()}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-purple-100 pt-6">
            <button
              onClick={handleReset}
              disabled={saving}
              className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              <RotateCcw size={16} />
              Reset Section
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <Save size={17} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {saved && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={18} />
              Settings saved successfully to the database.
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[#aaa5bd]">
        Settings are saved securely in your application database.
      </p>
    </div>
  );
}

export default Settings;
