import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { formatDateTime, formatNaira } from '../lib/format.js'
import { FormError, StatusBadge } from './ui.jsx'
import RepairMediaGallery from './RepairMediaGallery.jsx'
import { StartCallButton } from './CallCenter.jsx'

function QuoteForm({ request }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([{ description: '', quantity: '1', price: '' }])
  const [labour, setLabour] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const activeQuote = request.quotes?.find((quote) => quote.status === 'active')
  const send = useMutation({
    mutationFn: (quote) => api.requests.submitQuote(request.id, quote),
    onSuccess: () => {
      setOpen(false)
      setFormError('')
      queryClient.invalidateQueries({ queryKey: ['shop-requests'] })
    },
  })

  function submit(event) {
    event.preventDefault()
    const labourKobo = Math.round(Number(labour || 0) * 100)
    const quoteItems = items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPriceKobo: Math.round(Number(item.price) * 100),
    }))
    const estimatedDurationHours = duration ? Number(duration) : undefined
    if (!Number.isFinite(labourKobo) || labourKobo < 0
      || quoteItems.some((item) => item.description.length < 2
        || !Number.isInteger(item.quantity) || item.quantity < 1
        || !Number.isFinite(item.unitPriceKobo) || item.unitPriceKobo < 0)
      || (duration && (!Number.isInteger(estimatedDurationHours) || estimatedDurationHours < 1))) {
      setFormError('Enter valid descriptions, quantities, and non-negative prices for every line item.')
      return
    }
    if (quoteItems.length > 30) {
      setFormError('A quote can include no more than 30 line items.')
      return
    }
    setFormError('')
    send.mutate({
      items: quoteItems,
      labour_kobo: labourKobo,
      estimated_duration_hours: estimatedDurationHours,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-line p-4">
      {activeQuote && (
        <p className="text-sm text-ink-soft">
          Current quote v{activeQuote.version}: {formatNaira(activeQuote.total_kobo)} · awaiting owner response
        </p>
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((value) => !value)}>
        {open ? 'Close quote form' : activeQuote ? 'Revise quote' : 'Send a quote'}
      </button>
      {open && (
        <form className="space-y-4" onSubmit={submit}>
          <FormError>{formError || send.error?.message}</FormError>
          <div className="space-y-3">
            {items.map((item, index) => (
              <fieldset key={index} className="grid gap-3 rounded-md bg-road p-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto]">
                <legend className="px-1 text-sm font-semibold">Part or service {index + 1}</legend>
                <label className="space-y-1 text-sm">Description
                  <input className="input" value={item.description} onChange={(event) => {
                    const next = [...items]
                    next[index] = { ...item, description: event.target.value }
                    setItems(next)
                  }} required minLength={2} maxLength={200} />
                </label>
                <label className="space-y-1 text-sm">Quantity
                  <input className="input" type="number" min="1" max="1000" step="1" value={item.quantity} onChange={(event) => {
                    const next = [...items]
                    next[index] = { ...item, quantity: event.target.value }
                    setItems(next)
                  }} required />
                </label>
                <label className="space-y-1 text-sm">Unit price (NGN)
                  <input className="input" type="number" min="0" step="0.01" value={item.price} onChange={(event) => {
                    const next = [...items]
                    next[index] = { ...item, price: event.target.value }
                    setItems(next)
                  }} required />
                </label>
                {items.length > 1 && (
                  <button type="button" className="btn btn-secondary self-end" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                    Remove
                  </button>
                )}
              </fieldset>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={items.length >= 30} onClick={() => setItems([...items, { description: '', quantity: '1', price: '' }])}>
            Add line item
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold">Labour (NGN)
              <input className="input font-normal" type="number" min="0" step="0.01" value={labour} onChange={(event) => setLabour(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm font-semibold">Estimated hours (optional)
              <input className="input font-normal" type="number" min="1" max="2000" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-semibold">Notes (optional)
            <textarea className="input font-normal" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={send.isPending}>
            {send.isPending ? 'Sending…' : 'Send quotation'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ShopRequestCard({ request }) {
  const queryClient = useQueryClient()
  const [declineReason, setDeclineReason] = useState('Unable to attend at this time.')
  const bookingAction = useMutation({
    mutationFn: ({ bookingId, action }) => action === 'confirm'
      ? api.bookings.confirm(bookingId)
      : api.bookings.decline(bookingId, declineReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-requests'] })
      queryClient.invalidateQueries({ queryKey: ['shop-work-orders'] })
    },
  })
  const canQuote = ['open', 'quoted'].includes(request.status)

  return (
    <li className="card space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {request.vehicle?.year} {request.vehicle?.make} {request.vehicle?.model}
            {request.vehicle?.plate_number ? ` · ${request.vehicle.plate_number}` : ''}
          </p>
          <p className="text-sm text-ink-soft">
            From {request.owner_name || 'Vehicle owner'} · Received {formatDateTime(request.created_at)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <p>{request.symptoms}</p>
      <RepairMediaGallery media={request.media} label="Vehicle owner issue media" />
      <p className="text-sm text-ink-soft">
        {request.urgency === 'urgent' ? 'Urgent' : 'Standard'} ·{' '}
        {request.location_type === 'mobile' ? 'Mobile service' : 'At your shop'}
        {request.service_address ? ` · ${request.service_address}` : ''}
      </p>
      <StartCallButton
        recipientId={request.owner_id}
        context={{ serviceRequestId: request.id }}
        children="Call owner privately"
      />
      {request.bookings?.map((booking) => (
        <div key={booking.id} className="space-y-2 rounded-md border border-line p-3">
          <p className="text-sm">
            Appointment {booking.status}: {formatDateTime(booking.proposed_at)}
            {booking.decline_reason ? ` · ${booking.decline_reason}` : ''}
          </p>
          {booking.status === 'proposed' && (
            <>
              <FormError>{bookingAction.error?.message}</FormError>
              <label className="block space-y-1 text-sm">Reason if declining
                <input className="input" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} minLength={3} maxLength={500} />
              </label>
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled={bookingAction.isPending} onClick={() => bookingAction.mutate({ bookingId: booking.id, action: 'confirm' })}>Confirm time</button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={bookingAction.isPending || declineReason.trim().length < 3} onClick={() => bookingAction.mutate({ bookingId: booking.id, action: 'decline' })}>Decline time</button>
              </div>
            </>
          )}
        </div>
      ))}
      {canQuote && <QuoteForm request={request} />}
    </li>
  )
}
