import CustomSelect from "../../Components/CustomSelect.jsx";
import { useMemo, useState } from "react";
import api from "../../api";
import { toast } from "react-hot-toast";
import useAdminCachedList from "../useAdminCachedList";
import { useAuth } from "../../PrivateRouter/AuthContext";
import imageCompression from "browser-image-compression";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiGrid,
  FiImage,
  FiLayers,
  FiList,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiX
} from "react-icons/fi";
import { resolveBackendImageUrl } from "../../Components/Home/productDisplay";

const EMPTY_FORM = { name: "", purity: "", description: "", image: "", status: "Active" };

const getMetalImageUrl = (image) => {
  return typeof image === "string" ? resolveBackendImageUrl(image) : "";
};

const formatAuditDateTime = (dateString) => (
  dateString
    ? new Date(dateString).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "—"
);

const Metals = () => {
  const { user } = useAuth();
  const { data: metals, setData: setMetals, loading, refreshing } = useAdminCachedList(
    `admin:metals:${user?.user_id || "current"}`,
    async () => {
      const response = await api.get("/metals/manage");
      return response.data;
    },
    []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewMode, setViewMode] = useState("table");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMetal, setEditingMetal] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const filteredMetals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return metals.filter((metal) => {
      const matchesSearch = !query || [metal.name, metal.purity, metal.description]
        .some((value) => String(value || "").toLowerCase().includes(query));
      const matchesStatus = statusFilter === "All" || (metal.status || "Active") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [metals, searchQuery, statusFilter]);

  const activeCount = metals.filter((metal) => (metal.status || "Active") === "Active").length;
  const inactiveCount = metals.length - activeCount;

  const openAddModal = () => {
    setEditingMetal(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (metal) => {
    setEditingMetal(metal);
    setFormData({
      name: metal.name || "",
      purity: metal.purity || "",
      description: metal.description || "",
      image: getMetalImageUrl(metal.image),
      imagePath: metal.image || "",
      status: metal.status || "Active"
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingMetal(null);
    setFormData(EMPTY_FORM);
  };

  const handleImageUpload = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Choose a PNG or JPG image.");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller.");
      input.value = "";
      return;
    }

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 800
      });
      const image = await imageCompression.getDataUrlFromFile(compressed);
      setFormData((current) => ({ ...current, image }));
    } catch (error) {
      console.error("Failed to process metal image:", error);
      toast.error("Could not process this image. Please try another file.");
    } finally {
      input.value = "";
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const payload = {
      name: formData.name.trim(),
      purity: formData.purity.trim(),
      description: formData.description.trim(),
      image: formData.imagePath || null,
      status: formData.status
    };
    if (!payload.name) {
      toast.error("Enter a metal name.");
      return;
    }

    try {
      setSaving(true);
      if (formData.image?.startsWith("data:image/")) {
        const imageBlob = await (await fetch(formData.image)).blob();
        const imageForm = new FormData();
        imageForm.append("image", imageBlob, imageBlob.type === "image/png" ? "metal.png" : "metal.jpg");
        const uploaded = await api.post("/metals/images", imageForm);
        payload.image = uploaded.data.image;
      }
      if (editingMetal) {
        const response = await api.put(`/metals/${editingMetal.id}`, payload);
        setMetals((current) => current.map((metal) =>
          metal.id === editingMetal.id ? response.data : metal
        ));
        toast.success("Metal updated successfully.");
      } else {
        const response = await api.post("/metals", payload);
        setMetals((current) => [response.data, ...current]);
        toast.success("Metal added successfully.");
      }
      setIsModalOpen(false);
      setEditingMetal(null);
      setFormData(EMPTY_FORM);
    } catch (error) {
      console.error("Failed to save metal:", error);
      toast.error(error.response?.data?.message || "Failed to save metal.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (metal) => {
    if (!window.confirm(`Delete ${metal.name}?`)) return;
    try {
      await api.delete(`/metals/${metal.id}`);
      setMetals((current) => current.filter((item) => item.id !== metal.id));
      toast.success("Metal deleted successfully.");
    } catch (error) {
      console.error("Failed to delete metal:", error);
      toast.error(error.response?.data?.message || "Failed to delete metal.");
    }
  };

  return (
    <div className="space-y-5 pb-10 font-sans">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577] px-6 py-7 text-white shadow-[0_20px_45px_rgba(4,78,69,0.18)] sm:px-9 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-28 -z-10 h-80 w-80 rounded-full border border-white/10">
          <div className="absolute inset-8 rounded-full border border-white/10" />
        </div>
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">
              Product Management <span className="mx-1.5 text-emerald-200/70">·</span> Metal Directory
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Add Metal</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
              Manage metal types, purity details, and availability for your product catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2.5 self-start rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-[#064e45] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-white/30 sm:self-center"
          >
            <FiPlus size={18} /> Add Metal
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Metals", value: metals.length, sub: "All metal types", icon: <FiLayers size={23} />, card: "border-t-[#00b8a9] bg-gradient-to-br from-[#eefbf9] to-white", iconBg: "bg-[#009b8b]", dot: "bg-[#009b8b]", text: "text-[#007d70]" },
          { label: "Active", value: activeCount, sub: "Currently available", icon: <FiCheckCircle size={23} />, card: "border-t-emerald-500 bg-gradient-to-br from-emerald-50 to-white", iconBg: "bg-emerald-600", dot: "bg-emerald-600", text: "text-emerald-700" },
          { label: "Inactive", value: inactiveCount, sub: "Unavailable metals", icon: <FiAlertCircle size={23} />, card: "border-t-amber-500 bg-gradient-to-br from-amber-50 to-white", iconBg: "bg-amber-500", dot: "bg-amber-600", text: "text-amber-700" },
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

      <section aria-label="Metal search and filters" className="space-y-4 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-[1_1_320px]">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
            <span className="sr-only">Search metals by name, purity, or description</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search metals, purity, or description..."
              className="min-h-12 w-full rounded-[14px] border border-slate-200 bg-slate-50/60 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#008577] focus:bg-white focus:ring-4 focus:ring-emerald-700/10"
            />
          </label>
          <CustomSelect
            aria-label="Filter metals by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-12 min-w-48 rounded-[14px] border border-slate-200 bg-slate-50/60 px-3.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-emerald-300 hover:bg-white focus:border-[#008577] focus:bg-white focus:ring-4 focus:ring-emerald-700/10"
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </CustomSelect>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">Showing {filteredMetals.length} of {metals.length} metals</p>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner" role="group" aria-label="Metal view mode">
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
              onClick={() => setViewMode("cards")}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all ${viewMode === "cards" ? "bg-[#003B3B] text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
              aria-label="Card view"
              aria-pressed={viewMode === "cards"}
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
            <h2 className="text-sm font-extrabold text-slate-900">Metal Directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">Review metal types, purity, and availability.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
            {filteredMetals.length} metals
          </span>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-emerald-500/20 border-t-[#008577]" />
            <p className="text-sm font-bold text-slate-500">Loading metals...</p>
          </div>
        ) : filteredMetals.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FiSearch size={22} /></span>
            <h3 className="mt-3 text-sm font-extrabold text-slate-700">No metals found</h3>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery || statusFilter !== "All" ? "Try changing your search or status filter." : "Add a metal to get started."}
            </p>
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-left">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[21%]" />
                <col className="w-[10%]" />
                <col className="w-[19%]" />
                <col className="w-[12%]" />
                <col className="w-[23%]" />
                <col className="w-[9%]" />
              </colgroup>
              <thead>
                <tr className="bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577]">
                  {["S No", "Metal", "Purity", "Description", "Status", "Created / Updated", "Actions"].map((heading) => (
                    <th key={heading} scope="col" className="whitespace-nowrap border-b border-white/15 px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMetals.map((metal, index) => {
                  const status = metal.status || "Active";
                  const imageUrl = getMetalImageUrl(metal.image);
                  return (
                    <tr key={metal.id} className="group h-[82px] odd:bg-white even:bg-slate-50/60 transition-colors hover:bg-emerald-50/70">
                      <td className="border-b border-slate-100 px-5 py-4 text-sm font-semibold tabular-nums text-slate-500">{index + 1}</td>
                      <td className="border-b border-slate-100 px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                            {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <FiImage className="text-slate-400" size={18} />}
                          </div>
                          <span className="truncate text-sm font-extrabold text-slate-900">{metal.name}</span>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-5 py-4 text-sm font-semibold tabular-nums text-slate-700">{metal.purity || "—"}</td>
                      <td className="max-w-[240px] border-b border-slate-100 px-5 py-4 text-sm font-medium text-slate-500">
                        <p className="line-clamp-2 whitespace-normal">{metal.description || "—"}</p>
                      </td>
                      <td className="border-b border-slate-100 px-5 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${status === "Active" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                          {status}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-5 py-4 text-xs text-slate-500">
                        <p className="whitespace-nowrap"><span className="font-bold text-slate-700">Created:</span> {metal.created_by_name || metal.created_by || "—"} · {formatAuditDateTime(metal.created_at)}</p>
                        <p className="mt-1 whitespace-nowrap"><span className="font-bold text-slate-700">Updated:</span> {metal.updated_by_name || metal.updated_by || "—"} · {formatAuditDateTime(metal.updated_at)}</p>
                      </td>
                      <td className="border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" disabled={refreshing} onClick={() => openEditModal(metal)} aria-label={`Edit ${metal.name}`} title="Edit metal" className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 transition-all hover:border-emerald-700 hover:bg-emerald-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                            <FiEdit2 size={14} />
                          </button>
                          <button type="button" disabled={refreshing} onClick={() => handleDelete(metal)} aria-label={`Delete ${metal.name}`} title="Delete metal" className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition-all hover:border-rose-600 hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
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
            {filteredMetals.map((metal) => {
              const status = metal.status || "Active";
              const imageUrl = getMetalImageUrl(metal.image);
              return (
                <article key={metal.id} className="group overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_3px_10px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]">
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-slate-100 to-emerald-50">
                    {imageUrl ? (
                      <img src={imageUrl} alt={metal.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-emerald-800/40"><FiImage size={34} /></div>
                    )}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/20 to-transparent" />
                    <span className={`absolute right-3 top-3 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-extrabold shadow-sm ${status === "Active" ? "border-emerald-100 bg-emerald-50/95 text-emerald-800" : "border-slate-200 bg-white/95 text-slate-600"}`}>{status}</span>
                  </div>
                  <div className="p-4 sm:p-[18px]">
                    <div className="min-h-[83px]">
                      <h3 className="truncate text-base font-extrabold text-slate-900">{metal.name}</h3>
                      <p className="mt-1.5 text-xs text-slate-500">Purity: <span className="font-bold text-slate-700">{metal.purity || "Not specified"}</span></p>
                      <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-5 text-slate-500">{metal.description || "No description provided."}</p>
                    </div>
                    <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">
                      <p className="truncate"><span className="font-bold text-slate-700">Created:</span> {metal.created_by_name || metal.created_by || "—"} · {formatAuditDateTime(metal.created_at)}</p>
                      <p className="truncate"><span className="font-bold text-slate-700">Updated:</span> {metal.updated_by_name || metal.updated_by || "—"} · {formatAuditDateTime(metal.updated_at)}</p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button type="button" disabled={refreshing} onClick={() => openEditModal(metal)} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#07564B] to-[#008577] px-3 py-2 text-xs font-extrabold text-white shadow-[0_4px_10px_rgba(0,107,98,0.18)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                        <FiEdit2 size={13} /> Edit Metal
                      </button>
                      <button type="button" disabled={refreshing} onClick={() => handleDelete(metal)} aria-label={`Delete ${metal.name}`} title="Delete metal" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition-colors hover:border-rose-600 hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <form
            onSubmit={handleSave}
            role="dialog"
            aria-modal="true"
            aria-labelledby="metal-modal-title"
            className="flex max-h-[92vh] w-full max-w-3xl animate-in zoom-in-95 flex-col overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_28px_90px_rgba(2,20,18,0.35)] duration-200"
          >
            <div className="relative isolate overflow-hidden bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577] px-5 py-5 text-white sm:px-7">
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-32 -z-10 h-64 w-64 rounded-full border border-white/10">
                <div className="absolute inset-8 rounded-full border border-white/10" />
              </div>
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">Metal Management</p>
                  <h2 id="metal-modal-title" className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{editingMetal ? "Edit Metal" : "Add Metal"}</h2>
                  <p className="mt-1 text-xs text-emerald-50 sm:text-sm">Enter the metal type and catalog details.</p>
                </div>
                <button type="button" onClick={closeModal} disabled={saving} aria-label="Close dialog" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-50">
                  <FiX size={19} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-7">
              <div className="grid grid-cols-1 gap-7 md:grid-cols-2 md:gap-8">
                <section className="space-y-5" aria-label="Metal details">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">Basic details</h3>
                    <p className="mt-1 text-xs text-slate-500">Set the name, purity, and a short description.</p>
                  </div>
                  <label className="block text-xs font-bold text-slate-700">
                    Metal Name <span className="text-rose-500" aria-hidden="true">*</span>
                    <input
                      required
                      maxLength={100}
                      autoFocus
                      value={formData.name}
                      onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                      placeholder="e.g. Gold"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">
                    Purity <span className="font-medium text-slate-400">(optional)</span>
                    <input
                      maxLength={50}
                      value={formData.purity}
                      onChange={(event) => setFormData((current) => ({ ...current, purity: event.target.value }))}
                      placeholder="e.g. 22K or 24K"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">
                    Description <span className="font-medium text-slate-400">(optional)</span>
                    <textarea
                      rows={5}
                      value={formData.description}
                      onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Add optional details about this metal..."
                      className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10"
                    />
                  </label>
                </section>
                <section className="space-y-5" aria-label="Metal image and status">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">Image & availability</h3>
                    <p className="mt-1 text-xs text-slate-500">Add a clear metal image and set its status.</p>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-700">Metal Image <span className="font-medium text-slate-400">(optional)</span></span>
                    {formData.image ? (
                      <div className="relative mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img src={getMetalImageUrl(formData.image)} alt="Metal preview" className="h-48 w-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setFormData((current) => ({ ...current, image: "" }))}
                          aria-label="Remove metal image"
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-rose-600 shadow-sm transition hover:bg-rose-50"
                        >
                          <FiX size={15} />
                        </button>
                      </div>
                    ) : (
                      <label className="mt-1.5 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-center transition hover:border-[#008577] hover:bg-emerald-50/60 focus-within:border-[#008577] focus-within:ring-4 focus-within:ring-emerald-700/10">
                        <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><FiUploadCloud size={19} /></span>
                        <span className="text-sm font-bold text-slate-700">Upload a metal image</span>
                        <span className="mt-1 text-xs text-slate-500">PNG or JPG · up to 5 MB</span>
                        <input type="file" accept="image/png,image/jpeg" onChange={handleImageUpload} className="sr-only" />
                      </label>
                    )}
                  </div>
                  <label className="block text-xs font-bold text-slate-700">
                    Status
                    <CustomSelect
                      value={formData.status}
                      onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </CustomSelect>
                  </label>
                </section>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-7">
              <p className="hidden text-xs text-slate-500 sm:block"><span className="text-rose-500">*</span> Required field</p>
              <div className="ml-auto flex items-center gap-3">
                <button type="button" onClick={closeModal} disabled={saving} className="min-h-11 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-300/60 disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !formData.name.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#07564B] to-[#008577] px-6 py-2.5 text-sm font-extrabold text-white shadow-[0_5px_14px_rgba(0,107,98,0.2)] transition-all hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-emerald-700/15 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
                  {saving ? "Saving..." : editingMetal ? "Save Changes" : "Save Metal"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Metals;
