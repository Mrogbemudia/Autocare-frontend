import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { EmptyState, ErrorState, FormError, PageSpinner } from '../components/ui.jsx'

const TABS = [
  ['pending', 'Pending'],
  ['verified', 'Verified'],
  ['rejected', 'Rejected'],
  ['suspended', 'Suspended'],
]

function ReviewCard({ shop }) {
  const queryClient = useQueryClient()
  const [action, setAction] = useState('')
  const [note, setNote] = useState('')
  const review = useMutation({
    mutationFn: (status) => api.admin.reviewPartsShop(shop.id, { status, note: note.trim() || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-parts-shops'] }),
  })

  return (
    <li className="card space-y-4 p-5">
      <div>
        <h2 className="text-xl">{shop.business_name}</h2>
        <p className="text-sm text-ink-soft">{shop.owner_name} · {shop.email}</p>
        <p className="text-sm text-ink-soft">{shop.city_area}, {shop.state} · Registered {formatDateTime(shop.created_at)}</p>
      </div>
      <p className="text-sm">{shop.address}</p>
      {shop.description && <p className="text-sm text-ink-soft">{shop.description}</p>}
      <section>
        <h3 className="font-semibold">Verification documents</h3>
        {shop.documents.length === 0 ? <p className="mt-1 text-sm text-ink-soft">No documents submitted.</p> : (
          <ul className="mt-2 space-y-2">
            {shop.documents.map((document) => (
              <li key={document.id} className="rounded bg-road p-3 text-sm">
                <p className="font-semibold">{document.label || document.doc_type.replace(/_/g, ' ')}</p>
                {document.reference_number && <p>Reference: {document.reference_number}</p>}
                <p className="text-ink-soft">Submitted {formatDateTime(document.created_at)} · {document.status}</p>
                {document.url && <a className="mt-1 inline-block font-semibold underline" href={document.url} target="_blank" rel="noreferrer">Open document</a>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {shop.verification_note && <p className="text-sm"><strong>Previous review note:</strong> {shop.verification_note}</p>}
      <FormError>{review.error?.message}</FormError>
      {action ? (
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Review note
            <textarea className="input mt-1.5 font-normal" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-danger btn-sm" disabled={review.isPending} onClick={() => review.mutate(action)}>
              {review.isPending ? 'Saving…' : action === 'rejected' ? 'Reject vendor' : 'Suspend vendor'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction('')}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {shop.verification_status !== 'verified' && (
            <button type="button" className="btn btn-primary btn-sm" disabled={review.isPending} onClick={() => review.mutate('verified')}>Approve vendor</button>
          )}
          {shop.verification_status === 'pending' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction('rejected')}>Reject</button>}
          {shop.verification_status === 'verified' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction('suspended')}>Suspend</button>}
        </div>
      )}
    </li>
  )
}

export default function AdminPartsShops() {
  const [status, setStatus] = useState('pending')
  const result = useQuery({
    queryKey: ['admin-parts-shops', status],
    queryFn: () => api.admin.partsShops({ status }),
  })
  const shops = result.data?.data ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl">Verify parts vendors</h1>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by verification status">
        {TABS.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`btn btn-sm ${status === value ? 'btn-primary' : 'btn-secondary'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {result.isPending ? <PageSpinner /> : result.error ? <ErrorState error={result.error} onRetry={result.refetch} /> : shops.length === 0 ? (
          <EmptyState title={`No ${status} parts vendors`} />
        ) : <ul className="space-y-4">{shops.map((shop) => <ReviewCard key={shop.id} shop={shop} />)}</ul>}
      </div>
    </div>
  )
}
