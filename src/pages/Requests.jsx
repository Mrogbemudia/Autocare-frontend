import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { urgencyLabel } from '../lib/constants.js'
import { formatDateTime, formatNaira } from '../lib/format.js'
import { EmptyState, ErrorState, FormError, PageSpinner, StatusBadge } from '../components/ui.jsx'
import RepairMediaGallery from '../components/RepairMediaGallery.jsx'

function earliestAppointmentTime() {
  const nextMinute = new Date(Date.now() + 60_000)
  return new Date(nextMinute.getTime() - nextMinute.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function QuoteCard({ quote }) {
  const queryClient = useQueryClient()
  const [proposedAt, setProposedAt] = useState('')
  const minAppointmentTime = earliestAppointmentTime()
  const accept = useMutation({
    mutationFn: () => {
      const date = new Date(proposedAt)
      if (!proposedAt || Number.isNaN(date.getTime())) throw new Error('Choose a valid appointment time.')
      if (date.getTime() <= Date.now()) throw new Error('Choose an appointment time in the future.')
      return api.quotes.accept(quote.id, date.toISOString())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })
  const reject = useMutation({
    mutationFn: () => api.quotes.reject(quote.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  })
  const active = quote.status === 'active'

  return (
    <article className="rounded-md border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Quote v{quote.version}</h3>
        <StatusBadge status={quote.status} />
      </div>
      {quote.items?.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {quote.items.map((item, index) => (
            <li key={`${quote.id}-${index}`} className="flex justify-between gap-3">
              <span>{item.description} × {item.quantity}</span>
              <span>{formatNaira(item.line_total_kobo)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3"><dt>Labour</dt><dd>{formatNaira(quote.labour_kobo)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Parts</dt><dd>{formatNaira(quote.items_total_kobo)}</dd></div>
        {quote.estimated_duration_hours && (
          <div className="flex justify-between gap-3"><dt>Estimated time</dt><dd>{quote.estimated_duration_hours} hours</dd></div>
        )}
        <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold">
          <dt>Total</dt><dd>{formatNaira(quote.total_kobo)}</dd>
        </div>
      </dl>
      {quote.notes && <p className="mt-3 text-sm text-ink-soft">{quote.notes}</p>}
      {active && (
        <div className="mt-4 space-y-3">
          <FormError>{accept.error?.fields?.proposed_at || accept.error?.message || reject.error?.message}</FormError>
          <label className="block space-y-1 text-sm font-semibold">
            Preferred appointment time
            <input
              type="datetime-local"
              className="input font-normal"
              value={proposedAt}
              min={minAppointmentTime}
              onChange={(event) => setProposedAt(event.target.value)}
            />
          </label>
          <p className="text-sm text-ink-soft">Accepting locks this quote. The shop confirms the appointment, then sends a repair plan for your approval before work starts.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={accept.isPending || reject.isPending} onClick={() => accept.mutate()}>
              {accept.isPending ? 'Accepting…' : 'Accept quote'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={accept.isPending || reject.isPending} onClick={() => reject.mutate()}>
              {reject.isPending ? 'Rejecting…' : 'Reject quote'}
            </button>
          </div>
        </div>
      )}
      {quote.rejection_reason && <p className="mt-3 text-sm text-ink-soft">Rejection note: {quote.rejection_reason}</p>}
    </article>
  )
}

function RepairPlanReview({ workOrder }) {
  const plan = workOrder.repair_plan
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const decision = useMutation({
    mutationFn: (status) => api.workOrders.reviewRepairPlan(plan.id, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })

  return (
    <article className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{workOrder.year} {workOrder.make} {workOrder.model}</h3>
          <p className="text-sm text-ink-soft">{workOrder.shop_name}</p>
        </div>
        <StatusBadge status={plan?.status ?? workOrder.status} />
      </div>
      {!plan ? (
        <p className="text-sm text-ink-soft">The shop is inspecting the vehicle. Its repair plan will appear here before work starts.</p>
      ) : (
        <>
          <dl className="space-y-2 text-sm">
            <div><dt className="font-semibold">Technician findings</dt><dd>{plan.technician_findings}</dd></div>
            <div><dt className="font-semibold">Parts plan</dt><dd>{plan.parts_plan}</dd></div>
            <div><dt className="font-semibold">Labour plan</dt><dd>{plan.labour_plan}</dd></div>
            {plan.notes && <div><dt className="font-semibold">Shop notes</dt><dd>{plan.notes}</dd></div>}
            {plan.review_note && <div><dt className="font-semibold">Your review note</dt><dd>{plan.review_note}</dd></div>}
          </dl>
          <RepairMediaGallery media={plan.media} label="Inspection media" />
          {plan.status === 'pending' && (
            <>
              <FormError>{decision.error?.message}</FormError>
              <label className="block space-y-1 text-sm font-semibold">
                Review note (optional)
                <textarea className="input font-normal" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={decision.isPending} onClick={() => decision.mutate('approved')}>
                  Approve repair plan
                </button>
                <button type="button" className="btn btn-secondary" disabled={decision.isPending} onClick={() => decision.mutate('rejected')}>
                  Request changes
                </button>
              </div>
            </>
          )}
        </>
      )}
    </article>
  )
}

export default function Requests() {
  const { data: requests, isPending, error, refetch } = useQuery({
    queryKey: ['requests'],
    queryFn: api.requests.list,
    refetchInterval: 30_000,
  })
  const jobs = useQuery({
    queryKey: ['work-orders'],
    queryFn: api.workOrders.list,
    refetchInterval: 30_000,
  })

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <section>
        <h1 className="text-3xl">My requests</h1>
        <div className="mt-6">
          {isPending ? <PageSpinner /> : error ? <ErrorState error={error} onRetry={refetch} /> : requests.length === 0 ? (
            <EmptyState title="No requests yet" action={<Link to="/shops" className="btn btn-primary">Find a shop</Link>}>
              Pick a shop and send your first request, including photos or a video if helpful.
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {requests.map((request) => (
                <li key={request.id} className="card space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{request.vehicle?.year} {request.vehicle?.make} {request.vehicle?.model}</p>
                      <p className="text-sm text-ink-soft">
                        To {request.shop?.business_name} · {urgencyLabel(request.urgency)} · Sent {formatDateTime(request.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <p>{request.symptoms}</p>
                  <RepairMediaGallery media={request.media} label="Issue media" />
                  {request.bookings?.map((booking) => (
                    <p key={booking.id} className="text-sm text-ink-soft">
                      Appointment {booking.status}: {formatDateTime(booking.proposed_at)}
                      {booking.decline_reason ? ` · ${booking.decline_reason}` : ''}
                    </p>
                  ))}
                  {request.quotes?.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="font-semibold">Shop quotations</h2>
                      {request.quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section>
        <h2 className="text-2xl">Repair plans</h2>
        <p className="mt-1 text-sm text-ink-soft">Review the shop’s inspection findings and planned parts and labour before repairs begin.</p>
        <div className="mt-4 space-y-3">
          {jobs.isPending ? <PageSpinner /> : jobs.error ? (
            <ErrorState error={jobs.error} onRetry={jobs.refetch} />
          ) : jobs.data.length === 0 ? (
            <EmptyState title="No booked repairs yet">
              A repair plan appears here after you accept a quote and the shop confirms the appointment.
            </EmptyState>
          ) : jobs.data.map((workOrder) => <RepairPlanReview key={workOrder.id} workOrder={workOrder} />)}
        </div>
      </section>
    </div>
  )
}
