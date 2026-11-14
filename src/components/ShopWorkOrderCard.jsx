import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { FormError, StatusBadge } from './ui.jsx'
import RepairMediaGallery from './RepairMediaGallery.jsx'

export default function ShopWorkOrderCard({ workOrder }) {
  const queryClient = useQueryClient()
  const [technicianFindings, setTechnicianFindings] = useState('')
  const [partsPlan, setPartsPlan] = useState('')
  const [labourPlan, setLabourPlan] = useState('')
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState([])
  const [video, setVideo] = useState(null)
  const [mediaError, setMediaError] = useState('')
  const plan = workOrder.repair_plan
  const submit = useMutation({
    mutationFn: () => {
      const body = new FormData()
      body.append('technicianFindings', technicianFindings)
      body.append('partsPlan', partsPlan)
      body.append('labourPlan', labourPlan)
      if (notes.trim()) body.append('notes', notes)
      images.forEach((image) => body.append('images', image))
      if (video) body.append('video', video)
      return api.workOrders.submitRepairPlan(workOrder.id, body)
    },
    onSuccess: () => {
      setTechnicianFindings('')
      setPartsPlan('')
      setLabourPlan('')
      setNotes('')
      setImages([])
      setVideo(null)
      queryClient.invalidateQueries({ queryKey: ['shop-work-orders'] })
      queryClient.invalidateQueries({ queryKey: ['shop-requests'] })
    },
  })

  const canSubmit = workOrder.status === 'inspection' && !['pending', 'approved'].includes(plan?.status)

  return (
    <article className="card space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{workOrder.year} {workOrder.make} {workOrder.model}</h3>
          <p className="text-sm text-ink-soft">
            {workOrder.owner_name} · {workOrder.plate_number || 'No plate provided'} · Updated {formatDateTime(workOrder.updated_at)}
          </p>
        </div>
        <StatusBadge status={workOrder.status} />
      </div>
      {plan && (
        <div className="space-y-3 rounded-md border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">Repair plan v{plan.version}</h4>
            <StatusBadge status={plan.status} />
          </div>
          <dl className="space-y-2 text-sm">
            <div><dt className="font-semibold">Technician findings</dt><dd>{plan.technician_findings}</dd></div>
            <div><dt className="font-semibold">Parts plan</dt><dd>{plan.parts_plan}</dd></div>
            <div><dt className="font-semibold">Labour plan</dt><dd>{plan.labour_plan}</dd></div>
            {plan.notes && <div><dt className="font-semibold">Notes</dt><dd>{plan.notes}</dd></div>}
            {plan.review_note && <div><dt className="font-semibold">Owner review note</dt><dd>{plan.review_note}</dd></div>}
          </dl>
          <RepairMediaGallery media={plan.media} label="Repair plan inspection media" />
        </div>
      )}
      {canSubmit && (
        <form className="space-y-3 border-t border-line pt-4" onSubmit={(event) => {
          event.preventDefault()
          if (!mediaError) submit.mutate()
        }}>
          <h4 className="text-lg font-semibold">{plan?.status === 'rejected' ? 'Revise repair plan' : 'Submit repair plan for owner approval'}</h4>
          <p className="text-sm text-ink-soft">The owner must approve your findings and parts/labour plan before the job can move into repair.</p>
          <FormError>{mediaError || submit.error?.message}</FormError>
          <label className="block space-y-1 text-sm font-semibold">Technician findings
            <textarea className="input font-normal" rows={3} minLength={10} maxLength={2000} required value={technicianFindings} onChange={(event) => setTechnicianFindings(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Parts plan
            <textarea className="input font-normal" rows={3} minLength={2} maxLength={2000} required value={partsPlan} onChange={(event) => setPartsPlan(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Labour plan
            <textarea className="input font-normal" rows={3} minLength={2} maxLength={2000} required value={labourPlan} onChange={(event) => setLabourPlan(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Notes (optional)
            <textarea className="input font-normal" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Inspection photos (optional)
            <span className="block text-xs font-normal text-ink-soft">JPEG, PNG, or WebP. Up to 5 photos, 10 MB each.</span>
            <input className="input font-normal" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
              const selected = Array.from(event.target.files ?? [])
              const invalid = selected.length > 5
                ? 'Attach no more than 5 photos.'
                : selected.some((file) => file.size > 10 * 1024 * 1024)
                  ? 'Each photo must be 10 MB or smaller.'
                  : ''
              setMediaError(invalid)
              setImages(invalid ? [] : selected)
            }} />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Inspection video (optional)
            <span className="block text-xs font-normal text-ink-soft">MP4, WebM, or MOV. One video, up to 50 MB.</span>
            <input className="input font-normal" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => {
              const selected = event.target.files?.[0] ?? null
              const invalid = selected && selected.size > 50 * 1024 * 1024
                ? 'The video must be 50 MB or smaller.'
                : ''
              setMediaError(invalid)
              setVideo(invalid ? null : selected)
            }} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={submit.isPending || Boolean(mediaError)}>
            {submit.isPending ? 'Submitting…' : 'Send plan for approval'}
          </button>
        </form>
      )}
    </article>
  )
}
