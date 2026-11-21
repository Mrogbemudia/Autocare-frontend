import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import TrafficCanvas from '../components/TrafficCanvas';

const naira = (n) => `₦${n.toLocaleString('en-NG')}`;
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const btn = 'inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink focus-visible:ring-offset-2';

function useMotionPreference() {
  const [reduced, setReduced] = useState(prefersReduced);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (event) => setReduced(event.matches);
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);
  return reduced;
}

function useInView() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

function CountUp({ to, run, paused }) {
  const [n, setN] = useState(() => (prefersReduced() ? to : 0));
  useEffect(() => {
    if (!run || paused) return;
    let raf;
    if (prefersReduced()) {
      raf = requestAnimationFrame(() => setN(to));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / 1200, 1);
      setN(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to, paused]);
  return <>{n}</>;
}

function LockIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/* ---------- Hero: an example quote that locks, then waits for approval ---------- */
const LINES = [['Front brake pads (2)', 38000], ['Brake fluid flush', 9500], ['Labour', 24000]];
const EXTRA = 18000;
const HOLD = [600, 800, 800, 1000, 1400, 2400, 3600]; // ms spent on each step before moving on

function Receipt({ paused }) {
  const [step, setStep] = useState(() => (prefersReduced() ? 6 : 0));
  useEffect(() => {
    if (prefersReduced() || paused) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % 7), HOLD[step]);
    return () => clearTimeout(t);
  }, [step, paused]);

  const total = LINES.reduce((sum, [, p]) => sum + p, 0) + (step >= 6 ? EXTRA : 0);
  const fade = (n) => `transition duration-500 ${step >= n ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`;

  return (
    <div
      data-traffic-obstacle
      role="img"
      aria-label="Example: a repair quote is locked at ₦71,500. Extra work of ₦18,000 then waits for the owner to approve it before it is added."
      className="relative rounded-2xl border-2 border-line bg-card p-6 text-ink shadow-[0_28px_60px_-34px_rgba(15,23,42,0.35)] sm:p-8"
    >
      <div aria-hidden="true">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sub">Example job · 2012 Toyota Camry</p>
            <p className="mt-1 font-display text-lg font-extrabold text-ink">Adewale Auto Works, Ikeja</p>
          </div>
          <span className="rounded-full bg-ok/15 px-2.5 py-1 text-xs font-semibold text-ok">Verified</span>
        </div>

        <ul className="mt-6 space-y-3 border-t border-line pt-5 tabular-nums">
          {LINES.map(([label, price], i) => (
            <li key={label} className={`flex justify-between gap-4 ${fade(i + 1)}`}>
              <span>{label}</span><span>{naira(price)}</span>
            </li>
          ))}
        </ul>

        <div className={`mt-5 rounded-lg border border-dashed border-signal p-4 ${fade(5)}`}>
          <div className="flex justify-between gap-4 tabular-nums">
            <span className="font-medium">Extra work: rotor resurfacing</span>
            <span>+{naira(EXTRA)}</span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-sub">
            {step >= 6 ? (
              <><span className="font-semibold text-ok">Approved by you · 2:41 pm</span></>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal" />
                </span>
                Work is paused until you approve this
              </>
            )}
          </p>
        </div>

        <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-sm font-semibold text-sub">{step >= 6 ? 'Final cost' : 'Quote total'}</span>
          <span className="font-display text-3xl font-bold tabular-nums">{step >= 3 ? naira(total) : '—'}</span>
        </div>
      </div>

      {step >= 4 && (
        <span key={step >= 4 ? 'on' : 'off'} className="k-stamp absolute -top-3 right-5 flex items-center gap-1.5 rounded-md bg-signal px-3 py-1.5 font-display text-sm font-bold text-asphalt shadow" aria-hidden="true">
          <LockIcon /> Price locked
        </span>
      )}
    </div>
  );
}

/* ---------- Marquee ---------- */
const TAGS = ['Mobile mechanics', 'Heavy towing', 'Tyre specialists', 'EV technicians', '24/7 shops', 'General repair',
  'Cars', 'SUVs', 'Buses', 'Trucks', 'Motorcycles', 'Tricycles'];

function Marquee({ paused }) {
  const [pointerPaused, setPointerPaused] = useState(false);
  const row = (hidden) => (
    <ul className="flex shrink-0 gap-3 pr-3" aria-hidden={hidden || undefined}>
      {TAGS.map((t) => (
        <li key={t} className="whitespace-nowrap rounded-full border-2 border-line bg-card px-4 py-2 text-sm font-semibold text-ink">{t}</li>
      ))}
    </ul>
  );
  return (
    <div className="overflow-hidden border-y-2 border-line bg-page py-4 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <div
        className={`k-marquee ${paused || pointerPaused ? 'k-marquee-paused' : ''} flex w-max`}
        onPointerDown={() => setPointerPaused(true)}
        onPointerUp={() => setPointerPaused(false)}
        onPointerCancel={() => setPointerPaused(false)}
        onPointerLeave={() => setPointerPaused(false)}
      >
        {row(false)}{row(true)}
      </div>
    </div>
  );
}

/* ---------- Pipeline ---------- */
const STAGES = [
  ['Inspection', 'The shop checks the vehicle and confirms the fault.'],
  ['Approval pending', 'Extra work found. The job pauses until you approve it.'],
  ['In repair', 'Work continues on the locked price plus approved extras.'],
  ['Testing', 'The shop road-tests and checks the repair.'],
  ['Ready for pickup', 'You are told the vehicle is ready.'],
  ['Completed', 'Final cost is the locked quote plus approved extras only.'],
];

function Pipeline({ paused }) {
  const [ref, seen] = useInView();
  const [active, setActive] = useState(() => (prefersReduced() ? 5 : -1));
  useEffect(() => {
    if (!seen || paused || prefersReduced()) return;
    let i = 0;
    const id = setInterval(() => { setActive(i); i += 1; if (i > 5) clearInterval(id); }, 650);
    return () => clearInterval(id);
  }, [seen, paused]);

  return (
    <ol ref={ref} className="mt-10 grid gap-5 md:grid-cols-6 md:gap-4">
      {STAGES.map(([title, text], i) => (
        <li key={title} className={`rounded-lg border-t-4 bg-card px-3 py-4 transition-colors duration-500 ${i <= active ? 'border-[#EAB308]' : 'border-line'}`}>
          <h3 className="flex items-center gap-1.5 font-display font-extrabold text-ink">
            {i === 1 && <LockIcon className="h-3.5 w-3.5" />}{title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-sub">{text}</p>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Page ---------- */
const FACTS = [
  [37, 'states and the FCT you can search by'],
  [6, 'service types, from towing to EV repair'],
  [6, 'vehicle types, from tricycles to trucks'],
];
const STEPS = [
  ['Find a verified shop', 'Filter by state, area and service. Only shops an admin has checked are listed.'],
  ['Compare an itemised quote', 'Parts, quantities and labour in naira, with the total worked out for you.'],
  ['Accept, book and follow the job', 'Accepting locks the price. Track every stage from your phone.'],
];

export default function Home() {
  const [factsRef, factsSeen] = useInView();
  const reducedMotion = useMotionPreference();
  const [motionPaused, setMotionPaused] = useState(false);
  const paused = motionPaused || reducedMotion;

  return (
    <div className="bg-page text-ink">
      <header className="border-b-2 border-line bg-page">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-5 lg:pb-24">
          <div className="mb-6 flex justify-end">
            <button
              type="button"
              onClick={() => setMotionPaused((value) => !value)}
              disabled={reducedMotion}
              aria-pressed={paused}
              className="min-h-12 rounded-lg border-2 border-ink bg-card px-4 py-2 text-sm font-bold text-ink shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed"
            >
              {reducedMotion ? 'Motion paused (system preference)' : paused ? 'Resume Motion' : 'Pause Motion'}
            </button>
          </div>
          <section className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="rounded-xl bg-card">
              <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
                A repair price that stays the price.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-sub">
                Kaza connects vehicle owners across Nigeria with verified mechanics. Accept an itemised quote and the price locks.
                Anything extra needs your approval in the app first.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/shops" className={`${btn} bg-[#FACC15] text-[#0F172A] hover:bg-[#EAB308]`}>Find a verified shop</Link>
                <Link to="/register" className={`${btn} border-2 border-ink bg-card text-ink hover:bg-page`}>Register your shop</Link>
              </div>
            </div>
            <Receipt paused={paused} />
          </section>
        </div>
      </header>

      <TrafficCanvas
        paused={paused}
        variant="hero"
        className="h-24 border-b-2 border-line bg-road"
      />

      <section aria-label="Services and vehicles covered" className="bg-page py-20"><Marquee paused={paused} /></section>

      <section className="border-t-2 border-line bg-page px-4 pb-24 pt-16">
        <div className="mx-auto max-w-6xl rounded-2xl border-2 border-line bg-card p-6 sm:p-8">
          <h2 className="max-w-2xl font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Extra work waits for your yes.</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-sub">
            If a mechanic finds more to fix, they send a written request with the reason and the cost. The job cannot move
            to repair until you approve it, and every decision is time-stamped.
          </p>
          <Pipeline paused={paused} />
        </div>
      </section>
      <TrafficCanvas paused={paused} variant="pipeline" className="h-24 border-y-2 border-line bg-road" />

      <section ref={factsRef} aria-label="Kaza coverage" className="border-y-2 border-line bg-road">
        <dl className="mx-auto grid max-w-6xl divide-y divide-line px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {FACTS.map(([n, label]) => (
            <div key={label} className="py-7 sm:px-8 sm:py-10">
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-5xl font-extrabold text-ink tabular-nums sm:text-6xl" aria-label={`${n} ${label}`}>
                <span aria-hidden="true"><CountUp to={n} run={factsSeen} paused={paused} /></span>
              </dd>
              <p className="mt-2 max-w-xs text-base font-semibold leading-6 text-sub" aria-hidden="true">{label}</p>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 bg-page px-4 py-24 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">How Kaza works for owners</h2>
          <ol className="mt-8 divide-y divide-line border-y border-line">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-5 py-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#0F172A] bg-[#FACC15] font-display font-extrabold text-[#0F172A]">{i + 1}</span>
                <div className="pt-1"><h3 className="font-display text-lg font-extrabold text-ink">{title}</h3><p className="mt-1 text-base leading-7 text-sub">{text}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="self-start rounded-2xl border-2 border-ink bg-card p-7">
          <h3 className="font-display text-xl font-extrabold text-ink">Run a repair shop?</h3>
          <p className="mt-3 text-base leading-7 text-sub">Register your business, get verified by an admin, then receive requests and send itemised quotes.</p>
          <Link to="/register" className={`${btn} mt-5 bg-[#0F172A] text-white hover:bg-slate-800`}>Register your shop</Link>
        </div>
      </section>

      <TrafficCanvas paused={paused} variant="how" className="h-24 border-y-2 border-line bg-road" />

      <section className="border-b-2 border-[#0F172A] bg-[#FACC15] text-[#0F172A]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center">
          <h2 className="max-w-xl font-display text-3xl font-extrabold tracking-tight text-[#0F172A]">Get a price you can hold them to.</h2>
          <Link to="/shops" className={`${btn} border-2 border-[#0F172A] bg-[#0F172A] text-white hover:bg-slate-800`}>Find a verified shop</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
