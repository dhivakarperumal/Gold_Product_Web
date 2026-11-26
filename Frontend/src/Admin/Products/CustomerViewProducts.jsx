import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw, Search, SlidersHorizontal, Star } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../api";
import { getProductImageUrl } from "../../Components/Home/productDisplay";
import { formatCurrency } from "../../utils/currency";

const PRODUCTS_PAGE_SIZE = 100;
const PRODUCTS_PER_PAGE = 18;
const OFFER_THRESHOLDS = [10, 20, 30, 40];
const RATING_THRESHOLDS = [4, 3, 2, 1];
const PRICE_STEP = 1_000;
const PRICE_RANGES = [
    { label: "₹ 0 - 25K", minimum: 0, maximum: 25_000 },
    { label: "₹ 25K - 50K", minimum: 25_000, maximum: 50_000 },
    { label: "₹ 50K - 1L", minimum: 50_000, maximum: 100_000 },
    { label: "₹ 1L - 5L", minimum: 100_000, maximum: 500_000 },
    { label: "₹ 5L+", minimum: 500_000, maximum: null },
];
const PRICE_SLIDER_CLASS = "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#c98b1b] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_#c98b1b] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#c98b1b] [&::-moz-range-thumb]:shadow-[0_0_0_1px_#c98b1b] [&::-moz-range-thumb]:cursor-pointer";

const getProductPrice = (product) =>
    Number(product.offer_price ?? product.final_selling_price ?? product.mrp ?? 0);

const getDiscount = (product) => {
    const mrp = Number(product.mrp || 0);
    if (Number(product.discount) > 0) return Number(product.discount);
    return mrp > 0
        ? Math.max(0, Math.round(((mrp - getProductPrice(product)) / mrp) * 100))
        : 0;
};

const productIsInStock = (product) =>
    Number(product.total_stock ?? product.stock ?? 0) > 0;

const CustomerViewProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retryKey, setRetryKey] = useState(0);
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedMetals, setSelectedMetals] = useState([]);
    const [offerThreshold, setOfferThreshold] = useState(0);
    const [minimumRating, setMinimumRating] = useState(0);
    const [availability, setAvailability] = useState("");
    const [minimumPrice, setMinimumPrice] = useState("");
    const [maximumPrice, setMaximumPrice] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [filtersVisible, setFiltersVisible] = useState(false);
    const [openFilters, setOpenFilters] = useState({
        category: true,
        metal: true,
        offer: true,
        price: true,
        rating: true,
        availability: true,
    });

    useEffect(() => {
        const controller = new AbortController();
        let isActive = true;

        const loadProducts = async () => {
            try {
                const firstResponse = await api.get("/products/mine", {
                    params: { page: 1, limit: PRODUCTS_PAGE_SIZE, status: "All" },
                    signal: controller.signal,
                });
                if (!Array.isArray(firstResponse.data?.products)) {
                    throw new TypeError("The products response must contain a products array.");
                }

                const totalPages = Math.max(1, Number(firstResponse.data.pagination?.totalPages) || 1);
                const otherResponses = await Promise.all(
                    Array.from({ length: totalPages - 1 }, (_, index) =>
                        api.get("/products/mine", {
                            params: { page: index + 2, limit: PRODUCTS_PAGE_SIZE, status: "All" },
                            signal: controller.signal,
                        })
                    )
                );
                const allProducts = [firstResponse, ...otherResponses].flatMap((response) => {
                    if (!Array.isArray(response.data?.products)) {
                        throw new TypeError("A products page did not contain a products array.");
                    }
                    return response.data.products;
                });

                if (isActive) setProducts(allProducts);
            } catch (requestError) {
                if (!isActive || controller.signal.aborted) return;
                console.error("Could not load customer-view products:", requestError);
                setError(requestError.response?.data?.message || "Could not load your products.");
            } finally {
                if (isActive && !controller.signal.aborted) setLoading(false);
            }
        };

        void loadProducts();
        return () => {
            isActive = false;
            controller.abort();
        };
    }, [retryKey]);

    const categoryCounts = useMemo(() => products.reduce((counts, product) => {
        if (product.category) counts[product.category] = (counts[product.category] || 0) + 1;
        return counts;
    }, {}), [products]);

    const metalCounts = useMemo(() => products.reduce((counts, product) => {
        if (product.metal_type) counts[product.metal_type] = (counts[product.metal_type] || 0) + 1;
        return counts;
    }, {}), [products]);

    const ratingCounts = useMemo(() => products.reduce((counts, product) => {
        const rating = Number(product.rating) || 0;
        RATING_THRESHOLDS.forEach((threshold) => {
            if (rating >= threshold) counts[threshold] += 1;
        });
        return counts;
    }, Object.fromEntries(RATING_THRESHOLDS.map((rating) => [rating, 0]))), [products]);
    const inStockCount = useMemo(
        () => products.filter(productIsInStock).length,
        [products]
    );

    const categories = Object.keys(categoryCounts).sort((first, second) => first.localeCompare(second));
    const metals = Object.keys(metalCounts).sort((first, second) => first.localeCompare(second));
    const priceSliderMaximum = useMemo(() => {
        const highestProductPrice = products.reduce(
            (highest, product) => Math.max(highest, getProductPrice(product)),
            0
        );
        return Math.max(10_000_000, Math.ceil(highestProductPrice / 10_000) * 10_000);
    }, [products]);
    const minimumPriceValue = Math.min(Number(minimumPrice) || 0, priceSliderMaximum);
    const maximumPriceValue = maximumPrice === ""
        ? priceSliderMaximum
        : Math.min(Number(maximumPrice), priceSliderMaximum);

    const filteredProducts = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        const filtered = products.filter((product) => {
            const matchesSearch = !normalizedSearch || [
                product.name,
                product.product_code,
                product.category,
                product.subcategory,
                product.metal_type,
                product.purity,
            ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
            const matchesCategory = !selectedCategories.length
                || selectedCategories.includes(product.category);
            const matchesMetal = !selectedMetals.length
                || selectedMetals.includes(product.metal_type);
            const matchesOffer = !offerThreshold || getDiscount(product) >= offerThreshold;
            const matchesRating = !minimumRating || Number(product.rating || 0) >= minimumRating;
            const inStock = productIsInStock(product);
            const matchesAvailability = !availability
                || (availability === "in-stock" ? inStock : !inStock);
            const price = getProductPrice(product);
            const matchesMinimum = minimumPrice === "" || price >= Number(minimumPrice);
            const matchesMaximum = maximumPrice === "" || price <= Number(maximumPrice);

            return matchesSearch && matchesCategory && matchesMetal && matchesOffer
                && matchesRating && matchesAvailability
                && matchesMinimum && matchesMaximum;
        });

        return filtered.sort((first, second) => {
            if (sortBy === "price-low") return getProductPrice(first) - getProductPrice(second);
            if (sortBy === "price-high") return getProductPrice(second) - getProductPrice(first);
            if (sortBy === "name") return String(first.name || "").localeCompare(String(second.name || ""));
            const firstDate = new Date(first.created_at || 0).getTime();
            const secondDate = new Date(second.created_at || 0).getTime();
            return sortBy === "oldest" ? firstDate - secondDate : secondDate - firstDate;
        });
    }, [availability, maximumPrice, minimumPrice, minimumRating, offerThreshold, products, search, selectedCategories, selectedMetals, sortBy]);

    const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
    const activePage = Math.min(currentPage, Math.max(totalPages, 1));
    const visibleProducts = filteredProducts.slice(
        (activePage - 1) * PRODUCTS_PER_PAGE,
        activePage * PRODUCTS_PER_PAGE
    );
    const clearFilters = () => {
        setSearch("");
        setSortBy("newest");
        setSelectedCategories([]);
        setSelectedMetals([]);
        setOfferThreshold(0);
        setMinimumRating(0);
        setAvailability("");
        setMinimumPrice("");
        setMaximumPrice("");
        setCurrentPage(1);
    };

    const toggleSelection = (value, setSelectedValues) => {
        setCurrentPage(1);
        setSelectedValues((current) => current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value]);
    };

    const filterSection = (key, title, content) => (
        <section className="border-b border-[#eee7dc] py-3 last:border-b-0">
            <button
                type="button"
                onClick={() => setOpenFilters((current) => ({ ...current, [key]: !current[key] }))}
                aria-expanded={openFilters[key]}
                className="flex w-full items-center justify-between text-left text-sm font-bold text-[#28251f]"
            >
                {title}
                <ChevronDown
                    size={15}
                    className={`text-[#777066] transition-transform ${openFilters[key] ? "" : "-rotate-90"}`}
                    aria-hidden="true"
                />
            </button>
            {openFilters[key] && <div className="mt-2.5 space-y-2">{content}</div>}
        </section>
    );

    const checkboxOption = (label, checked, onChange, count) => (
        <label key={label} className="flex cursor-pointer items-center gap-2 text-xs text-[#514b42]">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="h-3.5 w-3.5 shrink-0 accent-[#174a38]"
            />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {count != null && <span className="text-[10px] text-[#9a9286]">{count}</span>}
        </label>
    );

    return (
        <section className="space-y-5 pb-10">
            <header className="rounded-xl border border-[#eadfce] bg-gradient-to-r from-[#fffaf0] via-white to-[#f6f1e7] p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="relative block w-full sm:max-w-sm">
                        <Search
                            size={17}
                            aria-hidden="true"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81786b]"
                        />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search your products..."
                            aria-label="Search your products"
                            className="w-full rounded-lg border border-[#e8dfd1] bg-white py-2 pl-10 pr-4 text-sm text-[#30271b] outline-none transition focus:border-[#174a38] focus:ring-2 focus:ring-[#174a38]/10"
                        />
                    </label>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <label className="flex items-center gap-2 text-xs text-[#62594d]">
                            Sort by:
                            <select
                                value={sortBy}
                                onChange={(event) => {
                                    setCurrentPage(1);
                                    setSortBy(event.target.value);
                                }}
                                className="rounded-md border border-[#e8dfd1] bg-white px-2.5 py-1.5 text-xs text-[#30271b] outline-none focus:border-[#174a38]"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="name">Name: A to Z</option>
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={() => setFiltersVisible((visible) => !visible)}
                            aria-expanded={filtersVisible}
                            aria-controls="customer-product-filters"
                            className="flex shrink-0 items-center gap-2 rounded-lg border border-[#e8dfd1] bg-white px-3 py-1.5 text-xs font-semibold text-[#174a38] transition hover:border-[#d8b46c] hover:bg-[#fffaf0]"
                        >
                            <SlidersHorizontal size={14} aria-hidden="true" />
                            {filtersVisible ? "Hide Filters" : "Show Filters"}
                        </button>
                    </div>
                </div>
            </header>

            <div className={`grid items-start gap-5 ${filtersVisible ? "min-[480px]:grid-cols-[230px_minmax(0,1fr)]" : "min-[480px]:grid-cols-1"}`}>
                <aside id="customer-product-filters" className={`${filtersVisible ? "block" : "hidden"} h-fit rounded-xl border border-[#eee7dc] bg-white p-4 shadow-sm min-[480px]:sticky min-[480px]:top-4 min-[480px]:max-h-[calc(100vh-2rem)] min-[480px]:overflow-y-auto`}>
                    <div className="mb-1 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-[#29231c]">
                            <SlidersHorizontal size={15} className="text-[#174a38]" aria-hidden="true" />
                            Filters
                        </h2>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="text-[11px] font-semibold text-[#a77525] hover:underline"
                        >
                            Clear All
                        </button>
                    </div>

                    {filterSection("category", "Category", categories.length ? categories.map((category) => checkboxOption(
                        category,
                        selectedCategories.includes(category),
                        () => toggleSelection(category, setSelectedCategories),
                        categoryCounts[category]
                    )) : <p className="text-xs text-[#81786b]">{loading ? "Loading categories..." : "No categories found."}</p>)}

                    {filterSection("metal", "Metal", metals.length ? metals.map((metal) => checkboxOption(
                        metal,
                        selectedMetals.includes(metal),
                        () => toggleSelection(metal, setSelectedMetals),
                        metalCounts[metal]
                    )) : <p className="text-xs text-[#81786b]">{loading ? "Loading metals..." : "No metals found."}</p>)}

                    {filterSection("offer", "Offer Percentage", OFFER_THRESHOLDS.map((threshold) => checkboxOption(
                        `${threshold}% and above`,
                        offerThreshold === threshold,
                        () => {
                            setCurrentPage(1);
                            setOfferThreshold((current) => current === threshold ? 0 : threshold);
                        }
                    )))}

                    {filterSection("price", "Price Range", (
                        <>
                            <div className="px-1 pt-1">
                                <div className="relative h-5">
                                    <span className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#eadfca]" />
                                    <span
                                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#d49a19]"
                                        style={{
                                            left: `${(minimumPriceValue / priceSliderMaximum) * 100}%`,
                                            right: `${100 - (maximumPriceValue / priceSliderMaximum) * 100}%`,
                                        }}
                                    />
                                    <input
                                        type="range"
                                        min="0"
                                        max={maximumPriceValue}
                                        step={PRICE_STEP}
                                        value={minimumPriceValue}
                                        aria-label="Minimum price"
                                        onChange={(event) => {
                                            setCurrentPage(1);
                                            setMinimumPrice(event.target.value === "0" ? "" : event.target.value);
                                        }}
                                        className={PRICE_SLIDER_CLASS}
                                    />
                                    <input
                                        type="range"
                                        min={minimumPriceValue}
                                        max={priceSliderMaximum}
                                        step={PRICE_STEP}
                                        value={maximumPriceValue}
                                        aria-label="Maximum price"
                                        onChange={(event) => {
                                            setCurrentPage(1);
                                            setMaximumPrice(
                                                Number(event.target.value) >= priceSliderMaximum ? "" : event.target.value
                                            );
                                        }}
                                        className={PRICE_SLIDER_CLASS}
                                    />
                                </div>
                                <div className="mt-1 flex justify-between text-[10px] text-[#70685d]">
                                    <span>{formatCurrency(minimumPriceValue)}</span>
                                    <span>{formatCurrency(priceSliderMaximum)}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                                {PRICE_RANGES.map((range) => {
                                    const selected = minimumPriceValue === range.minimum
                                        && (range.maximum === null
                                            ? maximumPrice === ""
                                            : maximumPriceValue === range.maximum);
                                    return (
                                        <button
                                            key={range.label}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => {
                                                setCurrentPage(1);
                                                setMinimumPrice(range.minimum === 0 ? "" : String(range.minimum));
                                                setMaximumPrice(range.maximum === null ? "" : String(range.maximum));
                                            }}
                                            className={`rounded-md border px-1.5 py-1.5 text-[9px] transition sm:text-[10px] ${selected ? "border-[#d49a19] bg-[#fff7e5] font-semibold text-[#765323]" : "border-[#eee9e0] bg-[#faf9f6] text-[#777066] hover:border-[#d8b46c] hover:bg-[#fffaf0]"}`}
                                        >
                                            {range.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    ))}

                    {filterSection("rating", "Rating", (
                        <div className="space-y-2">
                            {RATING_THRESHOLDS.map((rating) => (
                                <label key={rating} className="flex cursor-pointer items-center gap-2 text-xs text-[#514b42]">
                                    <input
                                        type="checkbox"
                                        checked={minimumRating === rating}
                                        onChange={() => {
                                            setCurrentPage(1);
                                            setMinimumRating((current) => current === rating ? 0 : rating);
                                        }}
                                        aria-label={`${rating} stars and above`}
                                        className="h-3.5 w-3.5 shrink-0 accent-[#174a38]"
                                    />
                                    <span className="flex items-center gap-0.5" aria-hidden="true">
                                        {Array.from({ length: 5 }, (_, index) => (
                                            <Star
                                                key={index}
                                                size={11}
                                                className={index < rating ? "fill-[#e6a323] text-[#e6a323]" : "text-[#dedbd5]"}
                                            />
                                        ))}
                                    </span>
                                    <span className="min-w-0 flex-1 whitespace-nowrap">{rating} &amp; above</span>
                                    <span className="text-[10px] text-[#9a9286]">{ratingCounts[rating]}</span>
                                </label>
                            ))}
                        </div>
                    ))}

                    {filterSection("availability", "Availability", (
                        <>
                            {checkboxOption("In stock", availability === "in-stock", () => {
                                setCurrentPage(1);
                                setAvailability((current) => current === "in-stock" ? "" : "in-stock");
                            }, inStockCount)}
                            {checkboxOption("Out of stock", availability === "out-of-stock", () => {
                                setCurrentPage(1);
                                setAvailability((current) => current === "out-of-stock" ? "" : "out-of-stock");
                            }, products.length - inStockCount)}
                        </>
                    ))}
                </aside>

                <main className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <p className="text-xs text-[#81786b]" aria-live="polite">
                            {loading ? "Loading products..." : `Found ${filteredProducts.length} ${filteredProducts.length === 1 ? "product" : "products"}`}
                        </p>
                    </div>

                    {loading ? (
                        <p className="rounded-xl border border-[#eee7dc] bg-white py-16 text-center text-sm text-[#81786b]" role="status">
                            Loading your products...
                        </p>
                    ) : error ? (
                        <div className="rounded-xl border border-rose-200 bg-white px-5 py-12 text-center" role="alert">
                            <p className="text-sm text-rose-700">{error}</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setLoading(true);
                                    setError("");
                                    setRetryKey((current) => current + 1);
                                }}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#174a38] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10382f]"
                            >
                                <RefreshCw size={15} />
                                Try again
                            </button>
                        </div>
                    ) : visibleProducts.length ? (
                        <>
                            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${filtersVisible ? "xl:grid-cols-4 2xl:grid-cols-4" : "xl:grid-cols-5 2xl:grid-cols-5"}`}>
                                {visibleProducts.map((product) => {
                                    const image = getProductImageUrl(product);
                                    const productId = product.id ?? product.product_id;
                                    const offerPrice = getProductPrice(product);
                                    const mrp = Number(product.mrp || 0);
                                    const discount = getDiscount(product);
                                    const grossWeight = Number(product.gross_weight);
                                    const weight = grossWeight > 0 ? product.gross_weight : product.net_gold_weight;
                                    const weightText = weight != null && Number.isFinite(Number(weight)) && Number(weight) > 0
                                        ? `${Number(weight).toLocaleString("en-IN", { maximumFractionDigits: 3 })} g`
                                        : "";
                                    return (
                                        <Link
                                            key={productId}
                                            to={`/admin/customer-view-products/${productId}`}
                                            className="group overflow-hidden rounded-xl border border-[#eadfce] bg-white shadow-sm transition hover:border-[#d8b46c] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174a38]"
                                        >
                                            <div className="relative aspect-square overflow-hidden bg-[#f6efe4]">
                                                {image ? (
                                                    <img
                                                        src={image}
                                                        alt={product.name || "Product"}
                                                        loading="lazy"
                                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-xs text-[#81786b]">
                                                        No image
                                                    </div>
                                                )}
                                                <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#765323] shadow-sm">
                                                    {product.category || "Jewelry"}
                                                </span>
                                                {discount > 0 && (
                                                    <span className="absolute right-2 top-2 rounded-full bg-[#fff0ee] px-2.5 py-1 text-[10px] font-bold text-[#d33627] shadow-sm">
                                                        {discount}% OFF
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <h3 className="line-clamp-2 min-h-10 text-sm font-semibold text-[#292018]" title={product.name}>
                                                    {product.name || "Unnamed product"}
                                                </h3>
                                                <p className="mt-1 truncate text-[10px] text-[#81786b]">
                                                    {[product.metal_type, weightText].filter(Boolean).join(" · ")}
                                                </p>
                                                <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                                                    <span className="text-sm font-bold text-[#c51e18]">
                                                        {formatCurrency(offerPrice)}
                                                    </span>
                                                    {mrp > offerPrice && (
                                                        <span className="text-[10px] text-[#858b87] line-through">
                                                            {formatCurrency(mrp)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                            {totalPages > 1 && (
                                <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Product pages">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                                        disabled={activePage === 1}
                                        className="rounded-lg border border-[#e8dfd1] bg-white px-4 py-2 text-sm font-semibold text-[#514638] hover:border-[#d8b46c] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-[#62594d]" aria-current="page">
                                        Page {activePage} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                                        disabled={activePage === totalPages}
                                        className="rounded-lg border border-[#e8dfd1] bg-white px-4 py-2 text-sm font-semibold text-[#514638] hover:border-[#d8b46c] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </nav>
                            )}
                        </>
                    ) : (
                        <div className="rounded-xl border border-[#eee7dc] bg-white py-16 text-center">
                            <p className="font-serif text-lg font-semibold text-[#29231c]">
                                {search || selectedCategories.length || selectedMetals.length || offerThreshold || minimumRating || availability || minimumPrice || maximumPrice
                                    ? "No matching products found"
                                    : "No products yet"}
                            </p>
                            <p className="mt-1 text-sm text-[#81786b]">
                                {products.length ? "Try changing or clearing the filters." : "Products you add will appear here."}
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </section>
    );
};

export default CustomerViewProducts;
