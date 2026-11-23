import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  BarChart3,
  X,
  ChevronLeft,
  Layers,
  Files,
  RefreshCw,
  Wallet,
  CalendarDays
} from "lucide-react";

const navItems = [
  { path: "/superadmin", label: "Dashboard Analytics", icon: LayoutDashboard, exact: true },
  { path: "/superadmin/goldshop", label: "Gold Shop Management", icon: Package },
  { path: "/superadmin/subscription-plans", label: "Subscription Plan", icon: Layers, exact: true },
  { label: "Subscription Activation & Expiry", icon: CalendarDays, disabled: true },
  { label: "Payment Management", icon: Wallet, disabled: true },
  // { label: "Transaction History", icon: Files, disabled: true },
  // { label: "Subscription Renewal History", icon: RefreshCw, disabled: true },
  { path: "/superadmin/revenue-reports", label: "Revenue Reports", icon: BarChart3, exact: true }
];

/* ================= SIDEBAR ================= */
const SuperSidebar = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const location = useLocation();

  /* ================= HELPERS & LOGIC ================= */
  const matchesRoute = (routePath) => {
    const currentSegments = location.pathname.split("/").filter(Boolean);
    const routeSegments = routePath.split("/").filter(Boolean);
    const hasDynamicSegment = routeSegments.some(segment => segment.startsWith(":"));

    return (hasDynamicSegment
      ? currentSegments.length === routeSegments.length
      : currentSegments.length >= routeSegments.length) &&
      routeSegments.every((segment, index) =>
        segment.startsWith(":") || segment === currentSegments[index]
      );
  };

  const isActiveRoute = (item) => {
    if (!item.path) return false;
    return item.exact
      ? location.pathname === item.path
      : matchesRoute(item.path);
  };

  return (
    <>
      {/* ========== MOBILE OVERLAY ========== */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden
        transition-opacity ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
      />

      {/* ========== SIDEBAR ========== */}
      <aside
        className={`
        fixed top-0 left-0 z-50 h-full
        bg-gradient-to-b from-[#07564B] via-[#064A41] to-[#043D37]
        border-r border-white/10 shadow-[12px_0_40px_rgba(2,28,25,0.18)]
        font-sans
        
        flex flex-col transition-all duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
        ${collapsed ? "lg:w-20 w-full" : "w-full lg:w-72"}
      `}
      >
        {/* ========== LOGO ========== */}
        <div className="relative overflow-hidden border-b border-white/10 bg-white/[0.025] px-4 py-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-300/10 via-transparent to-amber-300/10" />
          <div className={`relative flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-black/15 ring-1 ring-white/30">
              <img
                src="/images/logo.png"
                alt="Sri Golds"
                className="w-11 h-11 object-contain"
              />
            </div>
            {!collapsed && (
              <div className="min-w-0 overflow-hidden">
                <p className="mb-1 truncate font-serif text-lg font-bold leading-none tracking-wide text-[#F5C45E]">
                  Sri Golds
                </p>
                <p className="text-xs font-medium tracking-wide text-emerald-50/75">
                  Super Admin Panel
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="ml-auto rounded-xl border border-transparent p-2 text-white/60 transition-all hover:border-white/10 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========== NAVIGATION ========== */}
        <nav aria-label="Super Admin navigation" className="hide-scrollbar flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const title = item.disabled ? `${item.label} (Coming soon)` : item.label;

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  title={collapsed ? title : undefined}
                  className="group flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-emerald-50/45"
                >
                  <Icon className="h-5 w-5 shrink-0 text-emerald-100/35" />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug tracking-wide">
                        {item.label}
                      </span>
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50/60">
                        Soon
                      </span>
                    </>
                  )}
                </div>
              );
            }

            const isActive = isActiveRoute(item);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  if (isOpen) onClose();
                }}
                className={`
                  group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200
                  ${isActive
                    ? "border-white/10 bg-gradient-to-r from-[#078D7B] to-[#087263] text-white shadow-lg shadow-black/15"
                    : "border-transparent text-emerald-50/75 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white"
                  }
                `}
              >
                <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? "text-[#FFE08A]" : "text-emerald-100/75 group-hover:text-white"}`} />
                {!collapsed && <span className="min-w-0 flex-1 text-sm font-semibold leading-snug tracking-wide">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* ========== COLLAPSE BUTTON ========== */}
        <button
          onClick={onToggleCollapse}
          className="
            hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2
            w-6 h-6 rounded-full
            bg-white border border-slate-200
            shadow-[0_4px_10px_rgba(0,0,0,0.1)]
            items-center justify-center
            text-emerald-800 transition-all hover:scale-110 hover:text-emerald-950 z-50
          "
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""
              }`}
          />
        </button>
      </aside>
    </>
  );
};

export default SuperSidebar;
