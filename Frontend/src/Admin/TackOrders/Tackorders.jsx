import { useContext, useEffect, useState } from "react";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";
import { getProductImageUrl } from "../../Components/Home/productDisplay";
import { StoreContext } from "../../PrivateRouter/StoreContext";
import { FiBox, FiMinus, FiPlus, FiTag, FiTrash2 } from "react-icons/fi";

const TackOrders = () => {
  const { cart, loadingCart, addToCart, removeFromCart, updateCartQuantity } = useContext(StoreContext);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/products/mine", {
          params: { page, limit: 10, search: search.trim() }
        });
        const data = response.data;

        if (!Array.isArray(data?.products)) {
          throw new TypeError("The products response must contain a products array");
        }

        if (active) {
          setProducts(data.products);
          setPagination(data.pagination || { total: data.products.length, totalPages: 1 });
        }
      } catch (fetchError) {
        if (active) {
          console.error("Failed to fetch products:", fetchError);
          setError(fetchError.response?.data?.message || "Could not load products. Please try again.");
          setProducts([]);
          setPagination({ total: 0, totalPages: 1 });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchProducts();
    return () => {
      active = false;
    };
  }, [page, retryCount, search]);

  const totalPages = Math.max(1, Number(pagination.totalPages) || 1);

  return (
    <section className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="mt-1 text-sm text-slate-500">{pagination.total} products</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search products..."
          aria-label="Search products"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-700 sm:max-w-xs"
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] animate-pulse bg-slate-100" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                <div className="h-10 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {products.map((product) => {
            const imageUrl = getProductImageUrl(product);
            const stock = Number(product.total_stock ?? 0);
            const price = Number(product.final_selling_price ?? product.offer_price ?? product.mrp ?? 0);
            const originalPrice = Number(product.mrp ?? 0);
            const offerPrice = Number(product.offer_price ?? price);
            const discountPercent = originalPrice > offerPrice && originalPrice > 0
              ? Math.round(((originalPrice - offerPrice) / originalPrice) * 100)
              : 0;
            const discountAmount = Number(product.applied_discount ?? 0);
            const hasOffer = discountPercent > 0 || discountAmount > 0 || Number(product.offer ?? 0) > 0;
            const offerLabel = discountPercent > 0
              ? `${discountPercent}% OFF`
              : discountAmount > 0
                ? `${formatCurrency(discountAmount)} OFF`
                : product.offer_type === "Percentage" && Number(product.offer) > 0
                  ? `${Math.round(Number(product.offer))}% OFF`
                  : "SPECIAL OFFER";
            const stockLabel = stock <= 0 ? "Out of stock" : stock < 10 ? "Low stock" : "In stock";
            const stockStyle = stock <= 0
              ? "bg-rose-100 text-rose-700"
              : stock < 10
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-700";

            return (
              <article
                key={product.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-teal-50">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name || "Product"}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-serif text-7xl text-[#b08d57]/50">
                        {(product.name || "P").charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                    {product.category || "Uncategorized"}
                  </span>
                  {hasOffer && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-extrabold tracking-wide text-white shadow-md">
                      <FiTag size={13} aria-hidden="true" />
                      {offerLabel}
                    </span>
                  )}
                  <span className={`absolute bottom-3 right-3 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${stockStyle}`}>
                    {stockLabel}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-slate-800">
                        {product.name || "Unnamed product"}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">{product.product_code || "No product code"}</p>
                    </div>
                    <p className="shrink-0 text-right text-base font-extrabold text-[#14534a]">
                      {formatCurrency(price)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <p className="text-slate-500">Metal / Purity</p>
                      <p className="mt-1 font-semibold text-slate-700">
                        {[product.metal_type, product.purity].filter(Boolean).join(" / ") || "Not specified"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500">Available stock</p>
                      <p className="mt-1 font-semibold text-slate-700">{stock}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void addToCart(product)}
                      disabled={stock <= 0}
                      aria-label="Add product"
                      title="Add product"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#14534a] text-white shadow-sm transition hover:bg-[#0f4039] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14534a] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <FiPlus size={20} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl text-[#b08d57]">
            <FiBox aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-800">No products found</h2>
          <p className="mt-1 text-sm text-slate-500">Try another search to find a product.</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            disabled={page <= 1 || loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Tack Order Cart</h2>
            <p className="mt-1 text-sm text-slate-500">
              {cart.reduce((total, item) => total + Number(item.quantity || 0), 0)} items
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            Total: {formatCurrency(cart.reduce(
              (total, item) => total + Number(item.total_price ?? Number(item.price || 0) * Number(item.quantity || 0)),
              0
            ))}
          </p>
        </div>

        {loadingCart ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading cart...</p>
        ) : cart.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Your Tack Order Cart is empty. Add products using the plus button.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Variant</th>
                  <th className="px-3 py-3 text-right">Price</th>
                  <th className="px-3 py-3 text-center">Quantity</th>
                  <th className="px-3 py-3 text-right">Subtotal</th>
                  <th className="px-3 py-3"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-11 w-11 rounded-lg object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <FiBox aria-hidden="true" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-800">{item.name || "Product"}</p>
                          <p className="text-xs text-slate-500">ID: {item.product_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {[item.colorName, item.size].filter(Boolean).join(" / ") || "Standard"}
                    </td>
                    <td className="px-3 py-3 text-right">{formatCurrency(item.price)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          aria-label={`Decrease ${item.name} quantity`}
                          onClick={() => void updateCartQuantity(item.id, Math.max(1, Number(item.quantity) - 1))}
                          disabled={Number(item.quantity) <= 1}
                          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600 disabled:opacity-40"
                        >
                          <FiMinus size={14} aria-hidden="true" />
                        </button>
                        <span className="min-w-5 text-center font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${item.name} quantity`}
                          onClick={() => void updateCartQuantity(item.id, Number(item.quantity) + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600"
                        >
                          <FiPlus size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency(item.total_price ?? Number(item.price || 0) * Number(item.quantity || 0))}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${item.name} from cart`}
                        onClick={() => void removeFromCart(item.id)}
                        className="rounded p-2 text-rose-600 transition hover:bg-rose-50"
                      >
                        <FiTrash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
};

export default TackOrders;