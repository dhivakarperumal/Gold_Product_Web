import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, RefreshCw } from "lucide-react";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";

const EMPTY_ACCOUNT = {
  name: "",
  account_type: "Cash",
  opening_balance: "0",
  account_number: ""
};

function isActive(account) {
  return account.is_active === true || Number(account.is_active) === 1;
}

function FundAccountsManagement() {
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState(EMPTY_ACCOUNT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    const { data } = await api.get("/funds/accounts");
    if (!Array.isArray(data)) throw new Error("The server returned an invalid fund account list.");
    return data;
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await fetchAccounts());
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Fund accounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts]);

  useEffect(() => {
    let active = true;
    fetchAccounts()
      .then((data) => { if (active) setAccounts(data); })
      .catch((error) => {
        if (active) toast.error(error.response?.data?.message || error.message || "Fund accounts could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchAccounts]);

  const createAccount = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/funds/accounts", {
        ...account,
        opening_balance: Number(account.opening_balance)
      });
      toast.success("Fund account created.");
      setAccount(EMPTY_ACCOUNT);
      await loadAccounts();
    } catch (error) {
      toast.error(error.response?.data?.message || "The fund account could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAccount = async (item) => {
    try {
      await api.patch(`/funds/accounts/${item.id}`, { is_active: !isActive(item) });
      toast.success(isActive(item) ? "Fund account deactivated." : "Fund account activated.");
      await loadAccounts();
    } catch (error) {
      toast.error(error.response?.data?.message || "The fund account status could not be updated.");
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-[#003B3B] via-[#00594f] to-[#087568] px-5 py-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Sri Gold Shop · Finance</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Fund Accounts</h1>
          <p className="mt-2 text-sm text-white/75">Manage accounts available to fund transactions.</p>
        </div>
        <Link to="/admin/funds" className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-[#00594f] hover:bg-emerald-50">
          <ArrowLeft size={16} /> Back to Funds
        </Link>
      </header>

      <form onSubmit={createAccount} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-bold text-slate-600">
          Account Name
          <input required maxLength={100} value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Account Type
          <select value={account.account_type} onChange={(event) => setAccount({ ...account, account_type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal">
            {["Cash", "Bank Account", "UPI", "Other"].map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Opening Balance
          <input type="number" min="0" step="0.01" value={account.opening_balance} onChange={(event) => setAccount({ ...account, opening_balance: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Account Number (optional)
          <input maxLength={100} value={account.account_number} onChange={(event) => setAccount({ ...account, account_number: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
        </label>
        <button disabled={saving} className="self-end rounded-lg bg-[#00695C] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Create Account"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-slate-800">Available Accounts</h2>
          <button type="button" onClick={loadAccounts} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Balance</th><th className="px-5 py-3">Created By</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 font-bold text-slate-800">{item.name}</td>
                  <td className="px-5 py-4 text-slate-600">{item.account_type}</td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{formatCurrency(Number(item.current_balance || 0))}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">{item.created_by || "Legacy / unassigned"}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isActive(item) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {isActive(item) ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button type="button" onClick={() => toggleAccount(item)} className="font-bold text-[#00695C] hover:underline">
                      {isActive(item) ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && accounts.length === 0 && (
                <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-500">No fund accounts yet. Create one above to get started.</td></tr>
              )}
              {loading && accounts.length === 0 && (
                <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-500">Loading fund accounts…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default FundAccountsManagement;
