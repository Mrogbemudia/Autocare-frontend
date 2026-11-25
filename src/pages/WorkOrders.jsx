import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { useMe } from '../lib/auth.js'
import { formatDateTime, formatNaira } from '../lib/format.js'
import { EmptyState, ErrorState, FormError, PageSpinner, StatusBadge } from '../components/ui.jsx'

const STATUS_OPTIONS = {
  inspection: ['in_repair', 'cancelled'],
  approval_pending: ['in_repair', 'cancelled'],
  in_repair: ['testing'],
  testing: ['ready_for_pickup'],
  ready_for_pickup: ['completed'],
}

export default function WorkOrders() {
  const { workOrderId } = useParams()
  const { data: user } = useMe()
  return workOrderId
    ? <WorkOrderDetail workOrderId={workOrderId} role={user?.role} />
    : <WorkOrderList role={user?.role} />
}

function WorkOrderList({ role }) {
  const { data: workOrders, isPending, error, refetch } = useQuery({
    queryKey: ['work-orders'],
    queryFn: api.workOrders.list,
    refetchInterval: 30_000,
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl">Work orders</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {role === 'shop' ? 'Track approved jobs and update repair progress.' : 'Track repairs and approve any extra work.'}
      </p>
      <div className="mt-6">
        {isPending ? <PageSpinner /> : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !workOrders?.length ? (
          <EmptyState title="No work orders yet">
            Work orders appear after a shop confirms an appointment.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {workOrders.map((workOrder) => (
              <li key={workOrder.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{workOrder.year} {workOrder.make} {workOrder.model}</h2>
                    <p className="text-sm text-ink-soft">{workOrder.shop_name}</p>
                  </div>
                  <StatusBadge status={workOrder.status} />
                </div>
                <p className="mt-3 font-semibold">{formatNaira(workOrder.final_cost_kobo)}</p>
                <Link to={`/work-orders/${workOrder.id}`} className="btn btn-secondary btn-sm mt-4">
                  Open work order
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function WorkOrderDetail({ workOrderId, role }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('')
  const [extraCost, setExtraCost] = useState('')
  const detail = useQuery({
    queryKey: ['work-order', workOrderId],
    queryFn: () => api.workOrders.get(workOrderId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] })
    queryClient.invalidateQueries({ queryKey: ['work-orders'] })
  }
  const statusMutation = useMutation({
    mutationFn: () => api.workOrders.changeStatus(workOrderId, { status, note: note || undefined }),
    onSuccess: invalidate,
  })
  const extraMutation = useMutation({
    mutationFn: () => api.workOrders.raiseExtraWork(workOrderId, {
      description,
      reason,
      extra_cost_kobo: Number(extraCost),
    }),
    onSuccess: () => {
      setDescription('')
      setReason('')
      setExtraCost('')
      invalidate()
    },
  })
  const decisionMutation = useMutation({
    mutationFn: ({ extraId, decision }) => decision === 'approved'
      ? api.workOrders.approveExtraWork(extraId, note)
      : api.workOrders.declineExtraWork(extraId, note),
    onSuccess: invalidate,
  })

  if (detail.isPending) return <PageSpinner />
  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.refetch} />

  const workOrder = detail.data
  const availableStatuses = role === 'shop' ? STATUS_OPTIONS[workOrder.status] ?? [] : []
  const extras = workOrder.extra_work ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/work-orders" className="text-sm font-semibold underline underline-offset-4">Back to work orders</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{workOrder.year} {workOrder.make} {workOrder.model}</h1>
          <p className="mt-1 text-ink-soft">{workOrder.shop_name} · Updated {formatDateTime(workOrder.updated_at)}</p>
        </div>
        <StatusBadge status={workOrder.status} />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="text-xl">Cost summary</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt>Locked quote</dt><dd>{formatNaira(workOrder.quoted_total_kobo)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Approved extras</dt><dd>{formatNaira(workOrder.approved_extras_kobo)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold sm:col-span-2">
            <dt>Final cost</dt><dd>{formatNaira(workOrder.final_cost_kobo)}</dd>
          </div>
        </dl>
      </section>

      {role === 'shop' && (
        <section className="card mt-6 space-y-4 p-5">
          <h2 className="text-xl">Update job</h2>
          {availableStatuses.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <label className="block space-y-1 text-sm font-semibold">
                New status
                <select className="input font-normal" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Choose a status</option>
                  {availableStatuses.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                Note (optional)
                <input className="input font-normal" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">No further status changes are available in the current stage.</p>
          )}
          <FormError>{statusMutation.error?.message}</FormError>
          {status && (
            <button type="button" className="btn btn-primary" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate()}>
              {statusMutation.isPending ? 'Updating…' : 'Update status'}
            </button>
          )}
        </section>
      )}

      {role === 'shop' && ['inspection', 'in_repair'].includes(workOrder.status) && (
        <section className="card mt-6 space-y-3 p-5">
          <h2 className="text-xl">Request extra work</h2>
          <FormError>{extraMutation.error?.message}</FormError>
          <label className="block space-y-1 text-sm font-semibold">Description
            <textarea className="input font-normal" rows={3} minLength={5} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Reason
            <textarea className="input font-normal" rows={2} minLength={5} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Extra cost (kobo)
            <input className="input font-normal" type="number" min="1" step="1" value={extraCost} onChange={(event) => setExtraCost(event.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={extraMutation.isPending || description.length < 5 || reason.length < 5 || !/^\d+$/.test(extraCost) || Number(extraCost) <= 0}
            onClick={() => extraMutation.mutate()}
          >
            {extraMutation.isPending ? 'Submitting…' : 'Request approval'}
          </button>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xl">Extra work</h2>
        {extras.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No extra-work requests.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {extras.map((extra) => (
              <li key={extra.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{extra.description}</h3>
                    <p className="text-sm text-ink-soft">{extra.reason}</p>
                  </div>
                  <StatusBadge status={extra.status} />
                </div>
                <p className="font-semibold">{formatNaira(extra.extra_cost_kobo)}</p>
                {extra.decision_note && <p className="text-sm text-ink-soft">Decision note: {extra.decision_note}</p>}
                {role === 'owner' && extra.status === 'pending' && (
                  <>
                    <FormError>{decisionMutation.error?.message}</FormError>
                    <label className="block space-y-1 text-sm font-semibold">Decision note (optional)
                      <textarea className="input font-normal" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" disabled={decisionMutation.isPending}
                        onClick={() => decisionMutation.mutate({ extraId: extra.id, decision: 'approved' })}>
                        Approve
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={decisionMutation.isPending}
                        onClick={() => decisionMutation.mutate({ extraId: extra.id, decision: 'declined' })}>
                        Decline
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {workOrder.history?.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl">Status history</h2>
          <ol className="mt-3 space-y-2">
            {workOrder.history.map((entry) => (
              <li key={entry.id} className="rounded-md border border-line p-3 text-sm">
                <span className="font-semibold">{entry.from_status.replace(/_/g, ' ')} → {entry.to_status.replace(/_/g, ' ')}</span>
                <span className="ml-2 text-ink-soft">{formatDateTime(entry.created_at)}</span>
                {entry.note && <p className="mt-1 text-ink-soft">{entry.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
