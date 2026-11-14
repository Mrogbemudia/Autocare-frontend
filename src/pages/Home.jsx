import { Link } from 'react-router-dom'
import { formatNaira } from '../lib/format.js'

const STEPS = [
  ['Send your problem to a shop', 'Pick a verified shop, choose your vehicle and describe what is wrong.'],
  ['Get an itemised quote', 'See parts, labour and time. Once you accept, the price is locked.'],
  ['Approve extras as they come up', 'If the mechanic finds more work, they must ask first. You see the reason and the cost, then approve or decline.'],
]

// A picture of the Approval Lock, the idea Kaza is built around.
function ApprovalPreview() {
  return (
    <div
      role="img"
      aria-label={`Example: a locked quote of ${formatNaira(6850000)} for brake pads and labour, and a pending extra-work request of ${formatNaira(2400000)} waiting for the owner's approval.`}
      className="min-w-0 overflow-hidden rounded-lg border-2 border-ink bg-white shadow-[6px_6px_0_#1c1f26]"
    >
      <div className="flex items-center justify-between gap-4 bg-ink px-5 py-3 text-white">
        <p className="font-display text-lg font-bold">Repair estimate</p>
        <span className="rounded-full bg-verified px-3 py-1 text-xs font-bold text-white">Quote accepted</span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">Front brake pads</p>
            <p className="text-sm text-ink-soft">Parts</p>
          </div>
          <p className="font-semibold">{formatNaira(5200000)}</p>
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">Fitting</p>
            <p className="text-sm text-ink-soft">Labour</p>
          </div>
          <p className="font-semibold">{formatNaira(1650000)}</p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-line pt-3">
          <p className="font-display text-lg font-bold">Agreed total</p>
          <p className="font-display text-2xl font-extrabold">{formatNaira(6850000)}</p>
        </div>
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-verified">
          <span aria-hidden="true" className="size-2 rounded-full bg-verified" />
          This price is locked
        </p>
      </div>
      <div className="border-t-2 border-ink bg-road p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-alert">New finding · approval needed</p>
          <span className="rounded-sm bg-white px-2 py-1 text-xs font-semibold text-ink">Not started</span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-4">
          <p className="max-w-sm">The rear brake disc is warped and needs replacing.</p>
          <p className="shrink-0 font-display text-xl font-extrabold">+{formatNaira(2400000)}</p>
        </div>
        <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">The shop must wait for your approval before continuing.</p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <>
      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center md:gap-16 md:py-20">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">Know the price before the work starts.</h1>
          <p className="mt-5 max-w-prose text-lg text-ink-soft">
            Find a verified repair shop, get an itemised quote, and agree on the work before it begins. If the mechanic
            finds something else, they ask you first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shops" className="btn btn-primary">Find a verified shop</Link>
            <Link to="/register?role=shop" className="btn btn-secondary">List your shop</Link>
          </div>
        </div>
        <ApprovalPreview />
      </section>

      <section className="border-t-2 border-ink bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
          <h2 className="text-2xl sm:text-3xl">How a repair works on Kaza</h2>
          <ol className="mt-8 grid gap-0 md:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="border-t border-line py-5 md:border-l md:border-t-0 md:px-6 md:py-2 first:md:border-l-0 first:md:pl-0">
                <span className="grid size-9 place-items-center rounded-sm bg-danfo font-display text-lg font-extrabold" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-4 text-xl">{title}</h3>
                <p className="mt-2 max-w-prose text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}
