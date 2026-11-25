import api from "../../api";

export const DEFAULT_TAX_SETTINGS = {
  gst_enabled: false,
  gst_rate: 0,
  tax_mode: "Tax Exclusive"
};

export async function getTaxSettings() {
  const { data } = await api.get("/tax-settings");
  return data;
}

export async function saveTaxSettings(settings) {
  const { data } = await api.put("/tax-settings", settings);
  return data;
}
