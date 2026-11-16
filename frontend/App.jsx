
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Package,
  Truck,
  Boxes,
  ShoppingCart,
  Users,
  Receipt,
  Wallet,
  CreditCard,
  FileText,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  Sprout,
  LogOut,
} from "lucide-react";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Fertilizers from "./pages/Fertilizers";
import Suppliers from "./pages/Suppliers";
import Inventory from "./pages/Inventory";
import Purchases from "./pages/Purchases";
import Farmers from "./pages/Farmers";
import Sales from "./pages/Sales";
import Payments from "./pages/Payments";
import FarmerCredits from "./pages/FarmerCredits";
import Invoices from "./pages/Invoices";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

import { loginAdmin, getAdminProfile } from "./services/authService";

const navigationSections = [
  {
    title: "OVERVIEW",
    items: [
      { name: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "BUSINESS MANAGEMENT",
    items: [
      { name: "Fertilizers", icon: Package },
      { name: "Suppliers", icon: Truck },
      { name: "Inventory", icon: Boxes },
      { name: "Purchases", icon: ShoppingCart },
      { name: "Farmers", icon: Users },
    ],
  },
  {
    title: "FINANCIAL MANAGEMENT",
    items: [
      { name: "Sales", icon: Receipt },
      { name: "Payments", icon: Wallet },
      { name: "Farmer Credits", icon: CreditCard },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { name: "Invoices", icon: FileText },
      { name: "Reports", icon: BarChart3 },
    ],
  },
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [adminDetails, setAdminDetails] = useState(null);

  // Restore and verify an existing administrator session.
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const token =
        localStorage.getItem("adminToken") ||
        sessionStorage.getItem("adminToken");

      const savedDetails =
        localStorage.getItem("adminDetails") ||
        sessionStorage.getItem("adminDetails");

      if (!token) {
        if (isMounted) setIsCheckingSession(false);
        return;
      }

      try {
        const profile = await getAdminProfile(token);

        let parsedDetails = null;
        try {
          parsedDetails = savedDetails ? JSON.parse(savedDetails) : null;
        } catch {
          parsedDetails = null;
        }

        const verifiedAdmin = profile?.admin || profile?.data?.admin || parsedDetails;

        if (isMounted) {
          setAdminDetails(verifiedAdmin || null);
          setIsAuthenticated(true);
        }
      } catch (error) {
        localStorage.removeItem("adminToken");
        sessionStorage.removeItem("adminToken");
        localStorage.removeItem("adminDetails");
        sessionStorage.removeItem("adminDetails");

        if (isMounted) {
          setAdminDetails(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Authenticate admin through the backend.
  const handleLogin = async ({ identifier, password, rememberMe }) => {
    const data = await loginAdmin(identifier, password);

    if (!data?.token || !data?.admin) {
      throw new Error("The server returned an incomplete login response.");
    }

    const storage = rememberMe ? localStorage : sessionStorage;

    // Remove any previous login session before saving the new one.
    localStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminToken");
    localStorage.removeItem("adminDetails");
    sessionStorage.removeItem("adminDetails");

    storage.setItem("adminToken", data.token);
    storage.setItem("adminDetails", JSON.stringify(data.admin));

    setAdminDetails(data.admin);
    setIsAuthenticated(true);
    setActivePage("Dashboard");
  };

  // Logout admin and clear authentication data.
  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminToken");
    localStorage.removeItem("adminDetails");
    sessionStorage.removeItem("adminDetails");

    setAdminDetails(null);
    setIsAuthenticated(false);
    setActivePage("Dashboard");
    setSidebarOpen(false);
    setSearchTerm("");
  };

  // Handle sidebar navigation.
  const handleNavigation = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  // Render selected page.
  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return <Dashboard />;

      case "Fertilizers":
        return <Fertilizers />;

      case "Suppliers":
        return <Suppliers />;

      case "Inventory":
        return <Inventory />;

      case "Purchases":
        return <Purchases />;

      case "Farmers":
        return <Farmers />;

      case "Sales":
        return <Sales />;

      case "Payments":
        return <Payments />;

      case "Farmer Credits":
        return <FarmerCredits />;

      case "Invoices":
        return <Invoices />;

      case "Reports":
        return <Reports />;

      case "Settings":
        return <Settings />;

      default:
        return (
          <div className="glass-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
              <SettingsIcon size={30} />
            </div>

            <h2 className="text-xl font-extrabold text-[#302b50]">
              {activePage}
            </h2>

            <p className="mt-2 text-sm text-[#89869e]">
              This section will be developed in an upcoming step.
            </p>
          </div>
        );
    }
  };

  // Show a loading screen while an existing token is verified.
  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f2ff]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
          <p className="text-sm font-semibold text-[#514c70]">
            Verifying administrator session...
          </p>
        </div>
      </div>
    );
  }

  // Show login before the main application.
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f2ff]">

      {/* MOBILE OVERLAY */}

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-purple-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-purple-100 bg-white/90 shadow-xl backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >

        {/* LOGO */}

        <div className="flex h-20 items-center justify-between border-b border-purple-100 px-6">

          <div className="flex items-center gap-3">

            <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-emerald-500 p-2.5 text-white shadow-lg">
              <Sprout size={25} />
            </div>

            <div>
              <h1 className="text-sm font-extrabold text-[#302b50]">
                Sri Byraweswara
              </h1>

              <p className="text-xs font-semibold text-purple-500">
                TRADERS
              </p>
            </div>

          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-gray-500 hover:bg-purple-50 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>

        </div>

        {/* NAVIGATION */}

        <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">

          {navigationSections.map((section) => (
            <div key={section.title}>

              <p className="mb-3 px-3 text-[10px] font-extrabold tracking-[0.15em] text-[#aaa5bd]">
                {section.title}
              </p>

              <div className="space-y-1">

                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.name)}
                      className={`sidebar-link flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
                        isActive
                          ? "active bg-purple-100 text-purple-700 shadow-sm"
                          : "text-[#77758d] hover:bg-purple-50 hover:text-purple-700"
                      }`}
                    >
                      <Icon size={19} />

                      <span>{item.name}</span>

                      {isActive && (
                        <ChevronRight
                          size={16}
                          className="ml-auto"
                        />
                      )}
                    </button>
                  );
                })}

              </div>
            </div>
          ))}

        </nav>

        {/* SIDEBAR BOTTOM */}

        <div className="border-t border-purple-100 p-4">

          <button
            onClick={() => handleNavigation("Settings")}
            className={`sidebar-link flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
              activePage === "Settings"
                ? "active bg-purple-100 text-purple-700"
                : "text-[#77758d] hover:bg-purple-50"
            }`}
          >
            <SettingsIcon size={19} />
            Settings
          </button>

          <div className="mt-4 rounded-2xl bg-gradient-to-br from-purple-100 to-emerald-50 p-4">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
                {adminDetails?.full_name?.charAt(0)?.toUpperCase() || "A"}
              </div>

              <div className="min-w-0">

                <p className="truncate text-sm font-bold text-[#302b50]">
                  {adminDetails?.full_name || "Administrator"}
                </p>

                <p className="text-xs text-[#89869e]">
                  Store Management
                </p>

              </div>

            </div>

          </div>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="min-h-screen lg:ml-72">

        {/* HEADER */}

        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 border-b border-purple-100 bg-white/75 px-4 backdrop-blur-xl md:px-8">

          <div className="flex min-w-0 items-center gap-3">

            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl bg-purple-50 p-2.5 text-purple-700 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={21} />
            </button>

            <div className="min-w-0">

              <p className="truncate text-xs font-semibold text-[#9994ac]">
                Sri Byraweswara Traders
              </p>

              <h2 className="truncate text-lg font-extrabold text-[#302b50]">
                {activePage}
              </h2>

            </div>

          </div>

          <div className="flex items-center gap-2 md:gap-4">

            {/* SEARCH */}

            <div className="hidden items-center gap-2 rounded-xl border border-purple-100 bg-white px-3 py-2.5 md:flex">

              <Search size={17} className="text-purple-400" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search..."
                className="w-36 bg-transparent text-sm outline-none placeholder:text-[#aaa5bd] lg:w-48"
              />

            </div>

            {/* NOTIFICATIONS */}

            <button
              className="relative rounded-xl bg-purple-50 p-2.5 text-purple-600 transition hover:bg-purple-100"
              aria-label="Notifications"
            >
              <Bell size={19} />

              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
            </button>

            {/* ADMIN */}

            <div className="hidden items-center gap-2 border-l border-purple-100 pl-4 sm:flex">

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-emerald-500 text-sm font-bold text-white">
                {adminDetails?.full_name?.charAt(0)?.toUpperCase() || "A"}
              </div>

              <div>

                <p className="text-xs font-bold text-[#302b50]">
                  {adminDetails?.full_name || "Admin"}
                </p>

                <p className="text-[10px] text-[#9994ac]">
                  Administrator
                </p>

              </div>

            </div>

            {/* LOGOUT */}

            <button
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="rounded-xl bg-red-50 p-2.5 text-red-500 transition hover:bg-red-100"
            >
              <LogOut size={19} />
            </button>

          </div>

        </header>

        {/* PAGE CONTENT */}

        <div className="p-4 md:p-8">
          {renderPage()}
        </div>

      </main>

    </div>
  );
}

export default App;
