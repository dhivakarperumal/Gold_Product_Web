import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { useAuth } from "./AuthContext";
import GoldRatesContext from "./goldRatesContext";

export function GoldRatesProvider({ children }) {
  const { user } = useAuth();
  const ownerUserId = user?.user_id;
  const ownerRole = user?.role;
  const loadedOwnerRef = useRef(null);
  const [current, setCurrent] = useState(null);
  const [currentOwnerId, setCurrentOwnerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const refresh = useCallback(async () => {
    setError("");
    if (!ownerUserId || !["admin", "superadmin"].includes(ownerRole)) {
      loadedOwnerRef.current = null;
      setCurrent(null);
      setCurrentOwnerId(null);
      setLastFetchedAt(null);
      setLoading(false);
      return null;
    }
    if (loadedOwnerRef.current !== ownerUserId) {
      loadedOwnerRef.current = ownerUserId;
      setCurrent(null);
      setCurrentOwnerId(null);
      setLastFetchedAt(null);
    }
    setLoading(true);
    try {
      const response = await api.get("/gold-rates/current");
      if (loadedOwnerRef.current !== ownerUserId) return null;
      setCurrent(response.data || null);
      setCurrentOwnerId(ownerUserId);
      setLastFetchedAt(new Date());
      return response.data || null;
    } catch (requestError) {
      if (loadedOwnerRef.current !== ownerUserId) return null;
      setError(requestError.response?.data?.message || "Could not refresh the active gold rate.");
      throw requestError;
    } finally {
      if (loadedOwnerRef.current === ownerUserId) setLoading(false);
    }
  }, [ownerRole, ownerUserId]);

  useEffect(() => {
    let mounted = true;
    const loadRates = async () => {
      if (!mounted) return;
      try {
        await refresh();
      } catch (requestError) {
        console.error("Gold rate refresh failed:", requestError);
      }
    };
    const handleFocus = () => { void loadRates(); };
    const interval = window.setInterval(loadRates, 60000);
    window.addEventListener("focus", handleFocus);
    void loadRates();
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh]);

  const value = useMemo(() => ({
    current: ["admin", "superadmin"].includes(ownerRole) && currentOwnerId === ownerUserId ? current : null,
    loading,
    error,
    lastFetchedAt,
    refresh,
    setCurrent
  }), [current, currentOwnerId, ownerRole, ownerUserId, loading, error, lastFetchedAt, refresh]);

  return <GoldRatesContext.Provider value={value}>{children}</GoldRatesContext.Provider>;
}
