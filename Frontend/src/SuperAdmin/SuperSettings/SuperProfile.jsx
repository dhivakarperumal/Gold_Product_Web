import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  LoaderCircle,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../PrivateRouter/AuthContext";
import api from "../../api";

const EMPTY_PROFILE = {
  user_id: "",
  username: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  profile_image: "",
  role: "superadmin",
  status: "",
  created_at: "",
  updated_at: "",
  notification_preferences: { email: true, orders: true }
};

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
const TABS = [
  { id: "personal", label: "Personal information", icon: UserRound },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "notifications", label: "Notifications", icon: Bell }
];

function formatRole(value) {
  const role = String(value || "superadmin").toLowerCase().replace(/[\s_-]/g, "");
  if (role === "superadmin") return "Super Admin";
  return role.replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function photoUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function SuperProfile() {
  const { user, login } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreference, setSavingPreference] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const photoInputRef = useRef(null);
  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some(({ id }) => id === requestedTab) ? requestedTab : "personal";

  const fetchProfile = useCallback(async (signal) => {
    const { data } = await api.get("/auth/me", signal ? { signal } : undefined);
    if (!data?.user) throw new Error("Profile response is missing user details");
    return {
      ...EMPTY_PROFILE,
      ...data.user,
      notification_preferences: {
        ...EMPTY_PROFILE.notification_preferences,
        ...(data.user.notification_preferences || {})
      }
    };
  }, []);

  const retryProfileLoad = async () => {
    setLoadError("");
    setLoading(true);
    try {
      setProfile(await fetchProfile());
    } catch (error) {
      console.error("Failed to load Super Admin profile:", error);
      setLoadError(error.response?.data?.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchProfile(controller.signal)
      .then(setProfile)
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load Super Admin profile:", error);
        setLoadError(error.response?.data?.message || "Unable to load your profile.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fetchProfile]);

  const initials = useMemo(() => (profile.name || profile.username || "SA")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(""), [profile.name, profile.username]);

  const updateField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile.username.trim() || !profile.name.trim() || !profile.email.trim()) {
      toast.error("Name, username, and email are required.");
      return;
    }

    setSavingProfile(true);
    try {
      const { data } = await api.put("/auth/me", {
        username: profile.username,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address
      });
      const updatedProfile = { ...profile, ...data.user };
      setProfile(updatedProfile);
      const token = localStorage.getItem("token");
      if (token) login({ ...user, ...data.user }, token);
      toast.success(data.message || "Profile updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save your profile.");
    } finally {
      setSavingProfile(false);
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

    setSavingPassword(true);
    try {
      const { data } = await api.put("/auth/me/password", {
        currentPassword: passwords.current,
        newPassword: passwords.next
      });
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success(data.message || "Password updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update your password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const uploadPhoto = async (event) => {
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
    setUploadingPhoto(true);
    try {
      const { data } = await api.post("/auth/me/photo", formData);
      setProfile((current) => ({ ...current, ...data.user }));
      toast.success(data.message || "Profile photo updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to upload your photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    if (!window.confirm("Remove your profile photo?")) return;
    setUploadingPhoto(true);
    try {
      const { data } = await api.delete("/auth/me/photo");
      setProfile((current) => ({ ...current, ...data.user }));
      toast.success(data.message || "Profile photo removed.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to remove your photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const togglePreference = async (key) => {
    if (savingPreference) return;
    const previous = profile.notification_preferences;
    const next = { ...previous, [key]: !previous[key] };
    setProfile((current) => ({ ...current, notification_preferences: next }));
    setSavingPreference(key);
    try {
      const { data } = await api.put("/auth/me/notifications", next);
      setProfile((current) => ({
        ...current,
        notification_preferences: data.user.notification_preferences
      }));
      toast.success("Notification preference saved.");
    } catch (error) {
      setProfile((current) => ({ ...current, notification_preferences: previous }));
      toast.error(error.response?.data?.message || "Unable to save notification preference.");
    } finally {
      setSavingPreference("");
    }
  };

  const roleLabel = formatRole(profile.role || user?.role);
  const inputClass = "mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-800/10";
  const labelClass = "block text-xs font-bold uppercase tracking-wide text-stone-500";

  if (loading) {
    return (
      <div role="status" className="flex min-h-80 items-center justify-center gap-3 text-sm font-semibold text-stone-500">
        <LoaderCircle className="h-5 w-5 animate-spin text-amber-600" /> Loading your profile...
      </div>
    );
  }

  if (loadError) {
    return (
      <section role="alert" className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <p className="font-semibold text-rose-800">{loadError}</p>
        <button type="button" onClick={retryProfileLoad} className="mt-4 rounded-xl bg-[#123b32] px-5 py-2.5 text-sm font-bold text-white">
          Try again
        </button>
      </section>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-700">Account settings</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">My Profile</h1>
          <p className="mt-1 text-sm text-stone-500">Manage your Super Admin account, security, and preferences.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm">
            <ShieldCheck size={15} /> Super Admin account
          </span>
          <Link to="/superadmin" className="inline-flex items-center gap-2 rounded-xl bg-[#123b32] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d3029]">
            <Home size={15} /> Back to home
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#123b32] via-[#174b3e] to-[#0d3029] p-5 text-white shadow-[0_20px_50px_-30px_rgba(18,59,50,0.8)] sm:p-8">
        <div aria-hidden="true" className="absolute -right-20 -top-32 -z-10 h-80 w-80 rounded-full border-[34px] border-white/[0.04]" />
        <div aria-hidden="true" className="absolute -bottom-28 right-1/3 -z-10 h-56 w-56 rounded-full bg-amber-400/[0.08] blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div className="relative h-24 w-24 shrink-0 rounded-[26px] bg-gradient-to-br from-amber-200 to-amber-500 p-1 shadow-xl shadow-black/20">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[22px] bg-[#123b32] text-2xl font-black text-amber-100">
                {profile.profile_image
                  ? <img src={photoUrl(profile.profile_image)} alt={`${profile.name || "Super Admin"} profile`} className="h-full w-full object-cover" />
                  : initials}
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[#174b3e] bg-emerald-400 text-emerald-950">
                <Check size={15} strokeWidth={3} />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-200">{roleLabel}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold capitalize text-white/75">{profile.status || "Active"}</span>
              </div>
              <h2 className="mt-2 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{profile.name || profile.username}</h2>
              <p className="mt-1 truncate text-sm text-white/70">{profile.email}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                {profile.phone && <span className="inline-flex items-center gap-1.5"><Phone size={13} />{profile.phone}</span>}
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />Joined {formatDate(profile.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={uploadPhoto} />
            <button type="button" disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/15 disabled:opacity-60">
              {uploadingPhoto ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploadingPhoto ? "Updating..." : "Change photo"}
            </button>
            {profile.profile_image && (
              <button type="button" disabled={uploadingPhoto} onClick={() => void removePhoto()} className="inline-flex items-center gap-2 rounded-xl border border-rose-200/20 bg-rose-400/10 px-4 py-2.5 text-xs font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-60">
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Profile sections" className="rounded-3xl border border-stone-200/80 bg-white p-3 shadow-sm">
          <p className="px-3 pb-3 pt-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-700">Profile settings</p>
          <div role="tablist" aria-label="Profile settings" className="flex gap-1.5 overflow-x-auto border-t border-stone-100 pt-2 lg:flex-col">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`super-profile-tab-${id}`}
                aria-selected={activeTab === id}
                aria-controls={`super-profile-panel-${id}`}
                onClick={() => setSearchParams(id === "personal" ? {} : { tab: id })}
                className={`inline-flex min-w-max items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition lg:w-full ${activeTab === id ? "bg-[#123b32] text-white shadow-md shadow-emerald-950/10" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${activeTab === id ? "bg-white/10 text-amber-300" : "bg-stone-100 text-stone-500"}`}><Icon size={17} /></span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 hidden rounded-2xl bg-amber-50/80 p-4 lg:block">
            <Sparkles size={17} className="text-amber-700" />
            <p className="mt-2 text-xs font-bold text-stone-800">Keep your account secure</p>
            <p className="mt-1 text-[11px] leading-5 text-stone-500">Use a unique password and keep your contact details up to date.</p>
          </div>
        </nav>

        <section
          role="tabpanel"
          id={`super-profile-panel-${activeTab}`}
          aria-labelledby={`super-profile-tab-${activeTab}`}
          className="min-w-0 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-7"
        >
          {activeTab === "personal" && (
            <div className="space-y-6">
              <div className="border-b border-stone-100 pb-5">
                <h2 className="text-xl font-extrabold tracking-tight text-stone-900">Personal information</h2>
                <p className="mt-1 text-sm text-stone-500">Update the details associated with your Super Admin account.</p>
              </div>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)]">
                <form onSubmit={saveProfile} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>Full name *
                      <input className={inputClass} value={profile.name} onChange={(event) => updateField("name", event.target.value)} autoComplete="name" required maxLength={150} />
                    </label>
                    <label className={labelClass}>Email address *
                      <input className={inputClass} type="email" value={profile.email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email" required maxLength={255} />
                    </label>
                    <label className={labelClass}>Mobile number
                      <input className={inputClass} type="tel" value={profile.phone || ""} onChange={(event) => updateField("phone", event.target.value)} autoComplete="tel" maxLength={20} />
                    </label>
                    <label className={labelClass}>Username
                      <input className={`${inputClass} bg-stone-50 text-stone-500`} value={profile.username} readOnly autoComplete="username" />
                    </label>
                    <label className={`${labelClass} sm:col-span-2`}>Address
                      <textarea className={`${inputClass} min-h-28 resize-y`} value={profile.address || ""} onChange={(event) => updateField("address", event.target.value)} placeholder="Add your address" maxLength={5000} />
                    </label>
                  </div>
                  <div className="flex justify-end border-t border-stone-100 pt-4">
                    <button type="submit" disabled={savingProfile} className="inline-flex items-center gap-2 rounded-xl bg-[#123b32] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d3029] disabled:cursor-wait disabled:opacity-60">
                      {savingProfile ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                      {savingProfile ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </form>

                <aside className="h-fit rounded-2xl border border-stone-200 bg-stone-50/70 p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={17} className="text-emerald-700" />
                    <h3 className="text-sm font-extrabold text-stone-800">Account overview</h3>
                  </div>
                  <dl className="mt-4 divide-y divide-stone-200/70 text-xs">
                    <div className="flex justify-between gap-3 py-3"><dt className="text-stone-500">Role</dt><dd className="font-bold text-stone-800">{roleLabel}</dd></div>
                    <div className="flex justify-between gap-3 py-3"><dt className="text-stone-500">Account status</dt><dd className="font-bold capitalize text-emerald-800">{profile.status || "Active"}</dd></div>
                    <div className="flex justify-between gap-3 py-3"><dt className="text-stone-500">Member since</dt><dd className="text-right font-semibold text-stone-800">{formatDate(profile.created_at)}</dd></div>
                    <div className="flex justify-between gap-3 py-3"><dt className="text-stone-500">Last updated</dt><dd className="text-right font-semibold text-stone-800">{formatDate(profile.updated_at)}</dd></div>
                  </dl>
                </aside>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="border-b border-stone-100 pb-5">
                <h2 className="text-xl font-extrabold tracking-tight text-stone-900">Account security</h2>
                <p className="mt-1 text-sm text-stone-500">Change your password to help protect your administrator access.</p>
              </div>
              <form onSubmit={changePassword} className="space-y-5">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-900">
                  Choose a strong password that you do not use for other accounts. Your password is never shown here.
                </div>
                <div className="space-y-4">
                  {[
                    ["current", "Current password", "current-password"],
                    ["next", "New password", "new-password"],
                    ["confirm", "Confirm new password", "new-password"]
                  ].map(([key, label, autoComplete]) => (
                    <label key={key} className={`${labelClass} relative`}>
                      {label}
                      <input
                        className={`${inputClass} pr-12`}
                        type={showPasswords ? "text" : "password"}
                        value={passwords[key]}
                        onChange={(event) => setPasswords((current) => ({ ...current, [key]: event.target.value }))}
                        autoComplete={autoComplete}
                        required
                      />
                      {key !== "confirm" && (
                        <button type="button" aria-label={showPasswords ? "Hide passwords" : "Show passwords"} onClick={() => setShowPasswords((visible) => !visible)} className="absolute bottom-3 right-4 text-stone-400 hover:text-stone-700">
                          {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      )}
                    </label>
                  ))}
                </div>
                <div className="flex justify-end border-t border-stone-100 pt-4">
                  <button type="submit" disabled={savingPassword} className="inline-flex items-center gap-2 rounded-xl bg-[#123b32] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0d3029] disabled:cursor-wait disabled:opacity-60">
                    {savingPassword ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}
                    {savingPassword ? "Updating..." : "Update password"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="border-b border-stone-100 pb-5">
                <h2 className="text-xl font-extrabold tracking-tight text-stone-900">Notification preferences</h2>
                <p className="mt-1 text-sm text-stone-500">Choose which account updates you would like to receive.</p>
              </div>
              {[
                ["email", "Email notifications", "Receive important account and platform updates by email."],
                ["orders", "Order notifications", "Receive updates about new orders and enquiries."]
              ].map(([key, label, description]) => (
                <div key={key} className="flex items-center justify-between gap-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Bell size={18} /></span>
                    <div>
                      <h3 className="text-sm font-bold text-stone-800">{label}</h3>
                      <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(profile.notification_preferences[key])}
                    aria-label={label}
                    disabled={Boolean(savingPreference)}
                    onClick={() => void togglePreference(key)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${profile.notification_preferences[key] ? "bg-emerald-700" : "bg-stone-300"}`}
                  >
                    {savingPreference === key && <LoaderCircle size={13} className="absolute left-1 top-1 animate-spin text-white" />}
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${profile.notification_preferences[key] ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}