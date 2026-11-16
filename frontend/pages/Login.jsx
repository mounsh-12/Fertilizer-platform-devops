
import { useState } from "react";
import {
  Sprout,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Leaf,
} from "lucide-react";

function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const value = identifier.trim();

    if (!value || !password) {
      setError("Please enter your email/mobile number and password.");
      return;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const isMobile = /^\d{10}$/.test(value);

    if (!isEmail && !isMobile) {
      setError("Enter a valid email address or 10-digit mobile number.");
      return;
    }

    if (typeof onLogin !== "function") {
      setError("Login service is not configured. Please try again.");
      return;
    }

    try {
      setLoading(true);

      await onLogin({
        identifier: value,
        password,
        rememberMe,
      });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f2ff] px-4 py-10">
      {/* BACKGROUND DECORATION */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-purple-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-300/30 blur-3xl" />

      {/* LOGIN CONTAINER */}
      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/70 bg-white/70 shadow-2xl backdrop-blur-xl lg:grid-cols-2">
        {/* LEFT PANEL */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-purple-700 via-purple-600 to-emerald-600 p-12 text-white lg:flex">
          <div className="absolute -right-20 top-32 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -right-10 top-44 h-44 w-44 rounded-full border border-white/10" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-lg">
              <Sprout size={30} />
            </div>

            <div>
              <h1 className="text-xl font-extrabold">
                Sri Byraweswara
              </h1>
              <p className="text-xs font-semibold tracking-[0.3em] text-white/75">
                TRADERS
              </p>
            </div>
          </div>

          <div className="relative z-10">
            <div className="mb-8 flex h-40 w-40 items-center justify-center rounded-[40px] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl">
              <div className="flex h-28 w-28 items-center justify-center rounded-[30px] bg-white text-purple-700 shadow-xl">
                <Sprout size={65} strokeWidth={1.5} />
              </div>
            </div>

            <h2 className="max-w-sm text-4xl font-extrabold leading-tight">
              Manage your business with confidence.
            </h2>

            <p className="mt-5 max-w-sm text-sm leading-7 text-white/75">
              Manage fertilizers, inventory, suppliers, farmers,
              sales and business transactions from one place.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-white/70">
            <ShieldCheck size={17} />
            Administrator access
          </div>
        </div>

        {/* RIGHT LOGIN PANEL */}
        <div className="flex flex-col justify-center p-7 sm:p-12 lg:p-14">
          {/* MOBILE LOGO */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-emerald-500 p-3 text-white shadow-lg">
              <Sprout size={27} />
            </div>

            <div>
              <h1 className="font-extrabold text-[#302b50]">
                Sri Byraweswara
              </h1>
              <p className="text-xs font-semibold tracking-[0.2em] text-purple-500">
                TRADERS
              </p>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-700">
              <Leaf size={14} />
              ADMINISTRATOR PORTAL
            </div>

            <h2 className="text-3xl font-extrabold text-[#302b50]">
              Welcome back!
            </h2>

            <p className="mt-2 text-sm text-[#89869e]">
              Sign in to access your business dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* EMAIL OR MOBILE */}
            <div>
              <label className="mb-2 block text-sm font-bold text-[#514c70]">
                Email or Mobile Number
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-purple-100 bg-white px-4 py-3.5 transition focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
                <Mail size={19} className="shrink-0 text-purple-500" />

                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter email or mobile number"
                  autoComplete="username"
                  required
                  disabled={loading}
                  className="w-full bg-transparent text-sm text-[#302b50] outline-none placeholder:text-[#aaa5bd]"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="mb-2 block text-sm font-bold text-[#514c70]">
                Password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-purple-100 bg-white px-4 py-3.5 transition focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
                <Lock size={19} className="shrink-0 text-purple-500" />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="w-full bg-transparent text-sm text-[#302b50] outline-none placeholder:text-[#aaa5bd]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#89869e] transition hover:text-purple-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* REMEMBER ME */}
            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#77758d]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 accent-purple-600"
                />
                Remember me
              </label>

              <button
                type="button"
                onClick={() =>
                  setError("Password recovery will be connected to the backend.")
                }
                className="text-sm font-bold text-purple-600 hover:text-purple-800"
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600"
              >
                {error}
              </div>
            )}

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-500 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-purple-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[#aaa5bd]">
            <ShieldCheck size={16} />
            Restricted access for authorized administrators
          </div>

          <p className="mt-5 text-center text-xs text-[#aaa5bd]">
            © {new Date().getFullYear()} Sri Byraweswara Traders
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
