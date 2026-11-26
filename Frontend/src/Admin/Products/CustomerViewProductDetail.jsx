import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Image as ImageIcon,
    RefreshCw,
    Star,
} from "lucide-react";
import api from "../../api";
import { resolveBackendImageUrl } from "../../Components/Home/productDisplay";
import { formatCurrency } from "../../utils/currency";

const parseArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const parseMedia = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [value.trim()];
    }
};

const mediaPath = (media) => {
    if (typeof media === "string") return media;
    return media?.url || media?.path || media?.src || "";
};

const displayValue = (value) => {
    if (value == null || value === "") return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(", ");
    if (typeof value === "object") {
        return Object.entries(value)
            .map(([key, item]) => `${key}: ${displayValue(item)}`)
            .filter(Boolean)
            .join(" · ");
    }
    return String(value);
};

const DetailSection = ({ title, fields }) => {
    const visibleFields = fields.filter(([, value]) => displayValue(value));
    if (!visibleFields.length) return null;

    return (
        <section className="overflow-hidden rounded-2xl border border-[#eadfce] bg-white shadow-sm">
            <h2 className="border-b border-[#efe5d4] bg-[#fffaf0] px-5 py-4 font-serif text-lg font-bold text-[#174a38]">
                {title}
            </h2>
            <dl className="divide-y divide-[#f3eee5] px-5">
                {visibleFields.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-3">
                        <dt className="text-xs text-[#887c69]">{label}</dt>
                        <dd className="break-words text-sm font-semibold text-[#352d22]">{displayValue(value)}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
};

const CustomerViewProductDetail = () => {
    const { id } = useParams();
    const [product, setProduct] = useState(null);
    const [loadedProductId, setLoadedProductId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retryKey, setRetryKey] = useState(0);
    const [activeImage, setActiveImage] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        let isActive = true;

        const loadProduct = async () => {
            try {
                const { data } = await api.get(`/products/mine/${id}`, {
                    signal: controller.signal,
                });
                if (!data || typeof data !== "object" || Array.isArray(data)) {
                    throw new TypeError("Product details response is invalid.");
                }
                if (isActive) {
                    setProduct(data);
                    setActiveImage(0);
                    setError("");
                }
            } catch (requestError) {
                if (!isActive || controller.signal.aborted) return;
                console.error("Could not load customer-view product details:", requestError);
                setProduct(null);
                setError(requestError.response?.data?.message || "Could not load product details.");
            } finally {
                if (isActive && !controller.signal.aborted) {
                    setLoadedProductId(id);
                    setLoading(false);
                }
            }
        };

        void loadProduct();
        return () => {
            isActive = false;
            controller.abort();
        };
    }, [id, retryKey]);

    const variants = useMemo(() => parseArray(product?.variants), [product]);
    const images = useMemo(() => {
        if (!product) return [];
        const allMedia = [
            ...parseMedia(product.images),
            ...variants.flatMap((variant) => parseMedia(variant.images)),
        ];
        return [...new Set(allMedia.map(mediaPath).filter(Boolean).map(resolveBackendImageUrl))];
    }, [product, variants]);

    if (loading || loadedProductId !== id) {
        return (
            <main className="rounded-2xl border border-[#eadfce] bg-white py-20 text-center text-sm font-semibold text-[#746b5d]" role="status">
                Loading product details...
            </main>
        );
    }

    if (!product) {
        return (
            <main className="mx-auto max-w-2xl rounded-2xl border border-[#eadfce] bg-white p-8 text-center shadow-sm">
                <h1 className="font-serif text-2xl font-bold text-[#174a38]">Product details unavailable</h1>
                <p className="mt-2 text-sm text-[#746b5d]" role="alert">{error || "This product could not be found."}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            setLoading(true);
                            setError("");
                            setRetryKey((current) => current + 1);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#e8dfd1] px-4 py-2 text-sm font-semibold text-[#174a38] hover:bg-[#fffaf0]"
                    >
                        <RefreshCw size={15} aria-hidden="true" />
                        Try again
                    </button>
                    <Link to="/admin/customer-view-products" className="rounded-lg bg-[#174a38] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10382f]">
                        Back to products
                    </Link>
                </div>
            </main>
        );
    }

    const price = Number(product.offer_price ?? product.final_selling_price ?? product.mrp ?? 0);
    const mrp = Number(product.mrp || 0);
    const discount = Number(product.discount) > 0
        ? Number(product.discount)
        : mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const stock = Number(product.total_stock ?? product.stock ?? 0);
    const stockStatus = product.stock_status || (stock > 0 ? "In Stock" : "Out of Stock");
    const selectedImage = images[activeImage];
    const highlights = parseArray(product.highlights);
    const specifications = parseArray(product.specifications);

    const productFields = [
        ["Product code", product.product_code],
        ["Category", product.category],
        ["Subcategory", product.subcategory],
        ["Product type", product.product_type],
        ["Brand", product.brand],
        ["Metal", product.metal_type],
        ["Purity", product.purity],
        ["Material", product.material],
        ["HUID", product.huid],
    ];
    const pricingFields = [
        ["MRP", mrp ? formatCurrency(mrp) : ""],
        ["Selling price", formatCurrency(price)],
        ["Discount", discount ? `${discount}%` : ""],
        ["Gold rate per gram", product.gold_rate_per_gram != null ? `${formatCurrency(product.gold_rate_per_gram)} / g` : ""],
        ["Gross weight", product.gross_weight != null ? `${product.gross_weight} g` : ""],
        ["Net gold weight", product.net_gold_weight != null ? `${product.net_gold_weight} g` : ""],
        ["Stone weight", product.stone_weight != null ? `${product.stone_weight} g` : ""],
        ["Making charge", product.making_charge != null
            ? String(product.making_charge_type).toLowerCase() === "percentage"
                ? `${product.making_charge}%`
                : formatCurrency(product.making_charge)
            : ""],
        ["Stone charges", product.stone_charges != null ? formatCurrency(product.stone_charges) : ""],
        ["Wastage", product.wastage != null
            ? String(product.wastage_type).toLowerCase() === "percentage"
                ? `${product.wastage}%`
                : `${product.wastage} g`
            : ""],
        ["GST", product.gst_rate != null ? `${product.gst_rate}%` : ""],
        ["Price includes GST", product.price_includes_gst],
        ["Stock quantity", stock],
        ["Availability", stockStatus],
    ];
    const specificationFields = [
        ["Product size", product.product_size],
        ["Available sizes", parseArray(product.available_sizes)],
        ["Length", product.length],
        ["Width", product.width],
        ["Height", product.height],
        ["Ring size", product.ring_size],
        ["Bangle size", product.bangle_size],
        ["Chain length", product.chain_length],
        ["Saree length", product.saree_length],
        ["Blouse length", product.blouse_length],
        ["Top length", product.top_length],
        ["Bottom length", product.bottom_length],
        ["Dupatta length", product.dupatta_length],
        ["Gown length", product.gown_length],
        ["Sleeve type", product.sleeve_type],
        ["Neck type", product.neck_type],
        ["Fit type", product.fit_type],
        ["Zari color", product.zari_color],
        ["Age", product.age],
        ["Specifications", specifications.length ? specifications : product.specifications],
    ];
    const careFields = [
        ["Artisan work", product.work_type],
        ["Stone type", product.stone_type],
        ["Warranty", product.warranty],
        ["Care instructions", product.care_instructions],
        ["Wash care", product.wash_care],
        ["Certificate", product.certificate ? "Available" : ""],
        ["Product status", product.status],
    ];
    const documents = [
        ["Size guide", product.size_guide_chart],
        ["Certificate", product.certificate],
    ].filter(([, path]) => path);

    return (
        <main className="space-y-6 pb-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a67b2e]">Storefront preview</p>
                    <h1 className="mt-1 font-serif text-xl font-bold text-[#201a13] sm:text-2xl">Product details</h1>
                </div>
                <Link
                    to="/admin/customer-view-products"
                    className="inline-flex items-center gap-2 rounded-full border border-[#e8dfd1] bg-white px-4 py-2 text-xs font-semibold text-[#174a38] shadow-sm transition hover:border-[#d8b46c] hover:bg-[#fffaf0]"
                >
                    <ArrowLeft size={15} aria-hidden="true" />
                    Back to Customer View Product
                </Link>
            </div>

            <section className="grid items-start gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#eadfce] bg-white p-3 shadow-sm">
                    <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#f8f4eb]">
                        {selectedImage ? (
                            <img src={selectedImage} alt={product.name || "Product"} className="h-full w-full object-contain" />
                        ) : (
                            <div className="text-center text-sm text-[#887c69]">
                                <ImageIcon size={34} className="mx-auto mb-2 text-[#bd913e]" aria-hidden="true" />
                                No product images
                            </div>
                        )}
                        {images.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Previous product image"
                                    onClick={() => setActiveImage((activeImage + images.length - 1) % images.length)}
                                    className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#174a38] shadow hover:bg-white"
                                >
                                    <ChevronLeft size={20} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Next product image"
                                    onClick={() => setActiveImage((activeImage + 1) % images.length)}
                                    className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#174a38] shadow hover:bg-white"
                                >
                                    <ChevronRight size={20} aria-hidden="true" />
                                </button>
                                <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#514638]">
                                    {activeImage + 1} / {images.length}
                                </span>
                            </>
                        )}
                    </div>
                    {images.length > 1 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {images.map((image, index) => (
                                <button
                                    key={`${image}-${index}`}
                                    type="button"
                                    onClick={() => setActiveImage(index)}
                                    aria-label={`Show product image ${index + 1}`}
                                    aria-pressed={activeImage === index}
                                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white ${activeImage === index ? "border-[#bd913e]" : "border-transparent hover:border-[#e8dfd1]"}`}
                                >
                                    <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-[#eadfce] bg-gradient-to-br from-[#fffaf0] via-white to-[#f6f1e7] p-5 shadow-sm sm:p-7">
                    <div className="flex flex-wrap items-center gap-2">
                        {product.category && (
                            <span className="rounded-full bg-[#f5ecd9] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#765323]">
                                {product.category}
                            </span>
                        )}
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${stock > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
                            {stockStatus}
                        </span>
                    </div>
                    <h2 className="mt-4 font-serif text-2xl font-bold leading-tight text-[#174a38] sm:text-3xl">
                        {product.name || "Unnamed product"}
                    </h2>
                    <p className="mt-2 text-sm text-[#81786b]">
                        {[product.brand, product.metal_type, product.purity].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#514638]">
                        {Number(product.rating) > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold">
                                <Star size={15} className="fill-[#e6a323] text-[#e6a323]" aria-hidden="true" />
                                {Number(product.rating).toFixed(1)}
                            </span>
                        ) : <span className="text-xs text-[#81786b]">No ratings yet</span>}
                        {product.total_reviews != null && <span className="text-xs text-[#81786b]">({product.total_reviews} reviews)</span>}
                        {product.product_code && <span className="text-xs text-[#81786b]">Code: {product.product_code}</span>}
                    </div>
                    <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-3xl font-extrabold text-[#b42318]">{formatCurrency(price)}</span>
                        {mrp > price && <span className="text-sm text-[#858b87] line-through">{formatCurrency(mrp)}</span>}
                        {discount > 0 && <span className="rounded-full bg-[#fff0ee] px-3 py-1 text-xs font-bold text-[#d33627]">{discount}% OFF</span>}
                    </div>
                    {(product.description || product.full_description) && (
                        <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#59645e]">
                            {product.full_description || product.description}
                        </p>
                    )}
                    {product.gross_weight != null && (
                        <p className="mt-5 border-t border-[#eadfce] pt-4 text-sm text-[#514638]">
                            <span className="font-semibold">Gross weight:</span> {product.gross_weight} g
                        </p>
                    )}
                </div>
            </section>

            {highlights.length > 0 && (
                <section className="rounded-2xl border border-[#eadfce] bg-white p-5 shadow-sm">
                    <h2 className="font-serif text-lg font-bold text-[#174a38]">Product highlights</h2>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {highlights.map((highlight, index) => (
                            <li key={`${highlight}-${index}`} className="rounded-lg bg-[#faf7f0] px-4 py-3 text-sm text-[#514638]">
                                {displayValue(highlight)}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="grid items-start gap-5 xl:grid-cols-2">
                <DetailSection title="Product information" fields={productFields} />
                <DetailSection title="Price & availability" fields={pricingFields} />
                <DetailSection title="Specifications" fields={specificationFields} />
                <DetailSection title="Materials & care" fields={careFields} />
            </div>

            {(documents.length > 0 || product.video) && (
                <section className="rounded-2xl border border-[#eadfce] bg-white p-5 shadow-sm">
                    <h2 className="font-serif text-lg font-bold text-[#174a38]">Product files</h2>
                    <div className="mt-3 flex flex-wrap gap-3">
                        {documents.map(([label, path]) => (
                            <a
                                key={label}
                                href={resolveBackendImageUrl(path)}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-[#e8dfd1] px-4 py-2 text-sm font-semibold text-[#174a38] hover:bg-[#fffaf0]"
                            >
                                View {label.toLowerCase()}
                            </a>
                        ))}
                    </div>
                    {product.video && (
                        <video
                            src={resolveBackendImageUrl(product.video)}
                            controls
                            preload="metadata"
                            className="mt-4 max-h-96 w-full rounded-xl bg-black"
                        />
                    )}
                </section>
            )}

            {variants.length > 0 && (
                <section className="rounded-2xl border border-[#eadfce] bg-white p-5 shadow-sm">
                    <h2 className="font-serif text-lg font-bold text-[#174a38]">Available variants</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {variants.map((variant, index) => (
                            <article key={`${variant.colorName || variant.color || "variant"}-${index}`} className="rounded-xl border border-[#eee7dc] bg-[#fffdf8] p-4">
                                <h3 className="font-semibold text-[#352d22]">
                                    {variant.colorName || variant.color || `Variant ${index + 1}`}
                                </h3>
                                <dl className="mt-2 space-y-1 text-xs text-[#70685d]">
                                    {variant.selectedSizes && <div><dt className="inline font-semibold">Sizes: </dt><dd className="inline">{displayValue(parseArray(variant.selectedSizes).length ? parseArray(variant.selectedSizes) : variant.selectedSizes)}</dd></div>}
                                    {variant.available_sizes && <div><dt className="inline font-semibold">Available sizes: </dt><dd className="inline">{displayValue(parseArray(variant.available_sizes).length ? parseArray(variant.available_sizes) : variant.available_sizes)}</dd></div>}
                                    {variant.total_stock != null && <div><dt className="inline font-semibold">Stock: </dt><dd className="inline">{displayValue(variant.total_stock)}</dd></div>}
                                    {variant.sizesStock && <div><dt className="inline font-semibold">Size stock: </dt><dd className="inline">{displayValue(variant.sizesStock)}</dd></div>}
                                </dl>
                            </article>
                        ))}
                    </div>
                </section>
            )}
        </main>
    );
};

export default CustomerViewProductDetail;
