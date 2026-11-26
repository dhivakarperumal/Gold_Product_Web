import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Package,
  UserRound,
  X,
  ChevronLeft,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../PrivateRouter/AuthContext";

const navItems = [
  { path: "/superadmin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/superadmin/goldshop", label: "Gold Shop Management", icon: Package },
  { path: "/superadmin/users", label: "User Management", icon: Users, exact: true },
  { path: "/superadmin/subscription-plans", label: "Subscription Plans", icon: CreditCard, exact: true },
  { path: "/superadmin/payments", label: "Payment Management", icon: Wallet, exact: true },
  { path: "/superadmin/revenue-reports", label: "Revenue", icon: BarChart3, exact: true },
  
  
  { path: "/superadmin/profile", label: "My Profile", icon: UserRound, exact: true }
];

/* ================= SIDEBAR ================= */
const SuperSidebar = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName = user?.name?.trim() || user?.username || "Super Admin";
  const normalizedRole = String(user?.role || "superadmin").toLowerCase().replace(/[\s_-]/g, "");
  const roleLabel = normalizedRole === "superadmin"
    ? "Super Admin"
    : String(user?.role || "Admin").replace(/^\w/, (letter) => letter.toUpperCase());
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "S";

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
    if (item.search) return location.pathname === item.path && location.search === item.search;
    if (item.path === "/superadmin/profile" && location.pathname === item.path) {
      return !location.search || location.search === "?tab=personal";
    }
    return item.exact
      ? location.pathname === item.path
      : matchesRoute(item.path);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Super Admin logout failed:", error);
    }
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
        bg-gradient-to-b from-[#07564B] via-[#064A41] to-[#033B35]
        border-r border-white/10 shadow-[12px_0_40px_rgba(2,28,25,0.18)]
        font-sans
        
        flex flex-col transition-all duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
        ${collapsed ? "lg:w-20 w-full" : "w-full lg:w-80"}
      `}
      >
        {/* ========== LOGO ========== */}
        <div className={`relative flex h-24 shrink-0 items-center border-b border-white/10 bg-white/[0.025] ${collapsed ? "lg:justify-center px-5 lg:px-3" : "px-5"}`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-300/10 via-transparent to-amber-300/10" />
          <div className={`relative flex min-w-0 items-center ${collapsed ? "lg:justify-center gap-3 lg:gap-0" : "gap-3"}`}>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-black/15 ring-1 ring-white/30 transition-transform duration-200 hover:scale-[1.03]">
              <img
                src="/images/logo.png"
                alt="Sri Golds"
                className="h-12 w-12 object-contain"
              />
            </div>
            <div className={`min-w-0 overflow-hidden ${collapsed ? "lg:hidden" : ""}`}>
              <p className="mb-1 truncate font-serif text-xl font-bold leading-none tracking-wide text-[#F5C45E]">
                Sri Golds
              </p>
              <p className="truncate text-sm font-medium tracking-wide text-emerald-50/75">
                Super Admin Panel
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" />
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-100/55">Control Center</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="absolute right-3 rounded-xl border border-transparent p-2 text-white/60 transition-all hover:border-white/10 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========== NAVIGATION ========== */}
        <nav aria-label="Super Admin navigation" className="hide-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-5">
          <p className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/45 ${collapsed ? "lg:hidden" : ""}`}>
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item);

            return (
              <NavLink
                key={`${item.path}${item.search || ""}`}
                to={item.search ? { pathname: item.path, search: item.search } : item.path}
                end={item.exact}
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  if (isOpen) onClose();
                }}
                className={`
                  group relative flex min-h-14 items-center gap-3 rounded-2xl border transition-all duration-200
                  ${collapsed ? "lg:justify-center lg:px-1 px-4" : "px-4"}
                  ${isActive
                    ? "border-amber-200/50 bg-gradient-to-r from-[#D5A319] via-[#C18A09] to-[#A87908] text-[#123B32] shadow-[0_8px_20px_rgba(168,121,8,0.22)]"
                    : "border-transparent text-emerald-50/75 hover:translate-x-0.5 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white"
                  }
                `}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${isActive ? "bg-white/20" : "bg-white/[0.045] group-hover:bg-white/[0.09]"}`}>
                  <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? "text-[#123B32]" : "text-emerald-100/75 group-hover:text-white"}`} />
                </span>
                <span className={`min-w-0 flex-1 text-sm font-semibold leading-snug tracking-wide ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                {isActive && (
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFF2B8] shadow-[0_0_8px_rgba(255,242,184,0.9)] ${collapsed ? "lg:hidden" : ""}`} />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className={`shrink-0 border-t border-white/10 ${collapsed ? "px-3 py-4 lg:px-2" : "px-4 py-4"}`}>
          <div
            title={collapsed ? `${displayName} - ${roleLabel}` : undefined}
            className={`flex h-20 items-center rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.07] to-white/[0.025] px-3 shadow-inner shadow-white/[0.02] ${collapsed ? "lg:justify-center lg:px-0 gap-3 lg:gap-0" : "gap-3"}`}
          >
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 text-base font-black text-[#123b32] shadow-md shadow-black/15 ring-1 ring-white/30">
              <span>{avatarInitial}</span>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#064A41] bg-emerald-300" />
            </span>
            <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
                <span className="block truncate text-sm font-bold text-white">{displayName}</span>
                <span className="mt-1 inline-flex max-w-full items-center truncate rounded-full border border-amber-200/15 bg-amber-200/[0.08] px-2 py-0.5 text-[10px] font-semibold text-amber-100/80">{roleLabel}</span>
            </span>
          </div>
         
        </div>

        {/* ========== COLLAPSE BUTTON ========== */}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="
            hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2
            h-7 w-7 rounded-full
            border border-emerald-100/70 bg-white
            shadow-[0_4px_12px_rgba(0,0,0,0.16)]
            items-center justify-center
            text-emerald-800 transition-all hover:scale-110 hover:bg-amber-50 hover:text-emerald-950 z-50
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
