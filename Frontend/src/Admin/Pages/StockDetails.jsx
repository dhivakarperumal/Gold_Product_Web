import CustomSelect from "../../Components/CustomSelect.jsx";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useAdmin } from "../../PrivateRouter/AdminContext";
import { useAuth } from "../../PrivateRouter/AuthContext";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";
import { toast, Toaster } from "react-hot-toast";
import {
    FiBox,
    FiAlertCircle,
    FiTrendingDown,
    FiSearch,
    FiSave,
    FiPlus,
    FiX,
    FiEdit2,
    FiGrid,
    FiList,
} from "react-icons/fi";
import AddStock from "../Products/AddStock";
import { getProductImageUrl } from "../../Components/Home/productDisplay";

const StockDetails = () => {
    const { stockCache, setStockCached } = useAdmin();
    const { user } = useAuth();
    const ownerUserId = user?.user_id || "anonymous";
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState("table");
    const itemsPerPage = 10;

    const currentCacheKey = JSON.stringify({
        userId: ownerUserId,
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        status: statusFilter
    });
    
    const pageData = stockCache[currentCacheKey];
    const [products, setProducts] = useState(pageData?.products || []);
    const [loadedOwnerId, setLoadedOwnerId] = useState(ownerUserId);
    const [loading, setLoading] = useState(!pageData);
    const fetchRequestRef = useRef(0);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddStockOpen, setIsAddStockOpen] = useState(false);
    const [pagination, setPagination] = useState(pageData?.pagination || { total: 0, totalPages: 1 });
    const [stats, setStats] = useState(pageData?.stats || { total: 0, active: 0, lowStock: 0, outOfStock: 0 });
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [updatedVariants, setUpdatedVariants] = useState([]);
    const [variantAdditions, setVariantAdditions] = useState({});
    const [manualTotalStock, setManualTotalStock] = useState("0");
    const [isUpdating, setIsUpdating] = useState(false);
    const [fetchingDetail, setFetchingDetail] = useState(false);
    const ownerIsCurrent = loadedOwnerId === ownerUserId;
    const visibleStats = ownerIsCurrent ? stats : { total: 0, active: 0, lowStock: 0, outOfStock: 0 };

    const fetchProducts = useCallback(async () => {
        const requestId = ++fetchRequestRef.current;
        setLoading(true);
        const params = {
            page: currentPage,
            limit: itemsPerPage,
            search: searchTerm,
            status: statusFilter
        };
        const cacheKey = currentCacheKey;
        try {
            const response = await api.get("/products/mine", { params });
            if (requestId !== fetchRequestRef.current) return;
            const data = response.data;
            let finalData = {};
 
            if (Array.isArray(data)) {
                finalData = { products: data, pagination: { total: data.length, totalPages: 1 }, stats: { total: 0, active: 0, lowStock: 0, outOfStock: 0 }};
            } else {
                finalData = {
                    products: Array.isArray(data.products) ? data.products : [],
                    pagination: data.pagination || { total: 0, totalPages: 1 },
                    stats: data.stats || { total: 0, active: 0, lowStock: 0, outOfStock: 0 }
                };
            }
            setProducts(finalData.products);
            setLoadedOwnerId(ownerUserId);
            setPagination(finalData.pagination);
            setStats(finalData.stats);
            setStockCached(prev => ({ ...prev, [cacheKey]: finalData }));
        } catch (error) {
            if (requestId !== fetchRequestRef.current) return;
            console.error("Error fetching products:", error);
            setProducts([]);
            setLoadedOwnerId(ownerUserId);
            setPagination({ total: 0, totalPages: 1 });
            setStats({ total: 0, active: 0, lowStock: 0, outOfStock: 0 });
            toast.error(error.response?.data?.message || "Could not load stock details.");
        } finally {
            if (requestId === fetchRequestRef.current) setLoading(false);
        }
    }, [currentCacheKey, currentPage, searchTerm, statusFilter, ownerUserId, setStockCached]);

    useEffect(() => {
        void fetchProducts();
    }, [fetchProducts]);

    const getStockLevel = (product) => {
        const stock = product.total_stock ?? product.stock ?? 0;
        return stock;
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case "Active":
            case "In Stock": return "bg-emerald-50 text-emerald-600 border-emerald-100";
            case "Low Stock": return "bg-amber-50 text-amber-600 border-amber-100";
            case "Out of Stock": return "bg-rose-50 text-rose-600 border-rose-100";
            default: return "bg-gray-50 text-gray-600 border-gray-100";
        }
    };

    const deriveStatus = (stock) => {
        if (stock <= 0) return "Out of Stock";
        if (stock < 10) return "Low Stock";
        return "In Stock";
    };

    const totalPages = Math.max(1, Number(pagination.totalPages) || 1);
    const currentItems = ownerIsCurrent ? products : [];
    const isLoading = loading || !ownerIsCurrent;
    const changePage = (page) => {
        setLoading(true);
        setCurrentPage(page);
    };
    // Modal Handlers
    const openUpdateModal = async (product) => {
        setIsModalOpen(true);
        setSelectedProduct(product);
        setUpdatedVariants(Array.isArray(product.variants) ? product.variants : []);
        setVariantAdditions({});
        setManualTotalStock("0");
        setFetchingDetail(true);

        try {
            const res = await api.get(`/products/mine/${product.id}`);
            const fullP = res.data;
            let vars = [];
            if (fullP.variants) {
                vars = typeof fullP.variants === 'string' ? JSON.parse(fullP.variants) : fullP.variants;
            }
            setSelectedProduct(fullP);
            setUpdatedVariants(Array.isArray(vars) ? vars : []);
            setVariantAdditions({});
            setManualTotalStock("0");
        } catch (e) {
            console.error("Failed to fetch full product details", e);
            toast.error("Failed to fetch detailed stock data");
        } finally {
            setFetchingDetail(false);
        }
    };

    const closeUpdateModal = () => {
        setIsModalOpen(false);
        setSelectedProduct(null);
        setUpdatedVariants([]);
        setVariantAdditions({});
    };

    const handleVariantStockChange = (vIndex, size, value) => {
        const key = `${vIndex}-${size}`;
        const numericValue = Number.parseInt(value, 10);
        setVariantAdditions(prev => ({
            ...prev,
            [key]: Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0
        }));
    };

    const getCurrentStockValue = (product) => {
        const current = Number.parseInt(product?.total_stock ?? product?.stock ?? 0, 10) || 0;
        return Math.max(0, current);
    };

    const handleSaveStock = async () => {
        if (!selectedProduct) return;
        setIsUpdating(true);
        try {
            let newTotalStock = 0;
            const vars = Array.isArray(updatedVariants)
                ? updatedVariants.map((variant) => ({
                    ...variant,
                    sizesStock: variant.sizesStock ? { ...variant.sizesStock } : variant.sizesStock
                }))
                : [];
            const hasVariantsWithSizes = vars.some(v => v.sizesStock && Object.keys(v.sizesStock).length > 0);

            if (hasVariantsWithSizes) {
                vars.forEach((v, vIndex) => {
                    Object.keys(v.sizesStock || {}).forEach(size => {
                        const key = `${vIndex}-${size}`;
                        const currentQty = parseInt(v.sizesStock?.[size] || 0, 10) || 0;
                        const addedQty = parseInt(variantAdditions[key] || 0, 10) || 0;
                        const finalQty = currentQty + addedQty;
                        v.sizesStock[size] = finalQty;
                        newTotalStock += finalQty;
                    });
                });
            } else {
                const currentStock = getCurrentStockValue(selectedProduct);
                const addedStock = parseInt(manualTotalStock) || 0;
                newTotalStock = currentStock + addedStock;
            }

            const stockStatus = newTotalStock <= 0 ? "Out of Stock" : newTotalStock < 10 ? "Low Stock" : "In Stock";

            const payload = {
                ...selectedProduct,
                total_stock: newTotalStock.toString(),
                stock: newTotalStock.toString(),
                stock_status: stockStatus,
                variants: vars
            };

            await api.put(`/products/` + selectedProduct.id, payload);

            setProducts((current) => current.map(p =>
                p.id === selectedProduct.id
                    ? { ...p, total_stock: newTotalStock, stock_status: stockStatus, variants: vars }
                    : p
            ));
            setStockCached((current) => {
                const cachedPage = current[currentCacheKey];
                if (!cachedPage) return current;
                return {
                    ...current,
                    [currentCacheKey]: {
                        ...cachedPage,
                        products: cachedPage.products.map((product) => product.id === selectedProduct.id
                            ? { ...product, total_stock: newTotalStock, stock_status: stockStatus, variants: vars }
                            : product)
                    }
                };
            });

            toast.success("Stock updated successfully");
            closeUpdateModal();
        } catch (error) {
            console.error("Failed to update stock:", error);
            toast.error("Failed to update stock");
        } finally {
            setIsUpdating(false);
        }
    };

    const getProductImage = (product) => {
        return getProductImageUrl(product)
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name || 'P')}&background=random`;
    };

    return (
        <div className="space-y-5 pb-10">
            <Toaster position="top-right" />

            <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577] px-6 py-7 text-white shadow-[0_20px_45px_rgba(4,78,69,0.18)] sm:px-9 sm:py-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-28 -z-10 h-80 w-80 rounded-full border border-white/10">
                    <div className="absolute inset-8 rounded-full border border-white/10" />
                </div>
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-3xl">
                        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">
                            Inventory Management <span className="mx-1.5 text-emerald-200/70">·</span> Stock Overview
                        </p>
                        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Stock Details</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
                            Monitor product availability, identify low stock, and keep your inventory up to date.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsAddStockOpen(true)}
                        className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2.5 self-start rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-[#064e45] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-white/30 sm:self-center"
                    >
                        <FiPlus size={18} /> Add Stock
                    </button>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Total Products", value: visibleStats.total || 0, sub: "All inventory products", icon: <FiBox size={23} />, card: "border-t-[#00b8a9] bg-gradient-to-br from-[#eefbf9] to-white", iconBg: "bg-[#009b8b]", dot: "bg-[#009b8b]", text: "text-[#007d70]" },
                    { label: "Active Products", value: visibleStats.active || 0, sub: "Currently available", icon: <FiCheckCircle />, card: "border-t-emerald-500 bg-gradient-to-br from-emerald-50 to-white", iconBg: "bg-emerald-600", dot: "bg-emerald-600", text: "text-emerald-700" },
                    { label: "Out of Stock", value: visibleStats.outOfStock || 0, sub: "Unavailable products", icon: <FiAlertCircle />, card: "border-t-amber-500 bg-gradient-to-br from-amber-50 to-white", iconBg: "bg-amber-500", dot: "bg-amber-600", text: "text-amber-700" },
                    { label: "Low Stock", value: visibleStats.lowStock || 0, sub: "Products running low", icon: <FiTrendingDown />, card: "border-t-rose-500 bg-gradient-to-br from-rose-50 to-white", iconBg: "bg-rose-600", dot: "bg-rose-600", text: "text-rose-700" },
                ].map((stat) => (
                    <article key={stat.label} className={`relative flex min-h-[154px] items-center justify-between gap-3 overflow-hidden rounded-[22px] border-x border-b border-t-4 border-x-slate-200/70 border-b-slate-200/70 p-5 shadow-[0_5px_15px_rgba(15,23,42,0.055)] transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${stat.card}`}>
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
                            <p className="my-2 text-4xl font-black leading-none tabular-nums text-slate-950">{stat.value}</p>
                            <p className={`flex items-center gap-2 text-xs font-bold ${stat.text}`}>
                                <span className={`h-2 w-2 shrink-0 rounded-full ${stat.dot}`} />
                                <span className="truncate">{stat.sub}</span>
                            </p>
                        </div>
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] text-white shadow-lg shadow-slate-900/10 ${stat.iconBg}`}>
                            {stat.icon}
                        </div>
                    </article>
                ))}
            </div>

            <section aria-label="Stock search and filters" className="space-y-4 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                    <label className="relative min-w-[260px] flex-[1_1_320px]">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
                        <span className="sr-only">Search products by name, SKU, or category</span>
                        <input
                            type="search"
                            placeholder="Search products by name, SKU, category..."
                            className="min-h-12 w-full rounded-[14px] border border-slate-200 bg-slate-50/60 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#008577] focus:bg-white focus:ring-4 focus:ring-emerald-700/10"
                            value={searchTerm}
                            onChange={(event) => {
                                setLoading(true);
                                setCurrentPage(1);
                                setSearchTerm(event.target.value);
                            }}
                        />
                    </label>
                    <CustomSelect
                        aria-label="Filter products by stock status"
                        value={statusFilter}
                        onChange={(event) => {
                            setLoading(true);
                            setCurrentPage(1);
                            setStatusFilter(event.target.value);
                        }}
                        className="min-h-12 min-w-48 rounded-[14px] border border-slate-200 bg-slate-50/60 px-3.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-emerald-300 hover:bg-white focus:border-[#008577] focus:bg-white focus:ring-4 focus:ring-emerald-700/10"
                    >
                        <option value="All">All stock statuses</option>
                        <option>In Stock</option>
                        <option>Low Stock</option>
                        <option>Out of Stock</option>
                    </CustomSelect>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs font-medium text-slate-500">
                        Showing {pagination.total ? (currentPage - 1) * itemsPerPage + 1 : 0}–{Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} products
                    </p>
                    <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner" role="group" aria-label="Stock view mode">
                        <button
                            type="button"
                            onClick={() => setViewMode("table")}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all ${viewMode === "table" ? "bg-[#003B3B] text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
                            aria-label="Table view"
                            aria-pressed={viewMode === "table"}
                            title="Table view"
                        >
                            <FiList size={17} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("card")}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all ${viewMode === "card" ? "bg-[#003B3B] text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
                            aria-label="Card view"
                            aria-pressed={viewMode === "card"}
                            title="Card view"
                        >
                            <FiGrid size={17} />
                        </button>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div>
                        <h2 className="text-sm font-extrabold text-slate-900">Inventory List</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Review stock levels and update quantities as needed.</p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                        {pagination.total || 0} products
                    </span>
                </div>
                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-[#008577] rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500 font-bold text-sm">Loading stock details...</p>
                        </div>
                    ) : viewMode === "table" ? (
                        <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left">
                            <colgroup>
                                <col className="w-[6%]" />
                                <col className="w-[28%]" />
                                <col className="w-[14%]" />
                                <col className="w-[18%]" />
                                <col className="w-[10%]" />
                                <col className="w-[14%]" />
                                <col className="w-[10%]" />
                            </colgroup>
                            <thead>
                                <tr className="bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577]">
                                    {["S.No.", "Product", "Category", "Price", "Stock", "Status", "Actions"].map((heading) => (
                                        <th key={heading} scope="col" className="whitespace-nowrap border-b border-white/15 px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">{heading}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.length > 0 ? (
                                    currentItems.map((product, index) => {
                                        const stock = getStockLevel(product);
                                        const status = deriveStatus(stock);

                                        return (
                                            <tr key={product.id} className="group h-[86px] odd:bg-white even:bg-slate-50/60 transition-colors hover:bg-emerald-50/70">
                                                <td className="border-b border-slate-100 px-5 py-4 text-sm font-semibold tabular-nums text-slate-500">
                                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                                </td>
                                                <td className="border-b border-slate-100 px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition-transform group-hover:scale-105">
                                                            <img
                                                                src={getProductImage(product)}
                                                                alt={product.name}
                                                                loading="lazy"
                                                                className="w-full h-full object-cover"
                                                                onError={(event) => { event.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name || "P")}&background=random`; }}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="max-w-[220px] truncate text-[15px] font-extrabold leading-tight text-slate-900">{product.name}</p>
                                                            <p className="mt-1 truncate text-[11px] font-medium text-slate-400">SKU: {product.product_code || `SS` + String(product.id).padStart(4,'0')}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="border-b border-slate-100 px-5 py-4">
                                                    <span className="inline-flex rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                                                        {product.category || 'Saree'}
                                                    </span>
                                                </td>
                                                <td className="border-b border-slate-100 px-5 py-4">
                                                    <p className="whitespace-nowrap text-[15px] font-black tabular-nums text-[#07564B]">{formatCurrency(product.offer_price || product.discount_price || product.mrp || 0)}</p>
                                                    {product.mrp && product.offer_price && parseFloat(product.mrp) > parseFloat(product.offer_price) && (
                                                        <p className="mt-0.5 text-[11px] font-medium text-slate-400 line-through">{formatCurrency(product.mrp)}</p>
                                                    )}
                                                </td>
                                                <td className="border-b border-slate-100 px-5 py-4">
                                                    <button
                                                        onClick={() => openUpdateModal(product)}
                                                        aria-label={`Update stock for ${product.name}`}
                                                        title="Click to update stock"
                                                        className="group/stock inline-flex flex-col items-start gap-1 text-sm font-black text-slate-800 transition-colors hover:text-[#006B62]"
                                                    >
                                                        <span className="inline-flex min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 tabular-nums shadow-sm group-hover/stock:border-emerald-200 group-hover/stock:bg-emerald-50">{stock}</span>
                                                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 group-hover/stock:text-emerald-700">units · edit</span>
                                                    </button>
                                                </td>
                                                <td className="border-b border-slate-100 px-5 py-4">
                                                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ` + getStatusStyle(status)}>
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="border-b border-slate-100 px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openUpdateModal(product)}
                                                            aria-label={`Update stock for ${product.name}`}
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 transition-all hover:border-emerald-700 hover:bg-emerald-700 hover:text-white"
                                                            title="Update Stock"
                                                        >
                                                            <FiEdit2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-8 py-16 text-center">
                                            <div className="mx-auto flex max-w-sm flex-col items-center">
                                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FiBox size={22} /></span>
                                                <p className="mt-3 text-sm font-extrabold text-slate-700">No stock data found</p>
                                                <p className="mt-1 text-xs text-slate-500">Try changing your search or stock status filter.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
                            {currentItems.length > 0 ? currentItems.map((product) => {
                                const stock = getStockLevel(product);
                                const status = deriveStatus(stock);

                                return (
                                    <article key={product.id} className="group overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_3px_10px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]">
                                        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-100 to-emerald-50">
                                            <img
                                                src={getProductImage(product)}
                                                alt={product.name}
                                                loading="lazy"
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                onError={(event) => { event.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name || "P")}&background=random`; }}
                                            />
                                            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/20 to-transparent" />
                                            <span className={`absolute right-3 top-3 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-extrabold shadow-sm backdrop-blur-sm ` + getStatusStyle(status)}>{status}</span>
                                        </div>
                                        <div className="p-4 sm:p-[18px]">
                                            <div className="min-h-[104px] min-w-0">
                                                <h3 className="truncate text-[16px] font-extrabold leading-5 text-slate-900">{product.name}</h3>
                                                <p className="mt-1.5 truncate text-[11px] font-medium text-slate-400">SKU: {product.product_code || `SS` + String(product.id).padStart(4, '0')}</p>
                                                <span className="mt-3 inline-flex rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800">
                                                    {product.category || 'Saree'}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3.5">
                                                <div>
                                                    <p className="text-[11px] font-medium text-slate-400">Price</p>
                                                    <p className="mt-1 whitespace-nowrap text-[18px] font-black leading-5 tabular-nums text-slate-900">{formatCurrency(product.offer_price || product.discount_price || product.mrp || 0)}</p>
                                                    {product.mrp && product.offer_price && parseFloat(product.mrp) > parseFloat(product.offer_price) && (
                                                        <p className="mt-1 text-[11px] font-medium text-slate-400 line-through">{formatCurrency(product.mrp)}</p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="whitespace-nowrap text-[11px] font-medium text-slate-400">Available Stock</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => openUpdateModal(product)}
                                                        aria-label={`Update stock for ${product.name}`}
                                                        className="mt-1 inline-flex items-baseline gap-1.5 font-black text-slate-900 transition-colors hover:text-emerald-800"
                                                    >
                                                        <span className="text-[20px] leading-5 tabular-nums">{stock}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">units</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => openUpdateModal(product)}
                                                className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#07564B] to-[#008577] px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_4px_10px_rgba(0,107,98,0.18)] transition-all hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-emerald-700/15"
                                            >
                                                <FiEdit2 size={14} /> Update Stock
                                            </button>
                                        </div>
                                    </article>
                                );
                            }) : (
                                <div className="col-span-full flex flex-col items-center px-8 py-16 text-center">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FiBox size={22} /></span>
                                    <p className="mt-3 text-sm font-extrabold text-slate-700">No stock data found</p>
                                    <p className="mt-1 text-xs text-slate-500">Try changing your search or stock status filter.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Pagination UI */}
                {totalPages > 0 && (
                    <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
                        <p className="text-xs text-gray-500 font-medium">
                            Showing {pagination.total ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} products
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => changePage(Math.max(currentPage - 1, 1))}
                                disabled={currentPage === 1}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-all hover:border-emerald-500 hover:text-emerald-800 disabled:opacity-30"
                            >‹</button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                                const page = firstPage + i;
                                return (
                                    <button
                                        key={page}
                                        onClick={() => changePage(page)}
                                        className={`h-8 w-8 rounded-lg border text-xs font-bold transition-all ` + (currentPage === page ? "border-emerald-700 bg-emerald-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-500")}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            {totalPages > 5 && <span className="text-gray-400 text-sm">...</span>}
                            {totalPages > 5 && (
                                <button
                                    onClick={() => changePage(totalPages)}
                                    className={`h-8 w-8 rounded-lg border text-xs font-bold ` + (currentPage === totalPages ? "border-emerald-700 bg-emerald-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-500")}
                                >
                                    {totalPages}
                                </button>
                            )}
                            <button
                                onClick={() => changePage(Math.min(currentPage + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-all hover:border-emerald-500 hover:text-emerald-800 disabled:opacity-30"
                            >›</button>
                        </div>
                    </div>
                )}
            </section>

            {/* Quick Stock Update Modal */}
            {isModalOpen && selectedProduct && (
                createPortal(
                <div className="fixed inset-0 z-[99] flex h-screen w-screen items-center justify-center bg-transparent p-4">
                    <div className="absolute inset-0 z-0 bg-slate-900/60 backdrop-blur-[3px] animate-in fade-in duration-200" onClick={closeUpdateModal} />
                    <div className="relative z-10 bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800">
                        <div className="bg-gradient-to-r from-[#003B3B] to-[#006B62] p-6 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-white">Quick Stock Update</h3>
                                <p className="text-xs font-bold text-[#F5C45E] mt-1">{selectedProduct.name}</p>
                            </div>
                            <button onClick={closeUpdateModal} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {fetchingDetail ? (
                                <div className="py-10 flex flex-col items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-[#008577] rounded-full animate-spin mb-3"></div>
                                    <p className="text-xs font-bold text-gray-400">Loading variants...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {updatedVariants.length > 0 && updatedVariants.some(v => v.sizesStock && Object.keys(v.sizesStock).length > 0) ? (
                                        // Variant Based Stock
                                        <div className="space-y-4">
                                            {updatedVariants.map((variant, vIndex) => (
                                                <div key={vIndex} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-6 h-6 rounded-full shadow-sm border border-gray-200" style={{ backgroundColor: variant.color }}></div>
                                                        <span className="text-sm font-black text-slate-800">{variant.colorName || 'Default Shade'}</span>
                                                    </div>

                                                    {variant.sizesStock && Object.keys(variant.sizesStock).length > 0 ? (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {Object.entries(variant.sizesStock).map(([size, currentQty]) => (
                                                                <div key={size} className="bg-white border border-gray-200 p-3 rounded-xl">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <label className="text-[10px] font-black text-gray-400 uppercase">{size}</label>
                                                                        <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Curr: {currentQty}</span>
                                                                    </div>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={variantAdditions[`${vIndex}-${size}`] ?? ""}
                                                                        onChange={(e) => handleVariantStockChange(vIndex, size, e.target.value)}
                                                                        className="w-full text-base font-black text-slate-800 outline-none placeholder:text-gray-300 bg-transparent border-b border-gray-100 focus:border-[#008577] transition-colors pb-1"
                                                                        placeholder="Add"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 font-medium">No sizes configured for this variant.</p>
                                                    )}
                                                </div>
                                            ))}
                                            <p className="text-xs text-center bg-emerald-50 text-[#006B62] p-3 rounded-xl font-bold">
                                                Total stock will be auto-calculated from variants.
                                            </p>
                                        </div>
                                    ) : (
                                        // Manual Total Stock
                                        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Add To Current Stock</label>
                                                <span className="text-[10px] font-black text-gray-500 bg-gray-200 px-2 py-1 rounded-full">Current: {selectedProduct.total_stock ?? 0}</span>
                                            </div>
                                            <div className="relative">
                                                <FiBox className="absolute left-4 top-1/2 -translate-y-1/2 text-[#006B62]" />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={manualTotalStock}
                                                    onChange={(e) => setManualTotalStock(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#008577] transition-all text-xl font-black text-slate-800 shadow-sm"
                                                    placeholder="Enter quantity to add"
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-bold mt-2 ml-1">The new total will be current stock + added quantity.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
                            <button
                                onClick={closeUpdateModal}
                                disabled={isUpdating}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveStock}
                                disabled={isUpdating || fetchingDetail}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#003B3B] to-[#006B62] hover:from-[#002e2e] hover:to-[#00564f] text-[#F5C45E] rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {isUpdating ? (
                                    <><div className="w-4 h-4 border-2 border-[#F5C45E]/30 border-t-[#F5C45E] rounded-full animate-spin"></div> Saving...</>
                                ) : (
                                    <><FiSave /> Save Stock</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
                )
            )}

            {isAddStockOpen && (
                <AddStock
                    onClose={() => {
                        setIsAddStockOpen(false);
                        void fetchProducts();
                    }}
                />
            )}

        </div>
    );
};

// SVG Helper Components
const FiCheckCircle = () => <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
export default StockDetails;
