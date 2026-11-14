import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { serviceLabel } from '../lib/constants.js'
import { EmptyState, ErrorState, PageSpinner, StatusBadge } from '../components/ui.jsx'
import ShopRequestCard from '../components/ShopRequestCard.jsx'
import ShopWorkOrderCard from '../components/ShopWorkOrderCard.jsx'

const MESSAGES = {
  pending: 'Your shop is awaiting verification. An admin will review your details. Until then, owners cannot see your shop.',
  verified: 'Your shop is verified and visible to owners. Incoming requests will appear here.',
  rejected: 'Your shop was not approved.',
  suspended: 'Your shop is suspended and hidden from owners.',
}

export default function ShopDashboard() {
  const { data: shop, isPending, error, refetch } = useQuery({
    queryKey: ['shop', 'mine'],
    queryFn: api.shops.mine,
  })
  const requestsQuery = useQuery({
    queryKey: ['shop-requests', shop?.id],
    queryFn: api.requests.list,
    enabled: Boolean(shop?.id),
    refetchInterval: 30_000,
  })
  const jobsQuery = useQuery({
    queryKey: ['shop-work-orders', shop?.id],
    queryFn: api.workOrders.list,
    enabled: Boolean(shop?.id),
    refetchInterval: 30_000,
  })

  if (isPending) return <PageSpinner />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const requests = requestsQuery.data ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl">{shop.business_name}</h1>
      <section className="card mt-6 p-5" aria-labelledby="status-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="status-heading" className="text-xl">Verification status</h2>
          <StatusBadge status={shop.verification_status} />
        </div>
        <p className="mt-2 max-w-prose">{MESSAGES[shop.verification_status]}</p>
        {shop.verification_note && (
          <p className="mt-3 rounded-md bg-road p-3 text-sm"><strong>Note from the admin:</strong> {shop.verification_note}</p>
        )}
      </section>
      {shop.services?.length > 0 && (
        <p className="mt-6 text-ink-soft">Services: {shop.services.map(serviceLabel).join(', ')}</p>
      )}
      <section className="mt-8" aria-labelledby="requests-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="requests-heading" className="text-2xl">Incoming repair requests</h2>
            <p className="mt-1 text-sm text-ink-soft">New requests refresh automatically every 30 seconds.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => requestsQuery.refetch()}
            disabled={requestsQuery.isFetching}
          >
            {requestsQuery.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="mt-4">
          {requestsQuery.isPending ? <PageSpinner /> : requestsQuery.error ? (
            <ErrorState error={requestsQuery.error} onRetry={requestsQuery.refetch} />
          ) : requests.length === 0 ? (
            <EmptyState title="No repair requests yet">
              Requests that vehicle owners send to your shop will appear here.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {requests.map((request) => <ShopRequestCard key={request.id} request={request} />)}
            </ul>
          )}
        </div>
      </section>
      <section className="mt-10" aria-labelledby="jobs-heading">
        <h2 id="jobs-heading" className="text-2xl">Booked repairs and plans</h2>
        <p className="mt-1 text-sm text-ink-soft">Submit inspection findings and a repair plan for the owner to approve before work begins.</p>
        <div className="mt-4 space-y-3">
          {jobsQuery.isPending ? <PageSpinner /> : jobsQuery.error ? (
            <ErrorState error={jobsQuery.error} onRetry={jobsQuery.refetch} />
          ) : !jobsQuery.data?.length ? (
            <EmptyState title="No booked repairs yet">
              After an owner accepts a quote and you confirm the appointment, the job appears here.
            </EmptyState>
          ) : jobsQuery.data.map((workOrder) => <ShopWorkOrderCard key={workOrder.id} workOrder={workOrder} />)}
        </div>
      </section>
    </div>
  )
}
