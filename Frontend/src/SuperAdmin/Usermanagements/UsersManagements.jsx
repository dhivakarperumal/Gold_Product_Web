import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import {
    FiCalendar,
    FiChevronLeft,
    FiChevronRight,
    FiEdit2,
    FiEye,
    FiGrid,
    FiList,
    FiMail,
    FiPhone,
    FiPlus,
    FiSearch,
    FiTrash2,
    FiUser,
    FiUserCheck,
    FiUserPlus,
    FiUserX,
    FiX,
} from "react-icons/fi";
import { toast } from "react-hot-toast";

const PAGE_SIZE = 8;
const DATE_RANGE_OPTIONS = [
    ["all", "All Time"],
    ["today", "Today"],
    ["yesterday", "Yesterday"],
    ["this_week", "This Week"],
    ["last_week", "Last Week"],
    ["this_month", "This Month"],
    ["last_month", "Last Month"],
    ["this_year", "This Year"],
    ["last_year", "Last Year"],
    ["custom", "Custom Date Range"],
];
const superAdminStatTones = {
    forest: {
        card: "border-[#2F6B59] border-l-emerald-400 bg-[#123B32]",
        icon: "bg-[#08745D] text-white",
        label: "text-emerald-50/90",
        detail: "text-emerald-300",
        bars: "bg-emerald-300",
    },
    gold: {
        card: "border-[#8A702E] border-l-amber-400 bg-[#443719]",
        icon: "bg-[#C58B11] text-white",
        label: "text-amber-50/90",
        detail: "text-amber-300",
        bars: "bg-amber-300",
    },
    blue: {
        card: "border-[#3B7897] border-l-sky-400 bg-[#17364D]",
        icon: "bg-[#007A61] text-white",
        label: "text-sky-50/90",
        detail: "text-sky-300",
        bars: "bg-sky-300",
    },
    rust: {
        card: "border-[#905342] border-l-orange-300 bg-[#4A2B25]",
        icon: "bg-[#C58B11] text-white",
        label: "text-orange-50/90",
        detail: "text-orange-200",
        bars: "bg-orange-200",
    },
};

const getUserStatus = (user) =>
    String(user?.status || "Active").toLowerCase() === "inactive" ? "Inactive" : "Active";

const formatJoinDate = (value, options) => {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Not available"
        : date.toLocaleDateString("en-IN", options);
};

const getInitials = (name) =>
    String(name || "Customer")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

const dateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const shiftDays = (date, days) => {
    const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    shifted.setDate(shifted.getDate() + days);
    return shifted;
};

const resolveDatePreset = (preset, now = new Date()) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekday = (today.getDay() + 6) % 7;
    const ranges = {
        all: null,
        today: [today, today],
        yesterday: [shiftDays(today, -1), shiftDays(today, -1)],
        this_week: [shiftDays(today, -weekday), shiftDays(today, 6 - weekday)],
        last_week: [shiftDays(today, -weekday - 7), shiftDays(today, -weekday - 1)],
        this_month: [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0)],
        last_month: [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)],
        this_year: [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)],
        last_year: [new Date(today.getFullYear() - 1, 0, 1), new Date(today.getFullYear() - 1, 11, 31)],
    };
    const range = ranges[preset];
    return range
        ? { preset, startDate: dateString(range[0]), endDate: dateString(range[1]) }
        : { preset: "all", startDate: "", endDate: "" };
};

function SuperAdminDateRangeFilter({ onApply }) {
    const [preset, setPreset] = useState("all");
    const [customRange, setCustomRange] = useState({ startDate: "", endDate: "" });
    const [error, setError] = useState("");

    const selectPreset = (value) => {
        setPreset(value);
        setError("");
        if (value !== "custom") onApply(resolveDatePreset(value));
    };

    const applyCustomRange = () => {
        if (!customRange.startDate || !customRange.endDate) {
            setError("Choose both start and end dates.");
            return;
        }
        if (customRange.startDate > customRange.endDate) {
            setError("Start date cannot be later than end date.");
            return;
        }
        setError("");
        onApply({ preset: "custom", ...customRange });
    };

    const clearFilter = () => {
        setPreset("all");
        setCustomRange({ startDate: "", endDate: "" });
        setError("");
        onApply(resolveDatePreset("all"));
    };

    return (
        <div>
            <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus-within:border-[#008577] focus-within:ring-2 focus-within:ring-emerald-800/10">
                <FiCalendar size={16} className="shrink-0 text-[#008577]" />
                <span className="sr-only">Filter users by date</span>
                <select value={preset} onChange={(event) => selectPreset(event.target.value)} className="w-full bg-transparent py-2 text-slate-700 outline-none [&_option]:text-slate-900">
                    {DATE_RANGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </label>
            {preset === "custom" && (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                    <label className="text-xs font-semibold text-slate-600">
                        Start Date
                        <input type="date" value={customRange.startDate} onChange={(event) => setCustomRange((range) => ({ ...range, startDate: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 focus:border-[#008577] focus:outline-none" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        End Date
                        <input type="date" value={customRange.endDate} min={customRange.startDate || undefined} onChange={(event) => setCustomRange((range) => ({ ...range, endDate: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 focus:border-[#008577] focus:outline-none" />
                    </label>
                    <button type="button" onClick={applyCustomRange} className="min-h-10 rounded-lg bg-[#003B3B] px-4 text-sm font-bold text-white transition hover:bg-[#008577]">Apply Filter</button>
                    <button type="button" onClick={clearFilter} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Clear Filter</button>
                    {error && <p role="alert" className="text-xs font-semibold text-rose-600 sm:col-span-4">{error}</p>}
                </div>
            )}
        </div>
    );
}

const Usersmanagements = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [viewMode, setViewMode] = useState("table");
    const [dateRange, setDateRange] = useState({ preset: "all", startDate: "", endDate: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editUserId, setEditUserId] = useState(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [statusUpdatingUserId, setStatusUpdatingUserId] = useState(null);
    const [formData, setFormData] = useState({
        username: "",
        name: "",
        email: "",
        phone: "",
        role: "user",
        password: "",
    });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(true);
    const [error, setError] = useState(null);
    const requestId = useRef(0);

    const fetchUsers = useCallback(async () => {
        const currentRequestId = ++requestId.current;
        setLoading(true);
        setRefreshing(true);
        setError(null);
        try {
            const response = await api.get("/auth/users", {
                params: { startDate: dateRange.startDate, endDate: dateRange.endDate }
            });
            const data = response.data;
            const records = Array.isArray(data)
                ? data
                : Array.isArray(data?.users)
                    ? data.users
                    : Array.isArray(data?.data)
                        ? data.data
                        : null;

            if (!records) throw new Error("The server returned an invalid user list.");
            const normalizedUsers = records.map((user) => ({
                ...user,
                id: user.id ?? user.user_id,
                name: user.name || user.username || "User",
                email: user.email || "",
                phone: user.phone || "",
                role: String(user.role || "user").toLowerCase(),
                status: getUserStatus(user),
            }));
            if (requestId.current === currentRequestId) setUsers(normalizedUsers);
            return normalizedUsers;
        } catch (fetchError) {
            if (requestId.current === currentRequestId) setError(fetchError);
            throw fetchError;
        } finally {
            if (requestId.current === currentRequestId) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [dateRange.endDate, dateRange.startDate]);

    useEffect(() => {
        fetchUsers().catch(() => {});
        return () => { requestId.current += 1; };
    }, [fetchUsers]);

    useEffect(() => {
        if (error) {
            console.error("Failed to fetch customers:", error);
            toast.error(error.response?.data?.message || error.message || "Failed to load customers.");
        }
    }, [error]);

    useEffect(() => {
        setSelectedUserId((currentId) =>
            users.some((user) => String(user.id) === String(currentId))
                ? currentId
                : users[0]?.id ?? null
        );
    }, [users]);

    const todayCount = users.filter((user) => {
        if (!user.created_at) return false;
        const joined = new Date(user.created_at);
        const today = new Date();
        return joined.toDateString() === today.toDateString();
    }).length;
    const activeCount = users.filter((user) => user.status === "Active").length;
    const inactiveCount = users.length - activeCount;

    const filteredUsers = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return users.filter((user) => {
            const matchesSearch = !query || [
                user.name,
                user.email,
                user.phone,
                user.id,
            ].some((value) => String(value || "").toLowerCase().includes(query));
            const matchesStatus = statusFilter === "all" || user.status.toLowerCase() === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [users, searchTerm, statusFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
    const safePage = Math.min(currentPage, Math.max(totalPages, 1));
    const currentItems = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const selectedUser = users.find((user) => String(user.id) === String(selectedUserId)) || null;

    const openAddModal = () => {
        setFormData({ username: "", name: "", email: "", phone: "", role: "user", password: "" });
        setIsEditing(false);
        setEditUserId(null);
        setIsModalOpen(true);
    };

    const openEditModal = (user) => {
        if (refreshing) return;
        setFormData({
            username: user.username || user.name,
            name: user.name || "",
            email: user.email || "",
            phone: user.phone || "",
            role: user.role || "user",
            password: "",
        });
        setEditUserId(user.id);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleSaveUser = async (event) => {
        event.preventDefault();
        if (refreshing) return;
        if (!formData.username.trim() || !formData.email.trim() || (!isEditing && !formData.password)) {
            toast.error("Please complete the required customer fields.");
            return;
        }

        setSubmitLoading(true);
        try {
            const payload = {
                ...formData,
                username: formData.username.trim(),
                name: formData.name.trim() || formData.username.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                role: formData.role.toLowerCase(),
            };
            if (isEditing) {
                delete payload.password;
                await api.put(`/auth/users/${editUserId}`, payload);
                toast.success("Customer updated successfully.");
            } else {
                await api.post("/auth/users", payload);
                toast.success("Customer added successfully.");
            }
            setIsModalOpen(false);
            await fetchUsers();
        } catch (error) {
            console.error("Failed to save customer:", error);
            toast.error(error.response?.data?.message || "Could not save this customer.");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (refreshing) return;
        if (!window.confirm(`Delete ${user.name} from the customer list? This cannot be undone.`)) return;
        try {
            await api.delete(`/auth/users/${user.id}`);
            toast.success("Customer deleted.");
            await fetchUsers();
        } catch (error) {
            console.error("Failed to delete customer:", error);
            toast.error(error.response?.data?.message || "Could not delete this customer.");
        }
    };

    const handleStatusChange = async (user, status) => {
        if (refreshing || statusUpdatingUserId !== null || user.status === status) return;
        setStatusUpdatingUserId(user.id);
        try {
            await api.put(`/auth/users/${user.id}`, {
                username: user.username || user.name,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                status: status.toLowerCase(),
            });
            setUsers((currentUsers) => currentUsers.map((currentUser) =>
                String(currentUser.id) === String(user.id)
                    ? { ...currentUser, status }
                    : currentUser
            ));
            toast.success(`${user.name} status changed to ${status.toLowerCase()}.`);
        } catch (error) {
            console.error("Failed to update customer status:", error);
            toast.error(error.response?.data?.message || "Could not update customer status.");
        } finally {
            setStatusUpdatingUserId(null);
        }
    };

    const statCards = [
        { label: "Total Customers", value: users.length, note: "Registered accounts", icon: FiUserPlus, tone: "forest" },
        { label: "New Today", value: todayCount, note: "Joined today", icon: FiUserCheck, tone: "gold" },
        { label: "Active Customers", value: activeCount, note: "Active accounts", icon: FiUser, tone: "blue" },
        { label: "Inactive Customers", value: inactiveCount, note: "Inactive accounts", icon: FiUserX, tone: "rust" },
    ];

    return (
        <section className="min-h-screen bg-[#F4F7F6] px-0 py-1 text-slate-800">
            <div className="mx-auto max-w-[1600px] space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {statCards.map(({ label, value, note, icon: Icon, tone }) => {
                        const colors = superAdminStatTones[tone];
                        return (
                            <article key={label} className={`relative flex min-h-[176px] min-w-0 items-center gap-4 overflow-hidden rounded-xl border border-l-4 p-4 shadow-md transition-shadow hover:shadow-lg sm:p-5 ${colors.card}`}>
                                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-inner ${colors.icon}`}>
                                    <Icon size={25} />
                                </span>
                                <div className="min-w-0 flex-1 pb-1">
                                    <p className={`truncate text-sm font-semibold ${colors.label}`}>{label}</p>
                                    {loading
                                        ? <div className="mt-2 h-8 w-28 animate-pulse rounded bg-white/15" />
                                        : <p className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-[28px]">{value.toLocaleString()}</p>}
                                    <div className={`mt-2 flex min-h-5 items-center gap-1.5 text-xs ${colors.detail}`}>
                                        {loading
                                            ? <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
                                            : (
                                                <>
                                                    <span className={`h-2 w-2 rounded-full ${colors.bars}`} />
                                                    <span className="font-semibold">{note}</span>
                                                </>
                                            )}
                                    </div>
                                </div>
                                <div aria-hidden="true" className={`absolute bottom-3 right-3 flex h-8 items-end gap-1 opacity-90 ${colors.detail}`}>
                                    <span className="h-3 w-1.5 rounded-t-sm bg-current" />
                                    <span className="h-5 w-1.5 rounded-t-sm bg-current" />
                                    <span className="h-4 w-1.5 rounded-t-sm bg-current" />
                                    <span className="h-7 w-1.5 rounded-t-sm bg-current" />
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between xl:col-span-2">
                        <label className="relative min-w-0 flex-1">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search name, phone, email..."
                                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-[#008577] focus:ring-2 focus:ring-emerald-100"
                            />
                        </label>
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <SuperAdminDateRangeFilter onApply={(range) => {
                                setCurrentPage(1);
                                setDateRange(range);
                            }} />
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Filter users by status">
                                {[
                                    { value: "all", label: "All" },
                                    { value: "active", label: "Active" },
                                    { value: "inactive", label: "Inactive" },
                                ].map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setStatusFilter(value)}
                                        aria-pressed={statusFilter === value}
                                        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${statusFilter === value ? "bg-[#00695C] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Customer view mode">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("card")}
                                    aria-label="Card view"
                                    title="Card view"
                                    aria-pressed={viewMode === "card"}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${viewMode === "card" ? "bg-[#008577] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                                >
                                    <FiGrid size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("table")}
                                    aria-label="Table view"
                                    title="Table view"
                                    aria-pressed={viewMode === "table"}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${viewMode === "table" ? "bg-[#008577] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                                >
                                    <FiList size={15} />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={openAddModal}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00695C] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#008577]"
                            >
                                <FiPlus /> Add User
                            </button>
                        </div>
                    </div>
                    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                        {viewMode === "table" ? <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
                                <thead>
                                    <tr className="bg-gradient-to-r from-[#003B3B] to-[#008577] text-[10px] font-bold uppercase tracking-wide text-white">
                                        <th className="rounded-tl-xl px-4 py-4">S No</th>
                                        <th className="px-4 py-4">Customer</th>
                                        <th className="px-4 py-4">Contact</th>
                                        <th className="px-4 py-4">Role</th>
                                        <th className="px-4 py-4">Status</th>
                                        <th className="px-4 py-4">Join Date</th>
                                        <th className="rounded-tr-xl px-4 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-400">Loading customers...</td></tr>
                                    ) : currentItems.length === 0 ? (
                                        <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-400">No customers match your search.</td></tr>
                                    ) : currentItems.map((user, index) => (
                                        <tr
                                            key={user.id ?? `${user.email}-${index}`}
                                            onClick={() => setSelectedUserId(user.id)}
                                            className={`cursor-pointer transition hover:bg-emerald-50/40 ${String(selectedUserId) === String(user.id) ? "bg-emerald-50/50" : ""}`}
                                        >
                                            <td className="px-3 py-3 text-xs font-medium text-slate-400">{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F7EBCB] text-xs font-bold text-[#795713]">{getInitials(user.name)}</div>
                                                    <span className="max-w-[150px] truncate text-xs font-bold text-slate-800">{user.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <p className="max-w-[190px] truncate text-xs font-medium text-slate-700">{user.email || "Email not provided"}</p>
                                                <p className="mt-0.5 text-[10px] text-slate-400">{user.phone || "Phone not provided"}</p>
                                            </td>
                                            <td className="px-3 py-3 text-xs capitalize text-slate-600">{user.role}</td>
                                            <td className="px-3 py-3">
                                                <select
                                                    value={user.status}
                                                    onChange={(event) => void handleStatusChange(user, event.target.value)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    disabled={refreshing || statusUpdatingUserId !== null}
                                                    aria-label={`Change status for ${user.name}`}
                                                    title="Change user status"
                                                    className={`rounded-md border px-2 py-1 text-[10px] font-bold outline-none transition disabled:cursor-wait disabled:opacity-60 ${user.status === "Active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-3 text-xs text-slate-500">{formatJoinDate(user.created_at, { day: "2-digit", month: "short", year: "numeric" })}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex justify-end gap-1.5">
                                                    <button type="button" title="View customer" aria-label={`View ${user.name}`} onClick={(event) => { event.stopPropagation(); setSelectedUserId(user.id); }} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:border-emerald-300 hover:text-[#008577]"><FiEye size={14} /></button>
                                                    <button type="button" disabled={refreshing} title="Edit customer" aria-label={`Edit ${user.name}`} onClick={(event) => { event.stopPropagation(); openEditModal(user); }} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"><FiEdit2 size={14} /></button>
                                                    <button type="button" disabled={refreshing} title="Delete customer" aria-label={`Delete ${user.name}`} onClick={(event) => { event.stopPropagation(); handleDeleteUser(user); }} className="rounded-md border border-rose-100 p-2 text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"><FiTrash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div> : (
                            <div className="p-4">
                                {loading ? (
                                    <p className="py-12 text-center text-sm text-slate-400">Loading customers...</p>
                                ) : currentItems.length === 0 ? (
                                    <p className="py-12 text-center text-sm text-slate-400">No customers match your search.</p>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                        {currentItems.map((user) => (
                                            <article
                                                key={user.id ?? user.email}
                                                onClick={() => setSelectedUserId(user.id)}
                                                className={`cursor-pointer rounded-xl border p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30 ${String(selectedUserId) === String(user.id) ? "border-emerald-300 bg-emerald-50/50" : "border-slate-100 bg-white"}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F7EBCB] text-xs font-bold text-[#795713]">{getInitials(user.name)}</div>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
                                                            <p className="text-[10px] text-slate-400">Customer #{user.id ?? "—"}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${user.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{user.status}</span>
                                                </div>
                                                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                                                    <p className="truncate text-slate-700">{user.email || "Email not provided"}</p>
                                                    <p className="text-slate-500">{user.phone || "Phone not provided"}</p>
                                                    <p className="capitalize text-slate-500">{user.role} · Joined {formatJoinDate(user.created_at, { day: "2-digit", month: "short", year: "numeric" })}</p>
                                                </div>
                                                <div className="mt-3 flex justify-end gap-1.5 border-t border-slate-100 pt-3">
                                                    <button type="button" title="View customer" aria-label={`View ${user.name}`} onClick={(event) => { event.stopPropagation(); setSelectedUserId(user.id); }} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:border-emerald-300 hover:text-[#008577]"><FiEye size={14} /></button>
                                                    <button type="button" disabled={refreshing} title="Edit customer" aria-label={`Edit ${user.name}`} onClick={(event) => { event.stopPropagation(); openEditModal(user); }} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"><FiEdit2 size={14} /></button>
                                                    <button type="button" disabled={refreshing} title="Delete customer" aria-label={`Delete ${user.name}`} onClick={(event) => { event.stopPropagation(); handleDeleteUser(user); }} className="rounded-md border border-rose-100 p-2 text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"><FiTrash2 size={14} /></button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-500">
                                Showing {filteredUsers.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(safePage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} customers
                            </p>
                            <div className="flex items-center justify-end gap-1">
                                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage <= 1 || loading} aria-label="Previous page" className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><FiChevronLeft /></button>
                                <span className="min-w-9 rounded-md bg-[#008577] px-2.5 py-2 text-center text-xs font-bold text-white">{safePage}</span>
                                <span className="px-1 text-xs text-slate-400">of {Math.max(totalPages, 1)}</span>
                                <button type="button" onClick={() => setCurrentPage((page) => Math.min(Math.max(totalPages, 1), page + 1))} disabled={safePage >= totalPages || loading} aria-label="Next page" className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><FiChevronRight /></button>
                            </div>
                        </div>
                    </section>

                    <aside className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-sm font-extrabold text-slate-800">Customer Details</h2>
                            {selectedUser && <button type="button" onClick={() => setSelectedUserId(null)} aria-label="Clear selected customer" className="text-slate-400 hover:text-slate-700"><FiX /></button>}
                        </div>
                        {selectedUser ? (
                            <>
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F7EBCB] text-lg font-bold text-[#795713]">{getInitials(selectedUser.name)}</div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-800">{selectedUser.name}</p>
                                        <p className="text-xs text-slate-400">Customer #{selectedUser.id ?? "—"}</p>
                                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedUser.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{selectedUser.status}</span>
                                    </div>
                                </div>
                                <dl className="space-y-3 py-4 text-xs">
                                    <div className="flex items-start gap-2"><FiMail className="mt-0.5 shrink-0 text-[#008577]" /><dt className="w-20 shrink-0 text-slate-500">Email</dt><dd className="break-all font-medium text-slate-700">{selectedUser.email || "Not provided"}</dd></div>
                                    <div className="flex items-start gap-2"><FiPhone className="mt-0.5 shrink-0 text-[#008577]" /><dt className="w-20 shrink-0 text-slate-500">Phone</dt><dd className="font-medium text-slate-700">{selectedUser.phone || "Not provided"}</dd></div>
                                    <div className="flex items-start gap-2"><FiUser className="mt-0.5 shrink-0 text-[#008577]" /><dt className="w-20 shrink-0 text-slate-500">Role</dt><dd className="font-medium capitalize text-slate-700">{selectedUser.role}</dd></div>
                                    <div className="flex items-start gap-2"><FiCalendar className="mt-0.5 shrink-0 text-[#008577]" /><dt className="w-20 shrink-0 text-slate-500">Joined</dt><dd className="font-medium text-slate-700">{formatJoinDate(selectedUser.created_at, { day: "numeric", month: "long", year: "numeric" })}</dd></div>
                                </dl>
                                <button type="button" onClick={() => openEditModal(selectedUser)} className="w-full rounded-lg bg-[#00695C] px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#008577]">Edit Customer</button>
                            </>
                        ) : (
                            <div className="py-10 text-center text-xs text-slate-400">Choose a customer to view their details.</div>
                        )}
                    </aside>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                    <form onSubmit={handleSaveUser} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-800">{isEditing ? "Edit Customer" : "Add Customer"}</h2>
                                <p className="mt-1 text-xs text-slate-500">{isEditing ? "Update the customer's account details." : "Create a customer account."}</p>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><FiX /></button>
                        </div>
                        <div className="grid gap-4 p-6 sm:grid-cols-2">
                            {[
                                { name: "username", label: "Username", required: true },
                                { name: "name", label: "Full name" },
                                { name: "email", label: "Email address", required: true, type: "email" },
                                { name: "phone", label: "Phone number", type: "tel" },
                            ].map((field) => (
                                <label key={field.name} className="text-xs font-semibold text-slate-600">
                                    {field.label}{field.required ? " *" : ""}
                                    <input
                                        name={field.name}
                                        type={field.type || "text"}
                                        required={field.required}
                                        value={formData[field.name]}
                                        onChange={(event) => setFormData((current) => ({ ...current, [field.name]: event.target.value }))}
                                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#008577] focus:ring-2 focus:ring-emerald-100"
                                    />
                                </label>
                            ))}
                            <label className="text-xs font-semibold text-slate-600">
                                Role
                                <select name="role" value={formData.role} onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#008577]">
                                    <option value="user">Customer</option>
                                    <option value="manager">Manager</option>
                                    <option value="dealer">Dealer</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </label>
                            {!isEditing && (
                                <label className="text-xs font-semibold text-slate-600">
                                    Password *
                                    <input name="password" type="password" required value={formData.password} onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#008577] focus:ring-2 focus:ring-emerald-100" />
                                </label>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button type="submit" disabled={submitLoading} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg bg-[#008577] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#00695C] disabled:cursor-not-allowed disabled:opacity-60">
                                {submitLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                                {isEditing ? "Save Changes" : "Add Customer"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
};

export default Usersmanagements;
