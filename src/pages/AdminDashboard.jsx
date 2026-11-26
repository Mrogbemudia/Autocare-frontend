import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { formatNaira } from '../lib/format.js'
import { ErrorState, PageSpinner } from '../components/ui.jsx'

const STAGES = [
  ['inspection','Inspection'],['approval_pending','Approval pending'],['in_repair','In repair'],
  ['testing','Testing'],['ready_for_pickup','Ready for pickup'],['completed','Completed'],['cancelled','Cancelled'],
]

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border bg-card p-5 ${highlight ? 'border-signal border-l-4' : 'border-line'}`}>
      <p className="text-sm text-sub">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['admin','stats'],
    queryFn: api.admin.stats,
    refetchInterval: 30_000,
  })
  if (isPending) return <PageSpinner />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const shops = data?.shops ?? {}
  const partsShops = data?.parts_shops ?? {}
  const users = data?.users ?? {}
  const jobs = data?.jobs_by_stage ?? {}
  const partsOrders = data?.parts_orders ?? {}
  const revenue = data?.revenue ?? {}
  const pendingShops = data?.pending_shops ?? []
  const pendingPartsShops = data?.pending_parts_shops ?? []
  const maxJobs = Math.max(1,...STAGES.map(([key]) => jobs[key] ?? 0))

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Admin dashboard</h1>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Repair shops pending" value={shops.pending ?? 0} highlight={(shops.pending ?? 0) > 0} />
        <Stat label="Verified repair shops" value={shops.verified ?? 0} />
        <Stat label="Vehicle owners" value={users.owner ?? 0} />
        <Stat label="Technicians" value={users.shop ?? 0} />
        <Stat label="Parts vendors" value={(partsShops.verified ?? 0) + (partsShops.pending ?? 0)} />
        <Stat label="Active work orders" value={Object.entries(jobs).reduce((total,[key,count]) => key === 'completed' || key === 'cancelled' ? total : total + count,0)} />
        <Stat label="Paid revenue" value={formatNaira(revenue.paid_kobo ?? 0)} />
        <Stat label="Pending payouts" value={formatNaira(revenue.pending_payout_kobo ?? 0)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Repair shop statuses</h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {['pending','verified','rejected','suspended'].map((key) => (
              <li key={key} className="flex justify-between rounded bg-road px-3 py-2 capitalize">
                <span>{key}</span><strong>{shops[key] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Parts shop statuses</h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {['pending','verified','rejected','suspended'].map((key) => (
              <li key={key} className="flex justify-between rounded bg-road px-3 py-2 capitalize">
                <span>{key}</span><strong>{partsShops[key] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Work orders by stage</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {STAGES.map(([key,label]) => (
              <li key={key} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3">
                <span>{label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-signal" style={{ width: `${((jobs[key] ?? 0)/maxJobs)*100}%` }} />
                </span>
                <span className="text-right">{jobs[key] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Parts orders</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(partsOrders).map(([key,count]) => (
              <li key={key} className="flex justify-between rounded bg-road px-3 py-2">
                <span className="capitalize">{key.replace(/_/g,' ')}</span><strong>{count}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mt-6" aria-labelledby="pending-verifications">
        <div className="flex items-center justify-between gap-3 border-b border-line p-6">
          <h2 id="pending-verifications" className="text-lg font-semibold">Pending verification reviews</h2>
          <div className="flex gap-4">
            <Link to="/admin/shops" className="text-sm font-semibold underline underline-offset-4">Manage repair shops</Link>
            <Link to="/admin/parts-shops" className="text-sm font-semibold underline underline-offset-4">Manage parts vendors</Link>
            <Link to="/admin/interviews" className="text-sm font-semibold underline underline-offset-4">Interview queue</Link>
          </div>
        </div>
        {pendingShops.length === 0 && pendingPartsShops.length === 0 ? (
          <p className="p-6 text-sub">No providers are waiting for verification.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pendingShops.map((shop) => (
              <li key={`shop-${shop.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div><p className="font-semibold">{shop.business_name}</p><p className="text-sm text-sub">Repair shop · {shop.city_area}, {shop.state}</p></div>
                <Link to="/admin/shops" className="btn btn-secondary btn-sm">Review</Link>
              </li>
            ))}
            {pendingPartsShops.map((shop) => (
              <li key={`parts-${shop.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div><p className="font-semibold">{shop.business_name}</p><p className="text-sm text-sub">Parts shop · {shop.city_area}, {shop.state}</p></div>
                <Link to="/admin/parts-shops" className="btn btn-secondary btn-sm">Review parts vendor</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
