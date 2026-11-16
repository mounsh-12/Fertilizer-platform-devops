
import { Sprout, Sun, Cloud, Leaf } from "lucide-react";

export default function DashboardIllustration() {
  return (
    <div className="relative mx-auto flex h-52 w-64 items-center justify-center">

      {/* Background glow */}
      <div className="absolute h-44 w-44 rounded-full bg-white/20 blur-2xl" />

      {/* Floating sun */}
      <div className="animate-float absolute right-8 top-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-200 to-orange-400 text-white shadow-xl shadow-orange-300/40">
        <Sun size={28} />
      </div>

      {/* Floating cloud */}
      <div className="absolute left-5 top-9 rotate-[-12deg] text-white/80">
        <Cloud size={35} />
      </div>

      {/* Main illustration */}
      <div className="relative z-10 flex h-36 w-36 items-center justify-center rounded-[35px] border border-white/40 bg-white/20 shadow-2xl backdrop-blur-xl">

        <div className="absolute inset-3 rounded-[28px] border border-white/20" />

        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-green-600 shadow-xl shadow-green-900/20">
          <Sprout size={57} strokeWidth={1.5} className="text-white" />
        </div>

        <div className="absolute -bottom-3 -right-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-gradient-to-br from-orange-300 to-pink-400 text-white shadow-lg">
          <Leaf size={23} />
        </div>
      </div>

      {/* Floating decorative elements */}
      <div className="animate-float absolute bottom-5 left-5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-white shadow-lg">
        <Leaf size={19} />
      </div>

      <div className="absolute bottom-4 right-5 h-5 w-5 rounded-full bg-yellow-200 shadow-lg shadow-yellow-200/50" />

      <div className="absolute left-12 top-2 h-3 w-3 rounded-full bg-pink-200" />

    </div>
  );
}
