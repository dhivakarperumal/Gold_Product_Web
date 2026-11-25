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
  children
}) {
  return (
    <main className="min-h-screen bg-[#f0efe9] p-3 sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] overflow-hidden rounded-[28px] border border-stone-200/80 bg-white shadow-[0_24px_80px_rgba(27,39,33,0.14)] sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#10251f] p-9 text-white lg:flex xl:p-12">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-amber-200/10" />
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-amber-200/10" />
          <div className="absolute -bottom-48 -left-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-200/20 bg-amber-100/10 text-amber-300">
              <Gem size={24} strokeWidth={1.6} />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.16em]">GOLD SHOP</span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">Management portal</span>
            </span>
          </div>

          <div className="relative z-10 max-w-md py-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Built for your business</p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl">
              Your shop.<br />
              Your craft.<br />
              <span className="font-serif italic text-amber-300">One clear view.</span>
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-7 text-white/65">
              Manage inventory, subscriptions, and daily operations from one secure workspace designed for gold retailers.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-white/75">
              <ShieldCheck size={16} className="text-amber-300" />
              Secure access for approved shop administrators
            </div>
          </div>

          <p className="relative z-10 text-xs text-white/40">Gold Shop Management · Admin Portal</p>
        </aside>

        <section className="flex min-w-0 flex-col bg-[#fbfaf7] px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9 xl:px-14">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#10251f] text-amber-300">
                <Gem size={20} />
              </span>
              <span className="text-xs font-black tracking-[0.14em] text-[#10251f]">GOLD SHOP</span>
            </div>
            <div className="ml-auto text-right text-xs text-stone-500 sm:text-sm">
              <span>{alternatePrompt} </span>
              <Link to={alternateTo} className="font-bold text-amber-800 hover:text-amber-950 hover:underline">
                {alternateLabel}
              </Link>
            </div>
          </div>

          <header className="mb-6 mt-7 sm:mb-8 lg:mt-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#172a23] sm:text-4xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{subtitle}</p>
          </header>

          <div className={`w-full ${contentClassName}`}>{children}</div>

          <footer className="mt-auto pt-6 text-center text-[11px] text-stone-400">
            Protected access · Shop applications are reviewed before approval
          </footer>
        </section>
      </div>
    </main>
  );
}
