import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

const STAGES = [
  ['inspection', 'Inspection'], ['approval_pending', 'Approval pending'], ['in_repair', 'In repair'],
  ['testing', 'Testing'], ['ready_for_pickup', 'Ready for pickup'], ['completed', 'Completed'],
];
const SHOP_STATUS = [
  ['verified', 'Verified', 'bg-ok'], ['pending', 'Pending', 'bg-signal'],
  ['rejected', 'Rejected', 'bg-red-600'], ['suspended', 'Suspended', 'bg-sub'],
];

// Only shown when the API call fails, so you can check the layout. Clearly labelled in the UI.
const SAMPLE = {
  shops: { verified: 12, pending: 3, rejected: 1, suspended: 0 },
  users: { owners: 48, shops: 16 },
  jobsByStage: { inspection: 2, approval_pending: 1, in_repair: 4, testing: 1, ready_for_pickup: 1, completed: 9 },
  pendingShops: [
    { id: 'sample-1', business_name: 'Sample Auto Works', state: 'Lagos', city_area: 'Ikeja', created_at: new Date().toISOString() },
  ],
};

// Expected: GET /api/admin/stats -> { data: { shops, users, jobsByStage, pendingShops } } (admin only).
const sum = (o = {}) => Object.values(o).reduce((a, b) => a + b, 0);

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border bg-card p-5 ${highlight ? 'border-signal border-l-4' : 'border-line'}`}>
      <p className="text-sm text-sub">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'stats'], queryFn: api.admin.stats, refetchInterval: 30_000, retry: 1,
  });
  const usingSample = isError;
  const d = usingSample ? SAMPLE : data;

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10" aria-busy="true">
        <div className="h-8 w-56 animate-pulse rounded bg-line" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-line" />)}
        </div>
      </div>
    );
  }

  const shopTotal = sum(d.shops) || 1;
  const maxJobs = Math.max(1, ...STAGES.map(([k]) => d.jobsByStage?.[k] ?? 0));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">Admin dashboard</h1>
        {usingSample && <span className="rounded-full bg-signal px-3 py-1 text-xs font-bold text-asphalt">Sample data</span>}
      </div>

      {usingSample && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card p-4 text-sm">
          <p>Could not load live numbers ({error.message}). These figures are samples so you can check the layout.</p>
          <button type="button" onClick={() => refetch()} disabled={isFetching}
            className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-page disabled:opacity-60">
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Shops waiting for review" value={d.shops.pending} highlight={d.shops.pending > 0} />
        <Stat label="Verified shops" value={d.shops.verified} />
        <Stat label="Vehicle owners" value={d.users.owners} />
        <Stat label="Jobs in progress" value={sum(d.jobsByStage) - (d.jobsByStage?.completed ?? 0)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-card p-6" aria-labelledby="shop-status">
          <h2 id="shop-status" className="font-display text-lg font-semibold">Shops by status</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
            {SHOP_STATUS.map(([k, , color]) => (
              <div key={k} className={color} style={{ width: `${((d.shops[k] ?? 0) / shopTotal) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {SHOP_STATUS.map(([k, label, color]) => (
              <li key={k} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />
                {label} <span className="ml-auto tabular-nums text-sub">{d.shops[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-card p-6" aria-labelledby="jobs-stage">
          <h2 id="jobs-stage" className="font-display text-lg font-semibold">Jobs by stage</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {STAGES.map(([k, label]) => {
              const n = d.jobsByStage?.[k] ?? 0;
              return (
                <li key={k} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3">
                  <span>{label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <span className="block h-full rounded-full bg-signal transition-[width] duration-700" style={{ width: `${(n / maxJobs) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-sub">{n}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-card" aria-labelledby="pending-queue">
        <div className="flex items-center justify-between gap-3 border-b border-line p-6">
          <h2 id="pending-queue" className="font-display text-lg font-semibold">Waiting for verification</h2>
          <Link to="/admin/shops" className="text-sm font-semibold underline underline-offset-4">Open shop verification</Link>
        </div>
        {d.pendingShops?.length ? (
          <ul className="divide-y divide-line">
            {d.pendingShops.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="font-semibold">{s.business_name}</p>
                  <p className="text-sm text-sub">
                    {s.city_area}, {s.state} · registered {new Date(s.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <Link to="/admin/shops" className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-asphalt hover:brightness-95">Review</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sub">No shops are waiting. New registrations will appear here.</p>
        )}
      </section>
    </div>
  );
}
