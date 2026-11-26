import { Children, Fragment, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";

const getTextContent = (node) => {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(getTextContent).join("");
    if (isValidElement(node)) return getTextContent(node.props.children);
    return "";
};

const getOptions = (children, groupLabel = null, groupDisabled = false) => {
    const options = [];

    Children.toArray(children).forEach((child) => {
        if (!isValidElement(child)) return;

        if (child.type === Fragment) {
            options.push(...getOptions(child.props.children, groupLabel, groupDisabled));
            return;
        }

        if (child.type === "optgroup") {
            options.push(...getOptions(child.props.children, child.props.label, groupDisabled || child.props.disabled));
            return;
        }

        if (child.type !== "option") return;

        const label = child.props.label ?? child.props.children;
        options.push({
            value: String(child.props.value ?? getTextContent(label)),
            label,
            text: getTextContent(label),
            disabled: Boolean(child.props.disabled || groupDisabled),
            group: groupLabel,
        });
    });

    return options;
};

const CustomSelect = ({
    children,
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    onClick,
    onKeyDown,
    onInvalid,
    className = "",
    variant = "default",
    style,
    name,
    id,
    required = false,
    disabled = false,
    form,
    ...buttonProps
}) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const listboxId = `${selectId}-options`;
    const fullWidth = /\b(?:w-full|block)\b/.test(className) || style?.width === "100%";
    const darkVariant = variant === "dark";
    const wrapperRef = useRef(null);
    const triggerRef = useRef(null);
    const options = useMemo(() => getOptions(children), [children]);
    const [uncontrolledValue, setUncontrolledValue] = useState(() => (
        defaultValue == null ? options[0]?.value ?? "" : String(defaultValue)
    ));
    const selectedValue = value === undefined
        ? uncontrolledValue
        : value == null
            ? ""
            : String(value);
    const selectedIndex = options.findIndex((option) => option.value === selectedValue);
    const selectedOption = selectedIndex < 0 ? null : options[selectedIndex];
    const enabledIndexes = options.reduce((indexes, option, index) => {
        if (!option.disabled) indexes.push(index);
        return indexes;
    }, []);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(selectedIndex);
    const [invalid, setInvalid] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        const closeOnOutsidePointer = (event) => {
            if (!wrapperRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutsidePointer);
        return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
    }, [open]);

    const firstEnabledIndex = enabledIndexes[0] ?? -1;
    const lastEnabledIndex = enabledIndexes[enabledIndexes.length - 1] ?? -1;
    const openAtSelected = () => {
        setActiveIndex(selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabledIndex);
        setOpen(true);
    };

    const chooseOption = (index) => {
        const option = options[index];
        if (!option || option.disabled) return;

        if (value === undefined) setUncontrolledValue(option.value);
        setInvalid(false);
        onChange?.({
            target: {
                name,
                id: selectId,
                value: option.value,
                selectedOptions: [{ value: option.value, label: option.text, textContent: option.text }],
                options: options.map(({ value: optionValue, text }) => ({ value: optionValue, text })),
            },
            currentTarget: { name, id: selectId, value: option.value },
            preventDefault() {},
            stopPropagation() {},
        });
        setActiveIndex(index);
        setOpen(false);
    };

    const handleKeyDown = (event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
                openAtSelected();
                return;
            }
            if (enabledIndexes.length === 0) return;

            const currentPosition = enabledIndexes.indexOf(activeIndex);
            const direction = event.key === "ArrowDown" ? 1 : -1;
            const nextPosition = (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
            setActiveIndex(enabledIndexes[nextPosition] ?? activeIndex);
        } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setActiveIndex(event.key === "Home" ? firstEnabledIndex : lastEnabledIndex);
            setOpen(true);
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!open) openAtSelected();
            else chooseOption(activeIndex);
        } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className={`relative max-w-full ${fullWidth ? "block w-full" : "inline-block align-middle"}`}>
            <button
                {...buttonProps}
                ref={triggerRef}
                id={selectId}
                type="button"
                role="combobox"
                aria-haspopup="listbox"
                aria-controls={listboxId}
                aria-expanded={open}
                aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
                aria-required={required || undefined}
                aria-disabled={disabled || undefined}
                aria-invalid={buttonProps["aria-invalid"] ?? (invalid || undefined)}
                disabled={disabled}
                onClick={(event) => {
                    onClick?.(event);
                    if (event.defaultPrevented) return;
                    if (open) setOpen(false);
                    else openAtSelected();
                }}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={(event) => {
                    onBlur?.(event);
                    if (!wrapperRef.current?.contains(event.relatedTarget)) setOpen(false);
                }}
                className={`relative ${fullWidth ? "block w-full" : "inline-flex max-w-full"} cursor-pointer appearance-none rounded-xl border px-3 py-2.5 pr-10 text-left text-sm shadow-sm transition duration-150 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                    darkVariant
                        ? "border-white/15 bg-white/10 text-white hover:border-white/30 focus:border-amber-300 focus:ring-amber-300/15"
                        : "border-slate-200 bg-white text-slate-800 hover:border-emerald-500/60 focus:border-emerald-600 focus:ring-emerald-100"
                } ${className}`}
                style={{ ...style, paddingRight: style?.paddingRight ?? "2.5rem" }}
            >
                <span className="block truncate">{selectedOption?.label ?? ""}</span>
                <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform duration-200 ${darkVariant ? "text-white/60" : "text-slate-500"} ${open ? "rotate-180" : ""}`}
                >
                    <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            <select
                id={`${selectId}-native`}
                name={name}
                form={form}
                value={selectedValue}
                required={required}
                disabled={disabled}
                aria-hidden="true"
                tabIndex={-1}
                onChange={() => {}}
                onInvalid={(event) => {
                    onInvalid?.(event);
                    setInvalid(true);
                    setOpen(true);
                    requestAnimationFrame(() => triggerRef.current?.focus());
                }}
                className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
                style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}
            >
                {children}
            </select>
            {open && (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-label={buttonProps["aria-label"] || buttonProps.title}
                    aria-labelledby={buttonProps["aria-label"] || buttonProps.title ? undefined : selectId}
                    className={`absolute inset-x-0 top-[calc(100%+0.375rem)] z-[130] max-h-64 overflow-y-auto rounded-xl border p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.2)] ring-1 ${
                        darkVariant
                            ? "border-white/15 bg-[#0b3d37] ring-white/10"
                            : "border-emerald-100 bg-white ring-black/5"
                    }`}
                >
                    {options.map((option, index) => (
                        <div key={`${option.value}-${index}`}>
                            {option.group && (index === 0 || options[index - 1].group !== option.group) && (
                                <div role="presentation" className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {option.group}
                                </div>
                            )}
                            <div
                                id={`${listboxId}-${index}`}
                                role="option"
                                aria-selected={option.value === selectedValue}
                                aria-disabled={option.disabled || undefined}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => {
                                    if (!option.disabled) setActiveIndex(index);
                                }}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    chooseOption(index);
                                }}
                                className={`flex min-h-9 items-center rounded-lg px-2.5 py-2 text-sm transition-colors ${
                                    option.disabled
                                        ? darkVariant
                                            ? "cursor-not-allowed text-white/30"
                                            : "cursor-not-allowed text-slate-300"
                                        : index === activeIndex
                                            ? darkVariant
                                                ? "cursor-pointer bg-white/15 font-semibold text-white ring-1 ring-inset ring-white/15"
                                                : "cursor-pointer bg-gradient-to-r from-emerald-50 to-[#FBF8F0] font-semibold text-slate-800 ring-1 ring-inset ring-emerald-100"
                                            : darkVariant
                                                ? "cursor-pointer text-white/75 hover:bg-white/10 hover:text-white"
                                                : "cursor-pointer text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                {option.value === selectedValue && (
                                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`ml-2 h-4 w-4 shrink-0 ${darkVariant ? "text-amber-300" : "text-emerald-700"}`}>
                                        <path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                        </div>
                    ))}
                    {options.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No options available</div>}
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
