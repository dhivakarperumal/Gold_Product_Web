import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Bell, CalendarDays, Camera, Check, ChevronRight, Eye, EyeOff, LogOut,
  Info, LockKeyhole, Mail, MapPin, Phone, Save, ShieldCheck, Trash2, Upload, UserRound
} from "lucide-react";
import { toast } from "react-hot-toast";
import { AuthContext } from "../../PrivateRouter/AuthContext";
import api from "../../api";
import { useNavigate } from "react-router-dom";

const EMPTY_PROFILE = {
  user_id: "",
  username: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  role: "",
  status: "",
  created_at: "",
  updated_at: "",
  notification_preferences: { email: true, orders: true }
};
const backendUrl = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

const dateLabel = (value, options = { day: "2-digit", month: "short", year: "numeric" }) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-IN", options);
};

const dateTimeLabel = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const Profile = () => {
  const { user, login, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeSection, setActiveSection] = useState("personal-information");
  const [showDeactivationDialog, setShowDeactivationDialog] = useState(false);
  const [deactivationPassword, setDeactivationPassword] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const imageInputRef = useRef(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await api.get("/auth/me");
      setProfile({
        ...EMPTY_PROFILE,
        ...response.data.user,
        notification_preferences: {
          ...EMPTY_PROFILE.notification_preferences,
          ...(response.data.user?.notification_preferences || {})
        }
      });
    } catch (error) {
      setLoadError(error.response?.data?.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const initials = useMemo(() => (profile.name || profile.username || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(""), [profile.name, profile.username]);

  const updateField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const deactivateAccount = async (event) => {
    event.preventDefault();
    setDeactivating(true);
    try {
      await api.post("/auth/me/deactivate", { currentPassword: deactivationPassword });
      toast.success("Account deactivated. Contact an administrator if you need it reactivated.");
      logout();
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to deactivate your account.");
    } finally {
      setDeactivating(false);
    }
  };

  const closeDeactivationDialog = () => {
    setShowDeactivationDialog(false);
    setDeactivationPassword("");
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile.username.trim() || !profile.name.trim() || !profile.email.trim()) {
      toast.error("Name, username, and email are required.");
      return;
    }
    setSaving(true);
    try {
      const response = await api.put("/auth/me", {
        username: profile.username,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address
      });
      const updatedProfile = {
        ...profile,
        ...response.data.user,
        notification_preferences: profile.notification_preferences
      };
      setProfile(updatedProfile);
      const token = localStorage.getItem("token");
      if (token) login({ ...user, ...response.data.user }, token);
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!passwords.current) {
      toast.error("Enter your current password.");
      return;
    }
    if (passwords.next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("The new passwords do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      await api.put("/auth/me/password", {
        currentPassword: passwords.current,
        newPassword: passwords.next
      });
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("Password updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update your password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const uploadProfileImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile images must be 2 MB or smaller.");
      return;
    }
    const formData = new FormData();
    formData.append("image", file);
    setUploadingImage(true);
    try {
      const response = await api.post("/auth/me/photo", formData);
      setProfile((current) => ({ ...current, ...response.data.user }));
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to upload profile photo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeProfileImage = async () => {
    setUploadingImage(true);
    try {
      const response = await api.delete("/auth/me/photo");
      setProfile((current) => ({ ...current, ...response.data.user }));
      toast.success("Profile photo removed.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to remove profile photo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const changePreference = async (key) => {
    const previous = profile.notification_preferences;
    const next = { ...previous, [key]: !previous[key] };
    setProfile((current) => ({ ...current, notification_preferences: next }));
    setSavingPreferences(key);
    try {
      const response = await api.put("/auth/me/notifications", next);
      setProfile((current) => ({
        ...current,
        notification_preferences: response.data.user.notification_preferences
      }));
      toast.success("Notification preference saved.");
    } catch (error) {
      setProfile((current) => ({ ...current, notification_preferences: previous }));
      toast.error(error.response?.data?.message || "Unable to save notification preference.");
    } finally {
      setSavingPreferences("");
    }
  };

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#008577] focus:ring-4 focus:ring-emerald-800/10";
  const labelClass = "block text-xs font-bold tracking-wide text-slate-700";

  if (loading) {
    return <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-[24px] border border-slate-200/80 bg-white text-sm font-semibold text-slate-500 shadow-sm" role="status">
      <span className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-[#008577]" />
      Loading your profile…
    </div>;
  }

  if (loadError) {
    return <section className="rounded-[24px] border border-rose-200 bg-white p-6 shadow-sm" role="alert">
      <p className="font-bold text-rose-800">{loadError}</p>
      <button type="button" onClick={() => void loadProfile()} className="mt-4 rounded-xl bg-[#00695C] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#00574d]">Retry</button>
    </section>;
  }

  const memberSince = dateLabel(profile.created_at, { day: "2-digit", month: "short", year: "numeric" });
  const roleLabel = (profile.role || "admin").replace(/^\w/, (letter) => letter.toUpperCase());

  return <main className="space-y-5 pb-8">
    <header className="relative isolate overflow-hidden rounded-[26px] bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577] px-5 py-6 text-white shadow-[0_20px_45px_rgba(4,78,69,0.18)] sm:px-8 sm:py-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-32 h-80 w-80 rounded-full border border-white/10">
        <div className="absolute inset-8 rounded-full border border-white/10" />
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">Account center <span className="mx-1.5 text-emerald-200/70">·</span> Personal workspace</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Profile & Security</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">Manage your account details, security, and notification preferences.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white shadow-inner">
          <span className={`h-2 w-2 rounded-full ${profile.status && profile.status.toLowerCase() !== "active" ? "bg-amber-300" : "bg-emerald-300"}`} />
          {profile.status || "Active"} account
        </div>
      </div>
    </header>

    <section className="relative grid gap-5 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative flex h-[82px] w-[82px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#064e45] to-[#008577] text-3xl font-black text-white ring-4 ring-emerald-50 shadow-md">
          {profile.profile_image
            ? <img src={`${backendUrl}${profile.profile_image}`} alt="" className="h-full w-full rounded-full object-cover" />
            : initials}
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-slate-600 shadow-sm"><Camera size={14} /></span>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black tracking-tight text-slate-900">{profile.name || profile.username}</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">{roleLabel} workspace account</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-800"><ShieldCheck size={12} /> {roleLabel}</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-3 rounded-xl bg-sky-50/70 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Mail size={16} /></span>
          <span className="min-w-0"><span className="block truncate text-xs font-extrabold text-slate-800">{profile.email || "Email not set"}</span><span className="mt-0.5 block text-[10px] font-medium text-slate-500">Email address</span></span>
        </div>
        <div className="flex min-w-0 items-center gap-3 rounded-xl bg-emerald-50/70 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Phone size={16} /></span>
          <span className="min-w-0"><span className="block truncate text-xs font-extrabold text-slate-800">{profile.phone || "Phone not set"}</span><span className="mt-0.5 block text-[10px] font-medium text-slate-500">Mobile number</span></span>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-amber-50/70 px-3 py-2.5 sm:col-span-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><CalendarDays size={16} /></span>
          <span><span className="block text-xs font-extrabold text-slate-800">{memberSince}</span><span className="mt-0.5 block text-[10px] font-medium text-slate-500">Member since</span></span>
        </div>
      </div>
      <button type="button" onClick={() => setActiveSection("personal-information")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-2.5 text-xs font-extrabold text-emerald-900 transition hover:border-emerald-700 hover:bg-emerald-100">
        <UserRound size={15} /> Edit Profile <ChevronRight size={14} />
      </button>
    </section>

    <nav role="tablist" aria-label="Profile sections" className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_5px_18px_rgba(15,23,42,0.04)]">
      {[
        ["personal-information", UserRound, "Personal Information"],
        ["change-password", LockKeyhole, "Change Password"],
        ["notification-preferences", Bell, "Notifications"],
        ["activity-log", Activity, "Activity Log"],
        ["account-actions", LogOut, "Account Actions"]
      ].map(([id, Icon, label]) => <button key={id} id={`profile-tab-${id}`} type="button" role="tab" aria-selected={activeSection === id} aria-controls={`profile-panel-${id}`} onClick={() => setActiveSection(id)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition sm:px-4 ${activeSection === id ? "bg-gradient-to-r from-[#064e45] to-[#008577] text-white shadow-md shadow-emerald-900/15" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"}`}>
        <Icon size={15} aria-hidden="true" />{label}
      </button>)}
    </nav>

    <div className={`grid items-start gap-4 ${activeSection === "personal-information" ? "xl:grid-cols-[1.2fr_0.8fr]" : "grid-cols-1"}`}>
      {activeSection === "personal-information" && <form id="profile-panel-personal-information" role="tabpanel" aria-labelledby="profile-tab-personal-information" onSubmit={saveProfile} className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><UserRound size={18} /></span>
          <div><h2 className="text-base font-black text-slate-900">Personal Information</h2>
            <p className="mt-0.5 text-xs text-slate-500">Update your personal details and contact information.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Full Name *<input className={inputClass} value={profile.name} onChange={(event) => updateField("name", event.target.value)} autoComplete="name" required /></label>
          <label className={labelClass}>Email Address *<input className={inputClass} type="email" value={profile.email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email" required /></label>
          <label className={labelClass}>Mobile Number<input className={inputClass} type="tel" value={profile.phone || ""} onChange={(event) => updateField("phone", event.target.value)} autoComplete="tel" /></label>
          <label className={labelClass}>Role<input className={`${inputClass} bg-slate-50 text-slate-500`} value={roleLabel} readOnly /></label>
          <label className={labelClass}>Username<input className={`${inputClass} bg-slate-50 text-slate-500`} value={profile.username} readOnly autoComplete="username" /></label>
          <div className="sm:col-span-2">
            <p className={labelClass}>Profile Image</p>
            <div className="mt-1.5 flex min-h-[76px] flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#064e45] to-[#008577] text-lg font-black text-white ring-2 ring-white shadow-sm">
                {profile.profile_image ? <img src={`${backendUrl}${profile.profile_image}`} alt="Profile" className="h-full w-full object-cover" /> : initials}
              </span>
              <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={uploadProfileImage} />
              <button type="button" disabled={uploadingImage} onClick={() => imageInputRef.current?.click()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#00695C] px-3.5 py-2 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-[#00574d] disabled:opacity-60"><Upload size={14} />{uploadingImage ? "Uploading…" : "Change Image"}</button>
              {profile.profile_image && <button type="button" disabled={uploadingImage} onClick={() => void removeProfileImage()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-[11px] font-extrabold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"><Trash2 size={14} />Remove</button>}
              <span className="text-[10px] font-medium text-slate-500">JPG, PNG or WEBP · max 2 MB</span>
            </div>
          </div>
          <label className={`${labelClass} sm:col-span-2`}>Address<textarea className={`${inputClass} min-h-[84px] resize-y`} value={profile.address || ""} onChange={(event) => updateField("address", event.target.value)} placeholder="Enter your address" /></label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-medium text-slate-500">Your profile details are only visible to authorized staff.</p>
          <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#064e45] to-[#008577] px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-900/15 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"><Save size={15} />{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>}

      <div className="space-y-4">
        {(activeSection === "personal-information" || activeSection === "change-password") && <form id="profile-panel-change-password" role="tabpanel" aria-labelledby="profile-tab-change-password" onSubmit={changePassword} className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
          <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><LockKeyhole size={17} /></span>
            <span><h2 className="text-sm font-black text-slate-900">Change Password</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">Use a strong password to keep your account secure.</p></span>
          </div>
          <div className="space-y-3">
            {[["current", "Current Password"], ["next", "New Password"], ["confirm", "Confirm New Password"]].map(([key, label]) => <label key={key} className="relative block">
              <span className="sr-only">{label}</span>
              <input className={`${inputClass} mt-0 pr-11 text-sm`} type={visiblePasswords[key] ? "text" : "password"} placeholder={label} value={passwords[key]} onChange={(event) => setPasswords((current) => ({ ...current, [key]: event.target.value }))} autoComplete={key === "current" ? "current-password" : "new-password"} />
                <button type="button" aria-label={visiblePasswords[key] ? `Hide ${label}` : `Show ${label}`} onClick={() => setVisiblePasswords((current) => ({ ...current, [key]: !current[key] }))} className="absolute right-3 top-[calc(50%+0.1875rem)] -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">{visiblePasswords[key] ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </label>)}
          </div>
          <div className="mt-4 flex justify-end"><button type="submit" disabled={changingPassword} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#064e45] to-[#008577] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"><LockKeyhole size={14} />{changingPassword ? "Updating…" : "Update Password"}</button></div>
        </form>}

        {(activeSection === "personal-information" || activeSection === "notification-preferences") && <section id="profile-panel-notification-preferences" role="tabpanel" aria-labelledby="profile-tab-notification-preferences" className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
          <div className="mb-3.5 flex items-start gap-3 border-b border-slate-100 pb-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Bell size={17} /></span>
            <span><h2 className="text-sm font-black text-slate-900">Notification Preferences</h2><p className="mt-1 text-[11px] text-slate-500">Choose which updates you receive.</p></span>
          </div>
          <div className="divide-y divide-slate-100">
          {[["email", "Email Notifications", "Receive important updates via email"], ["orders", "Order Notifications", "Get notified about new orders and enquiries"]].map(([key, label, description]) => <div key={key} className="flex items-center justify-between gap-3 py-3">
            <span><span className="block text-xs font-extrabold text-slate-800">{label}</span><span className="mt-0.5 block text-[10px] text-slate-500">{description}</span></span>
            <button type="button" role="switch" aria-checked={Boolean(profile.notification_preferences[key])} aria-label={label} disabled={Boolean(savingPreferences)} onClick={() => void changePreference(key)} className={`relative h-5 w-10 shrink-0 rounded-full transition disabled:opacity-60 ${profile.notification_preferences[key] ? "bg-[#008577]" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${profile.notification_preferences[key] ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>)}
          </div>
        </section>}

        {activeSection === "personal-information" && <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
          <div className="mb-3.5 flex items-center gap-3 border-b border-slate-100 pb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Info size={17} /></span>
            <span><h2 className="text-sm font-black text-slate-900">Account Information</h2><p className="mt-1 text-[11px] text-slate-500">Your account and access details.</p></span>
          </div>
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 text-xs">
            <div className="flex justify-between gap-3 py-2.5"><dt className="text-slate-500">User ID</dt><dd className="break-all text-right font-bold text-slate-700">{profile.user_id}</dd></div>
            <div className="flex justify-between gap-3 py-2.5"><dt className="text-slate-500">Role</dt><dd className="font-bold text-slate-700">{roleLabel}</dd></div>
            <div className="flex justify-between gap-3 py-2.5"><dt className="text-slate-500">Status</dt><dd><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-emerald-800">{profile.status || "Active"}</span></dd></div>
            <div className="flex justify-between gap-3 py-2.5"><dt className="text-slate-500">Last login</dt><dd className="font-bold text-slate-700">Not tracked</dd></div>
            <div className="flex justify-between gap-3 py-2.5"><dt className="text-slate-500">Member since</dt><dd className="font-bold text-slate-700">{memberSince}</dd></div>
          </dl>
        </section>}
      </div>
    </div>

    {activeSection === "activity-log" && <section id="profile-panel-activity-log" role="tabpanel" aria-labelledby="profile-tab-activity-log" className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Activity size={18} /></span>
        <div><h2 className="text-base font-black text-slate-900">Activity Log</h2><p className="mt-1 text-xs text-slate-500">Recent account activity available for this profile.</p></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Check size={16} /></span>
          <span><span className="block text-sm font-extrabold text-slate-800">Account created</span><span className="mt-1 block text-xs text-slate-500">{dateTimeLabel(profile.created_at)}</span></span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/80 to-white px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><MapPin size={16} /></span>
          <span><span className="block text-sm font-extrabold text-slate-800">Profile last updated</span><span className="mt-1 block text-xs text-slate-500">{dateTimeLabel(profile.updated_at)}</span></span>
        </div>
      </div>
    </section>}

    {activeSection === "account-actions" && <section id="profile-panel-account-actions" role="tabpanel" aria-labelledby="profile-tab-account-actions" className="grid gap-4 md:grid-cols-2">
      <article className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><LogOut size={18} /></span>
          <div>
            <h2 className="text-base font-black text-slate-900">Log out</h2>
            <p className="mt-1.5 text-sm leading-5 text-slate-500">End your current session on this device.</p>
          </div>
        </div>
        <button type="button" onClick={handleLogout} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
          <LogOut size={15} /> Logout
        </button>
      </article>
      <article className="rounded-[22px] border border-rose-200 bg-gradient-to-br from-rose-50/60 to-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><Trash2 size={18} /></span>
          <div>
            <h2 className="text-base font-black text-slate-900">Deactivate account</h2>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">You will be signed out and unable to sign in. Your account and business data will be retained; an administrator can reactivate your account.</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowDeactivationDialog(true)} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-rose-800">
          <Trash2 size={15} /> Deactivate Account
        </button>
      </article>
    </section>}

    {showDeactivationDialog && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <form onSubmit={deactivateAccount} role="alertdialog" aria-modal="true" aria-labelledby="deactivate-account-title" className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/50 bg-white shadow-[0_30px_90px_rgba(2,20,19,0.35)]">
        <div className="bg-gradient-to-r from-rose-800 to-rose-600 px-6 py-5 text-white">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10"><Trash2 size={18} /></span>
          <h2 id="deactivate-account-title" className="text-lg font-black">Deactivate your account?</h2>
          <p className="mt-2 text-sm leading-relaxed text-rose-50">You will be signed out immediately. Your account and business data will be retained, and an administrator can reactivate your account later.</p>
        </div>
        <div className="space-y-4 p-6">
        <label className={labelClass}>Current Password
          <input className={inputClass} type="password" value={deactivationPassword} onChange={(event) => setDeactivationPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" disabled={deactivating} onClick={closeDeactivationDialog} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={deactivating} className="min-h-11 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60">{deactivating ? "Deactivating…" : "Confirm Deactivation"}</button>
        </div>
        </div>
      </form>
    </div>}
  </main>;
};

export default Profile;
