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
  children
}) {
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
