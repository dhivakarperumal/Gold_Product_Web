import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiDownload, FiEdit2, FiFileText, FiMapPin, FiPhone, FiShield, FiUser } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api, { getPrivateFile } from "../../api";
import { formatCurrency } from "../../utils/currency";

const DOCUMENT_TYPE_LABELS = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  voter_id: "Voter ID Card",
  driving_license: "Driving Licence",
  passport: "Passport",
  ration_card: "Ration Card",
  other: "Other Government-Issued ID"
};

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : date.toLocaleString("en-IN", includeTime ? undefined : { dateStyle: "medium" });
}

function Detail({ label, value }) {
  return (
    <div className="group min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-emerald-200 hover:shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 break-words whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-800">{value || "—"}</p>
    </div>
  );
}

export default function LoanCustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loans, setLoans] = useState([]);
  const [photoPreview, setPhotoPreview] = useState({ reference: "", url: "" });
  const [unavailablePhotoRef, setUnavailablePhotoRef] = useState("");
  const [loading, setLoading] = useState(true);
  const [openingDocument, setOpeningDocument] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(`/loan-customers/${id}`),
      api.get(`/loan-customers/${id}/documents`),
      api.get(`/customers/${id}/loans`)
    ])
      .then(([customerResponse, documentsResponse, loansResponse]) => {
        if (!Array.isArray(documentsResponse.data) || !Array.isArray(loansResponse.data)) {
          throw new Error("The server returned invalid customer documents or loan history.");
        }
        if (!active) return;
        setCustomer(customerResponse.data);
        setDocuments(documentsResponse.data);
        setLoans(loansResponse.data);
      })
      .catch((error) => {
        console.error("Failed to load customer details page:", error);
        if (active) toast.error(error.response?.data?.message || error.message || "Could not load customer details.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const photoReference = customer?.photo_url;
    if (!photoReference) return undefined;
    let active = true;
    let objectUrl = "";
    getPrivateFile(photoReference, { responseType: "blob" })
      .then(({ data }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(data);
        setPhotoPreview({ reference: photoReference, url: objectUrl });
        setUnavailablePhotoRef("");
      })
      .catch((error) => {
        console.error("Failed to load customer profile photo:", error);
        if (active) setUnavailablePhotoRef(photoReference);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [customer?.photo_url]);

  const openDocument = async (document) => {
    setOpeningDocument(String(document.id));
    try {
      const { data } = await getPrivateFile(document.file_ref, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(data);
      const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        URL.revokeObjectURL(objectUrl);
        toast.error("Allow pop-ups to open this document.");
        return;
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      console.error("Failed to open customer KYC document:", error);
      toast.error(error.response?.data?.message || "Could not open this document.");
    } finally {
      setOpeningDocument("");
    }
  };

  if (loading) {
    return <main className="p-6 text-sm text-slate-500">Loading customer details...</main>;
  }

  if (!customer) {
    return (
      <main className="space-y-4 p-4 sm:p-6">
        <Link to="/admin/loans/customermanagement" className="inline-flex items-center gap-2 text-sm font-semibold text-[#008577]"><FiArrowLeft /> Customer Management</Link>
        <p className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow-sm">Customer not found or could not be loaded.</p>
      </main>
    );
  }

  const address = [customer.address, customer.city, customer.district, customer.state, customer.pincode].filter(Boolean).join(", ");
  const activeLoans = loans.filter((loan) => loan.loan_status === "Active");
  const photoUrl = photoPreview.reference === customer.photo_url ? photoPreview.url : "";

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 p-3 text-slate-800 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/loans/customermanagement" className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-[#008577] transition hover:bg-emerald-50 hover:text-[#003B3B]">
          <FiArrowLeft /> Customer Management
        </Link>
        <button
          type="button"
          onClick={() => navigate("/admin/loans/customermanagement", { state: { editCustomerId: customer.id } })}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#064A41] to-[#087568] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <FiEdit2 /> Edit Customer
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-white to-emerald-50/80 p-5 shadow-[0_8px_28px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center self-start rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-50 text-4xl font-black text-[#008577] ring-4 ring-white shadow-md sm:self-auto">
            {photoUrl ? (
              <img src={photoUrl} alt={`${customer.full_name} profile`} className="h-full w-full rounded-3xl object-cover" />
            ) : (
              customer.full_name?.trim().charAt(0).toUpperCase() || <FiUser />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#008577]">
              <FiUser size={12} /> Customer Profile
            </p>
            <h1 className="mt-2 break-words text-2xl font-black tracking-tight text-[#003B3B] sm:text-3xl">{customer.full_name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>Customer Code: <strong className="font-bold text-slate-700">{customer.customer_code || "—"}</strong></span>
              <span>Customer ID: <strong className="font-bold text-slate-700">{customer.id}</strong></span>
              <span className="inline-flex items-center gap-1"><FiPhone size={13} /> {customer.mobile || "Mobile unavailable"}</span>
            </div>
            {unavailablePhotoRef === customer.photo_url && <p className="mt-2 text-xs font-medium text-amber-700">Profile photo unavailable. Showing customer initials instead.</p>}
          </div>
          <span className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-extrabold ${customer.kyc_status === "Verified" ? "bg-emerald-100 text-emerald-800" : customer.kyc_status === "Rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
            <FiShield size={14} /> KYC {customer.kyc_status}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-[#003B3B]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-[#008577]"><FiUser /></span>
          Personal & Contact Details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Detail label="Full Name" value={customer.full_name} />
          <Detail label="Customer Type" value={customer.customer_type} />
          <Detail label="Primary Mobile" value={customer.mobile} />
          <Detail label="Alternate Mobile" value={customer.alternate_mobile} />
          <Detail label="Email" value={customer.email} />
          <Detail label="Date of Birth" value={formatDate(customer.date_of_birth)} />
          <Detail label="Gender" value={customer.gender} />
          <Detail label="Occupation" value={customer.occupation} />
          <Detail label="KYC Status" value={customer.kyc_status} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Detail label="Residential Address" value={address || "Address not provided"} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Detail label="Internal Notes" value={customer.notes} />
          </div>
          <Detail label="Customer Since" value={formatDate(customer.created_at, true)} />
          <Detail label="Last Updated" value={formatDate(customer.updated_at, true)} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-[#003B3B]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><FiShield /></span>
          Guarantor / Surety Details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Detail label="Guarantor Name" value={customer.guarantor_name} />
          <Detail label="Guarantor Mobile" value={customer.guarantor_mobile} />
          <Detail label="Relationship to Customer" value={customer.guarantor_relationship} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Detail label="Guarantor Address" value={customer.guarantor_address} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-[#003B3B]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><FiFileText /></span>
          KYC Documents <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{documents.length}</span>
        </h2>
        {documents.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No KYC documents uploaded.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {documents.map((document) => (
              <article key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {DOCUMENT_TYPE_LABELS[document.document_type] || document.document_type} · {document.document_side || "front"}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">{document.original_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openDocument(document)}
                  disabled={openingDocument === String(document.id)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-[#008577] transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  <FiDownload /> {openingDocument === String(document.id) ? "Opening..." : "Open"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm sm:p-6">
        <h2 className="mb-2 flex items-center gap-3 text-base font-extrabold text-[#003B3B]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FiMapPin /></span>
          Loan History
        </h2>
        <p className="mb-4 ml-12 text-xs font-medium text-slate-500">{activeLoans.length} active loan{activeLoans.length === 1 ? "" : "s"} · {loans.length} total</p>
        {loans.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No loans found for this customer.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full min-w-[650px] border-separate border-spacing-0 text-left">
              <thead><tr className="bg-gradient-to-r from-[#064A41] to-[#087568] text-[11px] font-bold uppercase tracking-wide text-white">
                {["Loan Number", "Pledge Number", "Principal", "Maturity", "Status"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map((loan) => (
                  <tr key={loan.id} className="text-sm transition-colors odd:bg-white even:bg-emerald-50/35 hover:bg-emerald-50/80">
                    <td className="px-4 py-3 font-semibold text-[#008577]">{loan.loan_number}</td>
                    <td className="px-4 py-3">{loan.gold_pledge_number}</td>
                    <td className="px-4 py-3">{formatCurrency(loan.principal_amount)}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1"><FiCalendar /> {formatDate(loan.maturity_date)}</span></td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><FiCheckCircle size={13} />{loan.loan_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
