import { Gem, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  alternatePrompt,
  alternateLabel,
  alternateTo,
  contentClassName = "",
  fixedHeight = false,
  hideHeader = false,
  splitLayout = false,
  children
}) {
  if (splitLayout) {
    return (
      <main className="min-h-screen bg-white lg:h-screen lg:overflow-hidden">
        <div className="flex min-h-screen w-full overflow-hidden bg-white lg:h-full lg:min-h-0">
          <aside className="relative hidden min-h-full w-[62%] flex-none flex-col justify-between overflow-hidden bg-[#063d2c] p-10 text-white lg:flex xl:p-14">
            <img
              src="/images/loginbanner.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#003B3B]/55 via-[#003B3B]/20 to-[#003B3B]/65" />
            <div className="relative flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/10 text-amber-300 backdrop-blur-sm">
                <Gem size={22} />
              </span>
              <div>
                <p className="text-sm font-black tracking-[0.16em]">SRI GOLDS</p>
                <p className="mt-0.5 text-xs text-white/75">A legacy of fine jewellery</p>
              </div>
            </div>

            <div className="relative max-w-xl py-10">
              <span className="inline-flex rounded-full border border-emerald-100/50 bg-emerald-950/30 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-50 backdrop-blur-sm">
                Fine jewellery · Trusted for generations
              </span>
              <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight xl:text-5xl">
                Timeless elegance for <span className="text-amber-300">every occasion.</span>
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/80 xl:text-base">
                Discover a better way to manage your jewellery shop, serve customers, and keep every detail in harmony.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {["Gold", "Diamond", "Silver"].map((item) => (
                  <span key={item} className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-[#064A41]">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative border-t border-white/20 pt-5">
              <h3 className="mb-5 text-center text-3xl font-black tracking-tight xl:text-4xl">Welcome to Sri Golds</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Secure access", icon: <ShieldCheck size={19} /> },
                { label: "Shop management", icon: <Gem size={19} /> },
                { label: "Trusted support", icon: <ShieldCheck size={19} /> }
              ].map((feature) => (
                <div key={feature.label} className="flex flex-col items-center gap-2 text-xs font-semibold text-white/90">
                  <span className="text-amber-300">{feature.icon}</span>
                  {feature.label}
                </div>
              ))}
              </div>
            </div>
          </aside>

          <section className="flex w-full min-w-0 flex-col bg-white px-5 py-5 sm:px-8 sm:py-7 lg:-ml-[4%] lg:h-full lg:min-h-0 lg:w-[42%] lg:flex-none lg:rounded-l-[5rem] lg:px-10 lg:py-8 xl:px-14">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 lg:hidden">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#063d2c] text-amber-300">
                  <Gem size={19} />
                </span>
                <span className="text-xs font-black tracking-[0.12em] text-[#063d2c]">SRI GOLDS</span>
              </div>
              <div className="ml-auto text-right text-xs text-stone-500 sm:text-sm">
                <span>{alternatePrompt} </span>
                <Link to={alternateTo} className="font-bold text-[#00695C] hover:text-[#003B3B] hover:underline">
                  {alternateLabel}
                </Link>
              </div>
            </div>

            <div className="mt-4 flex justify-center lg:mt-2">
              <img src="/images/logo.png" alt="Sri Golds" className="h-20 w-48 object-contain sm:h-24 sm:w-56" />
            </div>

            {!hideHeader && (
              <header className="mb-5 mt-3 shrink-0 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800">{eyebrow}</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#172a23] sm:text-3xl">{title}</h1>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">{subtitle}</p>
              </header>
            )}

            <div className={`w-full flex-1 ${contentClassName}`}>{children}</div>

            <footer className="flex shrink-0 items-center justify-center gap-2 pt-5 text-center text-[11px] text-stone-500">
              <ShieldCheck size={17} className="shrink-0 text-emerald-800" />
              <span>Your data is safe with us</span>
              <span className="mx-1 h-4 w-px bg-emerald-300" />
              <span>Trusted by Gold Retailers Across India</span>
            </footer>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`${fixedHeight ? "h-screen overflow-hidden" : "min-h-screen"} bg-[#f4f0e5] p-3 sm:p-5 lg:p-8`}>
      <div className={`mx-auto flex max-w-[920px] overflow-hidden rounded-[28px] border border-stone-200/80 bg-white shadow-[0_24px_80px_rgba(27,39,33,0.14)] ${fixedHeight ? "h-full min-h-0" : "min-h-[calc(100vh-1.5rem)] sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-4rem)]"}`}>
        <section className={`flex w-full min-w-0 flex-col bg-[#fffdf8] ${fixedHeight ? "min-h-0 overflow-hidden px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5 xl:px-7" : "px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9 xl:px-14"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#063d2c] text-amber-300">
                <Gem size={20} />
              </span>
              <span className="text-xs font-black tracking-[0.14em] text-[#063d2c]">SRI GOLDS</span>
            </div>
            <div className="ml-auto text-right text-xs text-stone-500 sm:text-sm">
              <span>{alternatePrompt} </span>
              <Link to={alternateTo} className="font-bold text-amber-800 hover:text-amber-950 hover:underline">
                {alternateLabel}
              </Link>
            </div>
          </div>

          {!hideHeader && (
            <header className={`shrink-0 ${fixedHeight ? "mb-3 mt-3 lg:mt-4" : "mb-6 mt-7 sm:mb-8 lg:mt-10"}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-950">{eyebrow}</p>
              {fixedHeight && <span className="mt-2 block h-0.5 w-32 bg-gradient-to-r from-amber-500 to-amber-100" />}
              <h1 className={`mt-2 font-semibold tracking-tight text-[#172a23] ${fixedHeight ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}>{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{subtitle}</p>
            </header>
          )}

          <div className={`w-full ${fixedHeight ? "min-h-0 flex-1" : ""} ${contentClassName}`}>{children}</div>

          <footer className={`shrink-0 text-center text-[11px] text-stone-500 ${fixedHeight ? "flex items-center justify-center gap-2 pt-2" : "mt-auto pt-6"}`}>
            {fixedHeight ? (
              <>
                <ShieldCheck size={17} className="shrink-0 text-emerald-800" />
                <span>Your data is safe with us</span>
                <span className="mx-2 h-5 w-px bg-amber-500" />
                <span>Trusted by Gold Retailers Across India</span>
              </>
            ) : "Protected access · Shop applications are reviewed before approval"}
          </footer>
        </section>
      </div>
    </main>
  );
}
