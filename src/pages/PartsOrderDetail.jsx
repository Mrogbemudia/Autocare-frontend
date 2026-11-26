import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { formatDateTime, formatNaira } from '../lib/format.js'
import { ErrorState, PageSpinner, StatusBadge } from '../components/ui.jsx'
import { StartCallButton } from '../components/CallCenter.jsx'

export default function PartsOrderDetail() {
  const { orderId } = useParams()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const verifiedReference = useRef('')
  const order = useQuery({
    queryKey: ['parts', 'order', orderId],
    queryFn: () => api.parts.order(orderId),
    refetchInterval: 15_000,
  })
  const verify = useMutation({
    mutationFn: api.parts.verifyPaystack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', 'order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['parts', 'orders'] })
    },
  })
  const reference = params.get('reference') || params.get('trxref')

  useEffect(() => {
    if (reference && verifiedReference.current !== reference) {
      verifiedReference.current = reference
      verify.mutate(reference)
    }
  }, [reference, verify])

  if (order.isPending) return <PageSpinner />
  if (order.error) return <ErrorState error={order.error} onRetry={order.refetch} />

  const data = order.data
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link to="/parts" className="text-sm font-semibold underline underline-offset-4">Back to parts</Link>
      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl">Order #{data.id.slice(0, 8)}</h1>
            <p className="text-sm text-ink-soft">{data.business_name} · {data.fulfilment_type}</p>
          </div>
          <StatusBadge status={data.status} />
        </div>
        <p className="font-semibold">{formatNaira(data.total_kobo)}</p>
        {reference && (
          <p role={verify.error ? 'alert' : 'status'} className="text-sm text-ink-soft">
            {verify.isPending ? 'Confirming Paystack payment…' : verify.error?.message || 'Payment confirmed.'}
          </p>
        )}
        <StartCallButton recipientId={data.parts_shop_user_id} context={{ partsOrderId: data.id }} />
      </section>

      <section className="card p-5">
        <h2 className="text-xl">Items</h2>
        <ul className="mt-3 space-y-2">
          {data.items.map((item) => (
            <li key={item.part_id} className="flex justify-between gap-3 text-sm">
              <span>{item.name} × {item.qty}</span>
              <span>{formatNaira(Number(item.unit_price) * item.qty)}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.delivery && (
        <section className="card p-5">
          <h2 className="text-xl">Delivery details</h2>
          <p className="mt-2 text-sm">{data.delivery.address}</p>
          {data.delivery.courier_name && <p className="mt-1 text-sm">{data.delivery.courier_name}</p>}
          {data.delivery.last_latitude != null && data.delivery.last_longitude != null && (
            <div className="mt-2">
              <a
                className="text-sm font-semibold underline"
                href={`https://www.google.com/maps/search/?api=1&query=${data.delivery.last_latitude},${data.delivery.last_longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                View latest delivery location
              </a>
              {data.delivery.last_position_at && <p className="mt-1 text-xs text-ink-soft">Updated {formatDateTime(data.delivery.last_position_at)}</p>}
            </div>
          )}
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-xl">Order tracking</h2>
        {data.events?.length ? (
          <ol className="mt-3 space-y-3">
            {data.events.map((event) => (
              <li key={event.id} className="border-l-2 border-line pl-3">
                <StatusBadge status={event.status} />
                <p className="mt-1 text-sm">{event.note || event.status.replace(/_/g, ' ')}</p>
                <time className="text-xs text-ink-soft">{formatDateTime(event.created_at)}</time>
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-sm text-ink-soft">No tracking updates yet.</p>}
      </section>
    </div>
  )
}
