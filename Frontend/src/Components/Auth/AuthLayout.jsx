import { BarChart3, Gem, ShieldCheck, Zap } from "lucide-react";
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
  children
}) {
  return (
    <main className={`${fixedHeight ? "h-screen overflow-hidden" : "min-h-screen"} bg-[#f4f0e5] p-3 sm:p-5 lg:p-8`}>
      <div className={`mx-auto grid max-w-[1440px] overflow-hidden rounded-[28px] border border-stone-200/80 bg-white shadow-[0_24px_80px_rgba(27,39,33,0.14)] lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] ${fixedHeight ? "h-full min-h-0 grid-rows-[minmax(0,1fr)]" : "min-h-[calc(100vh-1.5rem)] sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-4rem)]"}`}>
        <aside className={`relative hidden flex-col justify-between overflow-hidden bg-[#063d2c] p-8 text-white lg:flex xl:p-10 ${fixedHeight ? "min-h-0" : ""}`}>
          <img src="/images/registerbanner.png" alt="" className="absolute inset-0 h-full w-full object-cover object-[62%_center]" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/85 via-emerald-950/55 to-emerald-950/25" />
          <div className="relative z-10 flex items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg shadow-black/15">
              <img src="/images/logo1.png" alt="Sri Golds logo" className="h-full w-full object-contain" />
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight text-amber-400">Sri Golds</span>
              <span className="mt-0.5 block text-sm font-medium text-white/85">Super Admin Panel</span>
            </span>
          </div>

          <div className="relative z-10 max-w-md py-8">
            <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl">
              Your shop.<br />
              Your craft.<br />
              <span className="font-serif italic text-amber-300">One clear view.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/85">
              Manage inventory, subscriptions, and daily operations from one secure workspace designed for gold retailers.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm font-medium text-white/90">
              <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-300/15 text-amber-300"><ShieldCheck size={19} /></span>Secure &amp; Reliable</li>
              <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-300/15 text-amber-300"><Zap size={19} /></span>Simple &amp; Fast</li>
              <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-300/15 text-amber-300"><BarChart3 size={19} /></span>Grow Your Business</li>
            </ul>
          </div>

          <p className="relative z-10 text-xs text-white/65">Gold Shop Management · Admin Portal</p>
        </aside>

        <section className={`flex min-w-0 flex-col bg-[#fffdf8] ${fixedHeight ? "min-h-0 overflow-hidden px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5 xl:px-7" : "px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9 xl:px-14"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 lg:hidden">
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

          <header className={`shrink-0 ${fixedHeight ? "mb-3 mt-3 lg:mt-4" : "mb-6 mt-7 sm:mb-8 lg:mt-10"}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-950">{eyebrow}</p>
            {fixedHeight && <span className="mt-2 block h-0.5 w-32 bg-gradient-to-r from-amber-500 to-amber-100" />}
            <h1 className={`mt-2 font-semibold tracking-tight text-[#172a23] ${fixedHeight ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}>{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{subtitle}</p>
          </header>

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
