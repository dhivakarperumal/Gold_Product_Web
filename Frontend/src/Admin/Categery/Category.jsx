import CustomSelect from "../../Components/CustomSelect.jsx";
import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import api from "../../api";
import {
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiX,
    FiImage,
    FiUploadCloud,
    FiSearch,
    FiGrid,
    FiList,
    FiChevronLeft,
    FiChevronRight,
    FiCheckCircle,
    FiAlertCircle,
    FiBox,
} from "react-icons/fi";
import imageCompression from "browser-image-compression";
import { toast, Toaster } from "react-hot-toast";
import { useAuth } from "../../PrivateRouter/AuthContext";
import useAdminCachedList from "../useAdminCachedList";
import { resolveBackendImageUrl } from "../../Components/Home/productDisplay";

const getCategoryImageUrl = (images) => {
    let image = images;
    if (typeof image === "string") {
        try {
            const parsed = JSON.parse(image);
            image = Array.isArray(parsed) ? parsed[0] : image;
        } catch {
            // Category image paths may be stored as plain strings.
        }
    }
    if (Array.isArray(image)) image = image[0];
    return typeof image === "string" ? resolveBackendImageUrl(image) : "";
};

const formatAuditDateTime = (dateString) => (
    dateString
        ? new Date(dateString).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
        : "—"
);

const Category = () => {
    const { user } = useAuth();
    // ---- Global State ----
    const {
        data: categories,
        setData: setCategories,
        loading,
        refreshing
    } = useAdminCachedList(`admin:categories:${user?.user_id || "current"}`, async () => {
        const response = await api.get("/categories/manage");
        return response.data;
    }, []);

    // ---- View & Pagination State ----
    const [viewMode, setViewMode] = useState("table"); 
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // ---- Modal State ----
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        catId: "",
        name: "",
        description: "",
        subcategory: "",
        images: []
    });

    const [subcategories, setSubcategories] = useState([]);
    const [subInput, setSubInput] = useState("");

    // ---- Derived Data (Search & Pagination) ----
    const filteredCategories = useMemo(() => {
        return categories.filter(cat => {
            const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  cat.catId.toLowerCase().includes(searchQuery.toLowerCase());
            const catStatus = cat.status || 'Active';
            const matchesStatus = statusFilter === 'All' || catStatus === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [categories, searchQuery, statusFilter]);

    const totalPages = Math.ceil(filteredCategories.length / itemsPerPage) || 1;
    const currentCategories = filteredCategories.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Stats calculations
    const activeCount = categories.filter(c => (c.status || 'Active') === 'Active').length;
    const inactiveCount = categories.filter(c => c.status === 'Inactive').length;

    // ---- Event Handlers ----
    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
    };

    const handleAddSubcategory = (e) => {
        if (e.key === 'Enter' && subInput.trim()) {
            e.preventDefault();
            if (!subcategories.includes(subInput.trim())) {
                setSubcategories([...subcategories, subInput.trim()]);
            }
            setSubInput("");
        }
    };

    const removeSubcategory = (subToRemove) => {
        setSubcategories(subcategories.filter(sub => sub !== subToRemove));
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageUpload = async (e) => {
        try {
            const input = e.currentTarget;
            const files = Array.from(input.files || []);
            input.value = "";
            const remainingSlots = 20 - formData.images.length;
            if (files.length > remainingSlots) {
                toast.error(`You can upload up to 20 images per category.`);
                return;
            }
            const unsupportedFile = files.find(file => !["image/png", "image/jpeg"].includes(file.type));
            if (unsupportedFile) {
                toast.error("Choose PNG or JPG images only.");
                return;
            }
            const oversizedFile = files.find(file => file.size > 5 * 1024 * 1024);
            if (oversizedFile) {
                toast.error("Each image must be 5 MB or smaller.");
                return;
            }
            const imagesArray = await Promise.all(
                files.map(async (file) => {
                    const compressed = await imageCompression(file, {
                        maxSizeMB: 0.2,
                        maxWidthOrHeight: 600,
                    });
                    return imageCompression.getDataUrlFromFile(compressed);
                })
            );

            setFormData((p) => ({
                ...p,
                images: [...(Array.isArray(p.images) ? p.images : []), ...imagesArray],
            }));
            toast.success("Images added!");
        } catch (error) {
            console.error("Image upload failed:", error);
            toast.error("Image upload failed");
        }
    };

    const removeImage = (indexToRemove) => {
        setFormData(p => ({
            ...p,
            images: p.images.filter((_, idx) => idx !== indexToRemove)
        }));
    };

    const handleSaveCategory = async () => {
        if (!formData.name.trim()) return;

        try {
            const imagesToKeep = formData.images.filter(image => !image.startsWith("data:image/"));
            const imageUploads = formData.images.filter(image => image.startsWith("data:image/"));
            const categoryData = new FormData();
            categoryData.append("name", formData.name);
            categoryData.append("description", formData.description || "");
            categoryData.append("subcategory", JSON.stringify(subcategories));
            categoryData.append("images", JSON.stringify(imagesToKeep));

            for (const imageData of imageUploads) {
                let imageBlob = await (await fetch(imageData)).blob();
                if (!["image/png", "image/jpeg"].includes(imageBlob.type)) {
                    imageBlob = await imageCompression(imageBlob, {
                        maxSizeMB: 0.2,
                        maxWidthOrHeight: 600,
                        fileType: "image/jpeg",
                    });
                }
                const extension = imageBlob.type === "image/png" ? "png" : "jpg";
                categoryData.append("images", imageBlob, `category.${extension}`);
            }

            if (isEditing) {
                const response = await api.put(`/categories/${formData.catId}`, categoryData);
                setCategories(categories.map(cat => cat.catId === formData.catId ? response.data : cat));
            } else {
                const response = await api.post("/categories", categoryData);
                setCategories([response.data, ...categories]);
                toast.success("Category created successfully!");
            }
            setIsModalOpen(false);
            resetModalForm();
        } catch (error) {
            console.error("Failed to save category:", error);
            toast.error(error.response?.data?.message || "Failed to save category.");
        }
    };

    const handleDeleteCategory = async (catIdToDelete) => {
        if (window.confirm("Are you sure you want to delete this category?")) {
            try {
                await api.delete(`/categories/${catIdToDelete}`);
                setCategories(categories.filter(cat => cat.catId !== catIdToDelete));

                if (currentCategories.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                }
            } catch (error) {
                console.error("Failed to delete category:", error);
                alert("Failed to delete category.");
            }
        }
    };

    const resetModalForm = () => {
        setFormData({ catId: "", name: "", description: "", subcategory: "", images: [] });
        setSubcategories([]);
        setSubInput("");
        setIsEditing(false);
    };

    const openAddModal = () => {
        resetModalForm();
        setIsModalOpen(true);
    };

    const openEditModal = (category) => {
        setFormData({
            catId: category.catId,
            name: category.name,
            description: category.description,
            subcategory: "",
            images: Array.isArray(category.images) ? category.images : (category.images ? [category.images] : [])
        });
        setSubcategories(category.subcategory || []);
        setSubInput("");
        setIsEditing(true);
        setIsModalOpen(true);
    };

    // ---- Renderers ----
    return (
        <div className="space-y-5 pb-10 font-sans">
            <Toaster position="top-right" />

            <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577] px-6 py-7 text-white shadow-[0_20px_45px_rgba(4,78,69,0.18)] sm:px-9 sm:py-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-28 -z-10 h-80 w-80 rounded-full border border-white/10">
                    <div className="absolute inset-8 rounded-full border border-white/10" />
                </div>
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-3xl">
                        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">
                            Product Management <span className="mx-1.5 text-emerald-200/70">·</span> Category Directory
                        </p>
                        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Categories</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
                            Organize your jewellery collections and keep category details up to date.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2.5 self-start rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-[#064e45] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-white/30 sm:self-center"
                    >
                        <FiPlus size={18} /> Add New Category
                    </button>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    { label: "Total Categories", value: categories.length, sub: "All category collections", icon: <FiBox size={23} />, card: "border-t-[#00b8a9] bg-gradient-to-br from-[#eefbf9] to-white", iconBg: "bg-[#009b8b]", dot: "bg-[#009b8b]", text: "text-[#007d70]" },
                    { label: "Active", value: activeCount, sub: "Currently available", icon: <FiCheckCircle size={23} />, card: "border-t-emerald-500 bg-gradient-to-br from-emerald-50 to-white", iconBg: "bg-emerald-600", dot: "bg-emerald-600", text: "text-emerald-700" },
                    { label: "Inactive", value: inactiveCount, sub: "Unavailable categories", icon: <FiAlertCircle size={23} />, card: "border-t-amber-500 bg-gradient-to-br from-amber-50 to-white", iconBg: "bg-amber-500", dot: "bg-amber-600", text: "text-amber-700" },
                ].map((stat) => (
                    <article key={stat.label} className={`relative flex min-h-[148px] items-center justify-between gap-3 overflow-hidden rounded-[22px] border-x border-b border-t-4 border-x-slate-200/70 border-b-slate-200/70 p-5 shadow-[0_5px_15px_rgba(15,23,42,0.055)] transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${stat.card}`}>
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

            <section aria-label="Category search and filters" className="space-y-4 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <label className="relative min-w-[240px] flex-[1_1_320px]">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
                        <span className="sr-only">Search categories by name or ID</span>
                        <input
                            type="search"
                            placeholder="Search categories by name or ID..."
                            value={searchQuery}
                            onChange={handleSearch}
                            className="min-h-12 w-full rounded-[14px] border border-slate-200 bg-slate-50/60 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#008577] focus:bg-white focus:ring-4 focus:ring-emerald-700/10"
                        />
                    </label>
                    <CustomSelect
                        aria-label="Filter categories by status"
                        value={statusFilter}
                        onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}
                        className="min-h-12 min-w-48 rounded-[14px] border border-slate-200 bg-slate-50/60 px-3.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-emerald-300 hover:bg-white focus:border-[#008577] focus:bg-white focus:ring-4 focus:ring-emerald-700/10"
                    >
                        <option value="All">All statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </CustomSelect>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs font-medium text-slate-500">
                        Showing {filteredCategories.length ? (currentPage - 1) * itemsPerPage + 1 : 0}–{Math.min(currentPage * itemsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
                    </p>
                    <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner" role="group" aria-label="Category view mode">
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
                            onClick={() => setViewMode("grid")}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all ${viewMode === "grid" ? "bg-[#003B3B] text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
                            aria-label="Card view"
                            aria-pressed={viewMode === "grid"}
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
                        <h2 className="text-sm font-extrabold text-slate-900">Category Directory</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Manage collections, product counts, and category status.</p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                        {filteredCategories.length} categories
                    </span>
                </div>
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-emerald-500/20 border-t-[#008577]" />
                        <p className="text-sm font-bold text-slate-500">Loading categories...</p>
                    </div>
                ) : currentCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FiSearch size={22} /></span>
                        <h3 className="mt-3 text-sm font-extrabold text-slate-700">No categories found</h3>
                        <p className="mt-1 text-xs text-slate-500">Adjust your search or status filter to find what you’re looking for.</p>
                    </div>
                ) : viewMode === "table" ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left">
                            <colgroup>
                                <col className="w-[4%]" />
                                <col className="w-[6%]" />
                                <col className="w-[23%]" />
                                <col className="w-[15%]" />
                                <col className="w-[9%]" />
                                <col className="w-[10%]" />
                                <col className="w-[23%]" />
                                <col className="w-[10%]" />
                            </colgroup>
                            <thead>
                                <tr className="bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577]">
                                    <th scope="col" className="border-b border-white/15 px-4 py-4 text-center">
                                        <input aria-label="Select all categories" type="checkbox" className="h-4 w-4 rounded accent-[#F5C45E]" />
                                    </th>
                                    {["S.No.", "Category", "Description", "Products", "Status", "Created / Updated", "Actions"].map((heading) => (
                                        <th key={heading} scope="col" className="whitespace-nowrap border-b border-white/15 px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">{heading}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {currentCategories.map((cat, index) => {
                                    const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                                    const status = cat.status || "Active";
                                    const totalProducts = cat.totalProducts ?? 0;
                                    const imageUrl = getCategoryImageUrl(cat.images);

                                    return (
                                        <tr key={cat.catId} className="group h-[82px] odd:bg-white even:bg-slate-50/60 transition-colors hover:bg-emerald-50/70">
                                            <td className="border-b border-slate-100 px-4 py-4 text-center">
                                                <input aria-label={`Select ${cat.name}`} type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-emerald-700" />
                                            </td>
                                            <td className="border-b border-slate-100 px-5 py-4 text-sm font-semibold tabular-nums text-slate-500">{serialNumber}</td>
                                            <td className="border-b border-slate-100 px-5 py-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                                                        {imageUrl ? (
                                                            <img src={imageUrl} alt={cat.name} onError={(event) => { event.currentTarget.style.display = "none"; }} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <FiImage className="text-slate-400" size={18} />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-sm font-extrabold text-slate-900">{cat.name}</h3>
                                                        <p className="mt-1 truncate text-[11px] font-medium text-slate-400">ID: {cat.catId || "N/A"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="max-w-[220px] border-b border-slate-100 px-5 py-4 text-sm font-medium text-slate-500">
                                                <p className="line-clamp-2 whitespace-normal">{cat.description || "No description"}</p>
                                            </td>
                                            <td className="border-b border-slate-100 px-5 py-4 text-center">
                                                <span className="inline-flex min-w-9 justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-extrabold tabular-nums text-slate-700">{totalProducts}</span>
                                            </td>
                                            <td className="border-b border-slate-100 px-5 py-4">
                                                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${status === "Active" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="border-b border-slate-100 px-5 py-4 text-xs text-slate-500">
                                                <p className="whitespace-nowrap"><span className="font-bold text-slate-700">Created:</span> {cat.created_by_name || cat.created_by || "—"} · {formatAuditDateTime(cat.created_at)}</p>
                                                <p className="mt-1 whitespace-nowrap"><span className="font-bold text-slate-700">Updated:</span> {cat.updated_by_name || cat.updated_by || "—"} · {formatAuditDateTime(cat.updated_at)}</p>
                                            </td>
                                            <td className="border-b border-slate-100 px-5 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button type="button" disabled={refreshing} onClick={() => openEditModal(cat)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 transition-all hover:border-emerald-700 hover:bg-emerald-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50" title="Edit category" aria-label={`Edit ${cat.name}`}>
                                                        <FiEdit2 size={14} />
                                                    </button>
                                                    <button type="button" disabled={refreshing} onClick={() => handleDeleteCategory(cat.catId)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition-all hover:border-rose-600 hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50" title="Delete category" aria-label={`Delete ${cat.name}`}>
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
                        {currentCategories.map((cat) => {
                            const status = cat.status || "Active";
                            const totalProducts = cat.totalProducts ?? 0;
                            const imageUrl = getCategoryImageUrl(cat.images);

                            return (
                                <article key={cat.catId} className="group overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_3px_10px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]">
                                    <div className="relative h-40 overflow-hidden bg-gradient-to-br from-slate-100 to-emerald-50">
                                        {imageUrl ? (
                                            <img src={imageUrl} alt={cat.name} onError={(event) => { event.currentTarget.style.display = "none"; }} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-emerald-800/40"><FiImage size={34} /></div>
                                        )}
                                        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/20 to-transparent" />
                                        <span className={`absolute right-3 top-3 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-extrabold shadow-sm ${status === "Active" ? "border-emerald-100 bg-emerald-50/95 text-emerald-800" : "border-slate-200 bg-white/95 text-slate-600"}`}>{status}</span>
                                    </div>
                                    <div className="p-4 sm:p-[18px]">
                                        <div className="min-h-[104px]">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="truncate text-base font-extrabold text-slate-900">{cat.name}</h3>
                                                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{cat.catId || "N/A"}</span>
                                            </div>
                                            <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-5 text-slate-500">{cat.description || "No description provided."}</p>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3.5">
                                            <div>
                                                <p className="text-[11px] font-medium text-slate-400">Products</p>
                                                <p className="mt-1 text-lg font-black tabular-nums text-slate-900">{totalProducts}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] font-medium text-slate-400">Status</p>
                                                <p className={`mt-1 text-sm font-extrabold ${status === "Active" ? "text-emerald-700" : "text-slate-500"}`}>{status}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">
                                            <p className="truncate"><span className="font-bold text-slate-700">Created:</span> {cat.created_by_name || cat.created_by || "—"} · {formatAuditDateTime(cat.created_at)}</p>
                                            <p className="truncate"><span className="font-bold text-slate-700">Updated:</span> {cat.updated_by_name || cat.updated_by || "—"} · {formatAuditDateTime(cat.updated_at)}</p>
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <button type="button" disabled={refreshing} onClick={() => openEditModal(cat)} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#07564B] to-[#008577] px-3 py-2 text-xs font-extrabold text-white shadow-[0_4px_10px_rgba(0,107,98,0.18)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                                                <FiEdit2 size={13} /> Edit Category
                                            </button>
                                            <button type="button" disabled={refreshing} onClick={() => handleDeleteCategory(cat.catId)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition-colors hover:border-rose-600 hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50" title="Delete category" aria-label={`Delete ${cat.name}`}>
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
                {!loading && filteredCategories.length > 0 && (
                    <div className="flex flex-col gap-4 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-medium text-slate-500">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                                disabled={currentPage === 1}
                                aria-label="Previous page"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-emerald-500 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <FiChevronLeft size={16} />
                            </button>
                            <span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-emerald-700 bg-emerald-700 px-3 text-sm font-bold text-white shadow-sm">
                                {currentPage} <span className="mx-1 text-emerald-200">/</span> {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                aria-label="Next page"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-emerald-500 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <FiChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Add/Edit Category Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="category-modal-title"
                        className="flex max-h-[92vh] w-full max-w-3xl animate-in zoom-in-95 flex-col overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_28px_90px_rgba(2,20,18,0.35)] duration-200"
                    >
                        <div className="relative isolate overflow-hidden bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577] px-5 py-5 text-white sm:px-7">
                            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-32 -z-10 h-64 w-64 rounded-full border border-white/10">
                                <div className="absolute inset-8 rounded-full border border-white/10" />
                            </div>
                            <div className="relative flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">Category Management</p>
                                    <h2 id="category-modal-title" className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                                        {isEditing ? "Edit Category" : "Add New Category"}
                                    </h2>
                                    <p className="mt-1 text-xs text-emerald-50 sm:text-sm">
                                        {isEditing ? "Update collection details and images." : "Create a collection and organize its products."}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    {isEditing && (
                                        <span className="hidden rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white sm:inline-flex">
                                            ID: {formData.catId}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        aria-label="Close category form"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
                                    >
                                        <FiX size={19} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
                            <div className="grid grid-cols-1 gap-7 md:grid-cols-2 md:gap-8">
                                <section className="space-y-5" aria-label="Category details">
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-800">Basic details</h3>
                                        <p className="mt-1 text-xs text-slate-500">Set the category name and a short description.</p>
                                    </div>
                                    <div>
                                        <label htmlFor="category-id" className="mb-1.5 block text-xs font-bold text-slate-700">Category ID</label>
                                        <input
                                            id="category-id"
                                            type="text"
                                            name="catId"
                                            value={isEditing ? formData.catId : "Assigned automatically on save"}
                                            readOnly
                                            className="min-h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="category-name" className="mb-1.5 block text-xs font-bold text-slate-700">
                                            Category Name <span className="text-rose-500" aria-hidden="true">*</span>
                                        </label>
                                        <input
                                            id="category-name"
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Gold Necklace"
                                            required
                                            autoFocus
                                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="category-description" className="mb-1.5 block text-xs font-bold text-slate-700">Description <span className="font-medium text-slate-400">(optional)</span></label>
                                        <textarea
                                            id="category-description"
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            placeholder="Add a short description for this category..."
                                            rows="5"
                                            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10"
                                        />
                                    </div>
                                </section>

                                <section className="space-y-5" aria-label="Subcategories and images">
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-800">Organization & media</h3>
                                        <p className="mt-1 text-xs text-slate-500">Add optional subcategories and collection images.</p>
                                    </div>
                                    <div>
                                        <div className="mb-1.5 flex items-center justify-between gap-3">
                                            <label htmlFor="subcategory-input" className="text-xs font-bold text-slate-700">Subcategories <span className="font-medium text-slate-400">(optional)</span></label>
                                            <span className="text-[10px] font-medium text-slate-400">Press Enter to add</span>
                                        </div>
                                        <div className="min-h-[120px] rounded-xl border border-slate-200 bg-white p-3 transition focus-within:border-[#008577] focus-within:ring-4 focus-within:ring-emerald-700/10">
                                            {subcategories.length > 0 && (
                                                <div className="mb-2 flex flex-wrap gap-2">
                                                    {subcategories.map((sub, index) => (
                                                        <span key={`${sub}-${index}`} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800">
                                                            {sub}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSubcategory(sub)}
                                                                aria-label={`Remove ${sub}`}
                                                                className="text-emerald-700 transition-colors hover:text-rose-600"
                                                            >
                                                                <FiX size={13} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <input
                                                id="subcategory-input"
                                                type="text"
                                                value={subInput}
                                                onChange={(event) => setSubInput(event.target.value)}
                                                onKeyDown={handleAddSubcategory}
                                                placeholder="Type a subcategory and press Enter..."
                                                className="min-h-8 w-full bg-transparent px-1 py-1 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-1.5 flex items-center justify-between gap-3">
                                            <label className="text-xs font-bold text-slate-700">Category Images <span className="font-medium text-slate-400">(optional)</span></label>
                                            <span className="text-[10px] font-semibold text-slate-400">{formData.images.length}/20 images</span>
                                        </div>
                                        {formData.images.length > 0 ? (
                                            <div className="grid grid-cols-3 gap-2.5">
                                                {formData.images.map((image, index) => (
                                                    <div key={index} className="group/image relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                                        <img src={getCategoryImageUrl(image)} alt={`Category image ${index + 1}`} className="h-full w-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeImage(index)}
                                                            aria-label={`Remove image ${index + 1}`}
                                                            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-rose-600 shadow-sm transition-colors hover:bg-rose-50"
                                                        >
                                                            <FiX size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {formData.images.length < 20 && (
                                                    <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition-colors hover:border-[#008577] hover:bg-emerald-50/60 focus-within:border-[#008577] focus-within:ring-4 focus-within:ring-emerald-700/10">
                                                        <FiPlus className="mb-1 text-emerald-700" size={18} />
                                                        <span className="text-[10px] font-bold text-slate-600">Add images</span>
                                                        <input type="file" accept="image/png,image/jpeg" multiple onChange={handleImageUpload} className="sr-only" />
                                                    </label>
                                                )}
                                            </div>
                                        ) : (
                                            <label className="flex min-h-[154px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-6 text-center transition-colors hover:border-[#008577] hover:bg-emerald-50/60 focus-within:border-[#008577] focus-within:ring-4 focus-within:ring-emerald-700/10">
                                                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                                                    <FiUploadCloud size={19} />
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">Upload category images</span>
                                                <span className="mt-1 text-[10px] font-medium text-slate-500">PNG or JPG · up to 5 MB each · max 20</span>
                                                <input type="file" accept="image/png,image/jpeg" multiple onChange={handleImageUpload} className="sr-only" />
                                            </label>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-7">
                            <p className="hidden text-xs text-slate-500 sm:block"><span className="text-rose-500">*</span> Required field</p>
                            <div className="ml-auto flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="min-h-11 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-300/60"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCategory}
                                    disabled={!formData.name.trim()}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#07564B] to-[#008577] px-6 py-2.5 text-sm font-extrabold text-white shadow-[0_5px_14px_rgba(0,107,98,0.2)] transition-all hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-emerald-700/15 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                                >
                                    {isEditing ? "Update Category" : "Save Category"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};

export default Category;
