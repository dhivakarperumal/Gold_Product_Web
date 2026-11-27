import { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  BarChart3,
  X,
  ArrowUpRight,
  Eye,
  ChevronDown,
  ChevronLeft,
  Home,
  Tag,
  PlusCircle,
  List,
  Layers,
  Archive,
  Handshake,
  Megaphone,
  Video,
  Star,
  Gem,
  FilePlus,
  Files,
  HandCoins,
  RefreshCw,
  Clock3,
  Coins,
  CheckCircle2,
  MessageCircle,
  ClipboardList
} from "lucide-react";

/* ================= NAV ITEMS ================= */
const navItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/admin/settings/daily-gold-rate", label: "Daily Gold Rate", icon: Coins },
  { path: "/admin/customer-view-products", label: "Customer View Product", icon: Eye },

 
  
 

  {
    label: "Take Order",
    icon: ClipboardList,
    children: [
     { path: "/admin/tack-orders", label: "Take Order", icon: ClipboardList },
     { path: "/admin/tackAllOrders", label: "All Take Orders", icon: ClipboardList },
    ],
  },
  
   { path: "/admin/billings", label: "Billing", icon: Files },
 
  {
    label: "Loan Management",
    icon: HandCoins,
    children: [
      {
        path: "/admin/loans/customermanagement",
        activePaths: ["/admin/loans/customers/:id"],
        label: "Customer Management",
        icon: FilePlus
      },
      {
        path: "/admin/loans/allloans",
        activePaths: [
          "/admin/loans/createloan",
          "/admin/loans/edit/:id",
          "/admin/loans/details/:id",
          "/admin/loans/interestmanagement"
        ],
        label: "All Loans",
        icon: Files
      },
      { path: "/admin/loans/overdueloans", label: "Overdue Loans", icon: Clock3 },
      
      { path: "/admin/loans/loanreniwel", label: "Loan Renewal", icon: RefreshCw },
      { path: "/admin/loans/goldrelease", label: "Gold Release", icon: Gem },
      { path: "/admin/loans/completeloan", label: "Complete Loan", icon: CheckCircle2 },
      
      
    ],
  },


  {
    label: "Products",
    icon: Package,
    children: [
      {
        path: "/admin/products/all",
        activePaths: ["/admin/products/:id"],
        label: "All Products",
        icon: List
      },
      {
        path: "/admin/products/add",
        activePaths: ["/admin/products/edit/:id"],
        label: "Add Product",
        icon: PlusCircle
      },
      {
        path: "/admin/products/stock",
        activePaths: ["/admin/products/stock/add"],
        label: "Stock Details",
        icon: Archive
      },
      { path: "/admin/products/category", label: "Categories", icon: Layers },
      { path: "/admin/metals", label: "Add Metal", icon: Gem },
    ],
  },

  

  // {
  //   label: "Marketings Management",
  //   icon: Megaphone,
  //   children: [
  //     { path: "/admin/banners", label: "Offers & Banners", icon: Tag },
  //     { path: "/admin/videos", label: "Showcase Videos", icon: Video },
  //     { path: "/admin/reviews", label: "Reviews", icon: Star },
      
  //   ],
  // },


  {
    label: "Dealers",
    icon: Handshake,
    children: [
      { path: "/admin/dealers", label: "Dealer", icon: List },
      { path: "/admin/dealers/purchases", label: "Purchases & Payables", icon: Files },
      // { path: "/admin/dealers/refining", label: "Old Gold & Refining", icon: Gem },
    ],
  },

  { path: "/admin/reports", label: "Reports", icon: BarChart3 },
  
  
];

/* ================= SIDEBAR ================= */
const Sidebar = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const location = useLocation();
  const visibleNavItems = navItems;

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

  const getActiveChildPath = (item) => {
    if (!item.children) return null;
    const matchingChildren = item.children
      .filter(child => [child.path, ...(child.activePaths || [])].some(matchesRoute))
      .sort((first, second) => {
        const firstDirectMatch = matchesRoute(first.path);
        const secondDirectMatch = matchesRoute(second.path);
        if (firstDirectMatch !== secondDirectMatch) {
          return Number(secondDirectMatch) - Number(firstDirectMatch);
        }
        const firstSpecificity = first.path.split("/").filter(segment => segment && !segment.startsWith(":")).length;
        const secondSpecificity = second.path.split("/").filter(segment => segment && !segment.startsWith(":")).length;
        return secondSpecificity - firstSpecificity || second.path.length - first.path.length;
      });
    return matchingChildren[0]?.path || null;
  };

  const isActiveRoute = (item) => {
    const currentPath = location.pathname;

    // 1. Strict exact match for root routes to prevent Dashboard/BackHome overlap
    if (item.path === "/" || item.path === "/admin" || item.exact) {
      return currentPath === item.path;
    }

    // 2. Dropdown parent check: check if any child is perfectly active or a sub-path
    if (item.children) {
      return getActiveChildPath(item) !== null;
    }

    // 3. Normal item check: match exact or match as a parent path (with boundary)
    if (item.path) {
      return matchesRoute(item.path);
    }

    return false;
  };

  const [openMenu, setOpenMenu] = useState(() => {
    const activeItem = navItems.find(item => item.children && isActiveRoute(item));
    return activeItem ? activeItem.label : null;
  });

  useEffect(() => {
    const activeItem = navItems.find(item => item.children && isActiveRoute(item));
    if (activeItem) {
      setOpenMenu(activeItem.label);
    }
  }, [location.pathname]);

  /* Dropdown logic - only one open at a time */
  const toggleMenu = (label) => {
    setOpenMenu(prev => prev === label ? null : label);
  };

  return (
    <>
      {/* ========== MOBILE OVERLAY ========== */}
      <div
        onClick={onClose}
        aria-hidden={!isOpen}
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
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-emerald-300/[0.08] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 bottom-32 h-64 w-64 rounded-full bg-amber-300/[0.07] blur-3xl" />

        {/* ========== LOGO ========== */}
        <div className="relative z-10 overflow-hidden border-b border-white/10 bg-white/[0.025] px-4 py-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-300/10 via-transparent to-amber-300/10" />
          <div className={`relative flex items-center ${collapsed ? "gap-3 lg:justify-center" : "gap-3"}`}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-white to-amber-50 shadow-lg shadow-black/15 ring-1 ring-amber-200/70">
              <img
                src="/images/logo.png"
                alt="Sri Golds"
                className="w-11 h-11 object-contain"
              />
            </div>
            <div className={`min-w-0 overflow-hidden ${collapsed ? "lg:hidden" : ""}`}>
              <p className="mb-1 truncate font-serif text-lg font-bold leading-none tracking-wide text-[#F5C45E]">
                Sri Golds
              </p>
              <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-50/70">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F5C45E] shadow-[0_0_8px_rgba(245,196,94,0.7)]" />
                Admin workspace
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/[0.06] p-2 text-white/70 transition-all hover:bg-white/15 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========== NAVIGATION ========== */}
        <nav aria-label="Admin navigation" className={`hide-scrollbar relative z-10 flex-1 space-y-1.5 overflow-y-auto py-4 ${collapsed ? "px-3 lg:px-2" : "px-3"}`}>
          <div className={`mb-2 flex items-center px-3 pb-2 ${collapsed ? "lg:justify-center lg:px-0" : "justify-between"}`}>
            <span className={`text-[9px] font-extrabold uppercase tracking-[0.2em] text-emerald-100/45 ${collapsed ? "lg:hidden" : ""}`}>
              Main menu
            </span>
            <span aria-hidden="true" className={`ml-3 h-px flex-1 bg-white/10 ${collapsed ? "lg:hidden" : ""}`} />
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            /* ===== DROPDOWN ITEM ===== */
            if (item.children) {
              const isMenuOpen = openMenu === item.label;
              const isAnyChildActive = isActiveRoute(item);

              return (
                <div key={item.label} className="space-y-1">
                  <button
                    onClick={() => {
                      if (collapsed) {
                        setOpenMenu(item.label);
                        onToggleCollapse();
                        return;
                      }
                      toggleMenu(item.label);
                    }}
                    aria-expanded={isMenuOpen}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`
                      group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200
                      ${collapsed ? "lg:justify-center lg:px-0" : ""}
                      ${isAnyChildActive
                        ? "border-emerald-200/20 bg-gradient-to-r from-[#0A8A78] via-[#087768] to-[#08695D] text-white shadow-[0_8px_20px_rgba(1,30,27,0.24)]"
                        : isMenuOpen
                          ? "border-white/10 bg-white/[0.08] text-white"
                          : "border-transparent text-emerald-50/75 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white"
                      }
                    `}
                  >
                    {isAnyChildActive && <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-[#F5C45E]" />}
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${isAnyChildActive ? "border-amber-200/25 bg-amber-200/10 shadow-inner shadow-amber-100/10" : "border-white/[0.07] bg-white/[0.045] group-hover:border-white/15 group-hover:bg-white/[0.1]"}`}>
                      <Icon className={`h-[18px] w-[18px] transition-colors ${isAnyChildActive ? "text-[#FFE08A]" : "text-emerald-100/75 group-hover:text-white"}`} />
                    </span>

                    <span className={`flex-1 text-sm font-semibold tracking-wide ${collapsed ? "lg:hidden" : ""}`}>
                      {item.label}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-emerald-100/60 transition-transform ${collapsed ? "lg:hidden" : ""} ${isMenuOpen ? "rotate-180 text-white" : ""}`}
                    />
                  </button>

                  {/* ===== SUB MENU ===== */}
                  <div
                    className={`hide-scrollbar ml-3 space-y-1 overflow-y-auto border-l border-white/10 pl-3 transition-all duration-300 ${collapsed ? "lg:hidden" : ""}
                    ${isMenuOpen ? "max-h-80 py-1 opacity-100" : "max-h-0 opacity-0"}`}
                  >
                    {item.children.map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = getActiveChildPath(item) === sub.path;

                      return (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          onClick={() => isOpen && onClose()}
                          title={sub.label}
                          className={`
                            flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium tracking-wide transition-all duration-200
                            ${isActive
                              ? "bg-white/[0.1] text-white shadow-sm ring-1 ring-inset ring-white/[0.08]"
                              : "text-emerald-50/65 hover:bg-white/[0.06] hover:text-white"
                            }
                          `}
                        >
                          <SubIcon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#F5C45E]" : "text-emerald-100/55"}`} />
                          <span className="flex-1">{sub.label}</span>
                          {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F5C45E]" />}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            }

            /* ===== NORMAL ITEM ===== */
            const isActive = isActiveRoute(item);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                onClick={() => {
                  setOpenMenu(null);
                  if (isOpen) onClose();
                }}
                className={`
                  group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200
                  ${collapsed ? "lg:justify-center lg:px-0" : ""}
                  ${isActive
                    ? "border-emerald-200/20 bg-gradient-to-r from-[#0A8A78] via-[#087768] to-[#08695D] text-white shadow-[0_8px_20px_rgba(1,30,27,0.24)]"
                    : "border-transparent text-emerald-50/75 hover:translate-x-0.5 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white"
                  }
                `}
              >
                {isActive && <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-[#F5C45E]" />}
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${isActive ? "border-amber-200/25 bg-amber-200/10 shadow-inner shadow-amber-100/10" : "border-white/[0.07] bg-white/[0.045] group-hover:border-white/15 group-hover:bg-white/[0.1]"}`}>
                  <Icon className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-[#FFE08A]" : "text-emerald-100/75 group-hover:text-white"}`} />
                </span>
                <span className={`text-sm font-semibold tracking-wide ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* ========== STORE PROMOTION ========== */}
        <div className={`relative z-10 ${collapsed ? "lg:hidden" : ""}`}>
          <Link to="/" className="group relative mx-3 mb-4 block h-36 overflow-hidden rounded-2xl border border-white/15 shadow-lg shadow-black/15 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-200/50 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C45E]">
            <img src="/images/Luxury Gold Jewelry Showcase.png" alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#032F2B]/95 via-[#063D37]/75 to-[#063D37]/20" />
            <div className="relative flex h-full flex-col items-start justify-center p-3.5">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-black/20 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#F8D77E] backdrop-blur-sm">
                <Gem size={10} />
                Storefront
              </span>
              <span className="max-w-32 font-serif text-sm font-bold leading-snug text-white">Premium Jewellery Collection</span>
              <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#F5C45E] px-2.5 py-1.5 text-[10px] font-extrabold text-[#003B3B] shadow-sm transition-all group-hover:gap-2 group-hover:bg-white">
                Visit store <ArrowUpRight size={12} />
              </span>
            </div>
          </Link>
        </div>

        {/* ========== COLLAPSE BUTTON ========== */}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="
            hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2
            w-6 h-6 rounded-full
            bg-white border border-emerald-100
            shadow-[0_4px_12px_rgba(0,0,0,0.14)]
            items-center justify-center
            text-emerald-800 transition-all hover:scale-110 hover:border-amber-200 hover:text-amber-700 z-50
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

export default Sidebar;
