import { useEffect, useState } from "react";
import { FiArrowLeft, FiInfo, FiRotateCcw, FiSave, FiShield } from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  DEFAULT_TAX_SETTINGS,
  getTaxSettings,
  saveTaxSettings
} from "./taxSettings";

const TaxSettings = () => {
  const [settings, setSettings] = useState({ ...DEFAULT_TAX_SETTINGS });
  const [customRateSelected, setCustomRateSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getTaxSettings()
      .then((savedSettings) => {
        if (active) {
          setSettings(savedSettings);
          setCustomRateSelected(![0, 3, 5, 12, 18, 28].includes(Number(savedSettings.gst_rate)));
        }
      })
      .catch((error) => {
        console.error("Failed to load tax settings:", error);
        toast.error(error.response?.data?.message || "Could not load tax settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    const rate = settings.gst_rate === "" ? NaN : Number(settings.gst_rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error("Enter a GST rate between 0 and 100.");
      return;
    }
    setSaving(true);
    try {
      const savedSettings = await saveTaxSettings({
        gst_enabled: settings.gst_enabled,
        gst_rate: rate,
        tax_mode: settings.tax_mode
      });
      setSettings(savedSettings);
      setCustomRateSelected(![0, 3, 5, 12, 18, 28].includes(Number(savedSettings.gst_rate)));
      toast.success("Tax settings saved for your admin account.");
    } catch (error) {
      console.error("Failed to save tax settings:", error);
      toast.error(error.response?.data?.message || "Could not save tax settings.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const savedSettings = await saveTaxSettings({ ...DEFAULT_TAX_SETTINGS });
      setSettings(savedSettings);
      setCustomRateSelected(false);
      toast.success("Default tax settings restored.");
    } catch (error) {
      console.error("Failed to reset tax settings:", error);
      toast.error(error.response?.data?.message || "Could not restore tax settings.");
    } finally {
      setSaving(false);
    }
  };
  const selectedRate = customRateSelected ? "custom" : String(settings.gst_rate);

  return (
    <main className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-r from-[#e8f5e9] via-[#f1f8f6] to-[#d1fae5] px-5 py-6 text-slate-900 shadow-sm sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">Tax &amp; GST Settings</h1>
            <p className="mt-1 text-sm text-slate-600">Configure the GST rules used for your billing account.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold text-emerald-800">
            <FiInfo /> Settings apply only to your admin account
          </span>
        </div>
      </header>

      <form onSubmit={save} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-100 pb-5">
          <div className="flex items-start gap-3">
            <Link to="/admin/settings" aria-label="Back to settings" className="rounded-lg border border-slate-200 p-3 text-slate-600 hover:bg-slate-50">
              <FiArrowLeft />
            </Link>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Tax rules</h2>
              <p className="mt-1 text-sm text-slate-500">Saved GST settings are used for new bills and bill updates.</p>
            </div>
          </div>
          <button type="button" onClick={reset} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <FiRotateCcw /> Reset section
          </button>
        </div>

        <div className="grid gap-5 py-6 md:grid-cols-2">
          <label className="flex min-h-20 items-center justify-between rounded-xl border border-emerald-100 px-5 py-4 text-sm font-semibold text-slate-800">
            Enable GST
            <input
              type="checkbox"
              checked={settings.gst_enabled}
              onChange={(event) => setSettings((current) => ({ ...current, gst_enabled: event.target.checked }))}
              className="h-5 w-5 accent-[#00695C]"
              disabled={loading || saving}
            />
          </label>

          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Default GST rate
            <select
              className="mt-2 block w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium normal-case text-slate-800 outline-none focus:border-[#008577] focus:ring-2 focus:ring-emerald-100"
              value={selectedRate}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setCustomRateSelected(true);
                } else {
                  setCustomRateSelected(false);
                  setSettings((current) => ({ ...current, gst_rate: event.target.value }));
                }
              }}
              disabled={loading || saving}
            >
              {[0, 3, 5, 12, 18, 28].map((rate) => (
                <option key={rate} value={rate}>{rate}%</option>
              ))}
              <option value="custom">Custom rate</option>
            </select>
            {selectedRate === "custom" && (
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settings.gst_rate}
                onChange={(event) => setSettings((current) => ({ ...current, gst_rate: event.target.value }))}
                placeholder="Enter custom rate"
                className="mt-2 block w-full rounded-xl border border-emerald-100 px-4 py-3 text-sm normal-case text-slate-800 outline-none focus:border-[#008577] focus:ring-2 focus:ring-emerald-100"
                disabled={loading || saving}
              />
            )}
          </label>

          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 md:col-span-2 md:max-w-[calc(50%-0.625rem)]">
            Tax calculation mode
            <select
              className="mt-2 block w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium normal-case text-slate-800 outline-none focus:border-[#008577] focus:ring-2 focus:ring-emerald-100"
              value={settings.tax_mode}
              onChange={(event) => setSettings((current) => ({ ...current, tax_mode: event.target.value }))}
              disabled={loading || saving}
            >
              <option>Tax Exclusive</option>
              <option>Tax Inclusive</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-emerald-100 pt-5">
          <p className="text-sm font-semibold text-slate-700">
            {settings.gst_enabled
              ? `GST ${settings.gst_rate}% is ${settings.tax_mode.toLowerCase()} on your bills.`
              : "GST is disabled for your bills."}
          </p>
          <button type="submit" disabled={loading || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#00695C] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#008577] disabled:cursor-not-allowed disabled:opacity-60">
            <FiSave /> {loading ? "Loading..." : saving ? "Saving..." : "Save tax settings"}
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <FiShield className="shrink-0 text-emerald-600" />
          Only bills created under your account use these settings.
        </div>
      </form>
    </main>
  );
};

export default TaxSettings;
