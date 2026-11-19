import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { applyFieldErrors } from '../lib/forms.js'
import { LOCATION_OPTIONS, URGENCY_OPTIONS } from '../lib/constants.js'
import { requestSchema } from '../lib/schemas.js'
import { EmptyState, ErrorState, Field, FormError, PageSpinner } from '../components/ui.jsx'

export default function RequestNew() {
  const [params] = useSearchParams()
  const shopId = params.get('shop')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [images, setImages] = useState([])
  const [video, setVideo] = useState(null)
  const [mediaError, setMediaError] = useState('')

  const shopQuery = useQuery({ queryKey: ['shop', shopId], queryFn: () => api.shops.get(shopId), enabled: !!shopId })
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: api.vehicles.list })

  const { register, handleSubmit, setError, control, formState: { errors } } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { vehicle_id: '', symptoms: '', urgency: 'standard', location_type: 'shop', service_address: '' },
  })
  const locationType = useWatch({ control, name: 'location_type' })
  const send = useMutation({
    mutationFn: (values) => {
      const body = new FormData()
      body.append('vehicleId', values.vehicle_id)
      body.append('shopId', shopId)
      body.append('symptoms', values.symptoms)
      body.append('urgency', values.urgency)
      body.append('locationType', values.location_type === 'shop' ? 'visit_shop' : values.location_type)
      if (values.service_address) body.append('serviceAddress', values.service_address)
      images.forEach((image) => body.append('images', image))
      if (video) body.append('video', video)
      return api.requests.create(body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      navigate('/requests')
    },
    onError: (err) => applyFieldErrors(err, setError),
  })

  if (!shopId) {
    return (
      <div className="px-4 py-16">
        <EmptyState title="Choose a shop first" action={<Link to="/shops" className="btn btn-primary">Browse shops</Link>}>
          Requests go to one shop. Open a shop and choose Request a quote.
        </EmptyState>
      </div>
    )
  }
  if (shopQuery.isPending || vehiclesQuery.isPending) return <PageSpinner />
  const loadError = shopQuery.error ?? vehiclesQuery.error
  if (loadError) return <ErrorState error={loadError} onRetry={() => { shopQuery.refetch(); vehiclesQuery.refetch() }} />

  const vehicles = vehiclesQuery.data
  if (vehicles.length === 0) {
    return (
      <div className="px-4 py-16">
        <EmptyState title="Add a vehicle first" action={<Link to="/garage" className="btn btn-primary">Go to my garage</Link>}>
          Tell us which vehicle needs work so the shop can quote accurately.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl">Request a quote</h1>
      <p className="mt-1 text-ink-soft">Sending to <strong className="text-ink">{shopQuery.data.business_name}</strong>, {shopQuery.data.city_area}</p>

      <form
        onSubmit={handleSubmit((values) => {
          if (mediaError) return
          send.mutate(values)
        })}
        noValidate
        className="card mt-6 space-y-4 p-6"
      >
        <FormError>{mediaError || send.error?.message}</FormError>
        <Field label="Vehicle" error={errors.vehicle_id?.message}>
          <select {...register('vehicle_id')}>
            <option value="">Choose a vehicle</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}{v.plate_number ? `, ${v.plate_number}` : ''}</option>)}
          </select>
        </Field>
        <Field label="What is wrong?" hint="Describe the symptoms: noises, warning lights, when it happens." error={errors.symptoms?.message}>
          <textarea rows={5} {...register('symptoms')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Urgency" error={errors.urgency?.message}>
            <select {...register('urgency')}>{URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </Field>
          <Field label="Where should the work happen?" error={errors.location_type?.message}>
            <select {...register('location_type')}>{LOCATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </Field>
        </div>
        {locationType === 'mobile' && (
          <Field label="Your address" error={errors.service_address?.message}>
            <input autoComplete="street-address" {...register('service_address')} />
          </Field>
        )}
        <Field label="Photos (optional)" hint="JPEG, PNG, or WebP. Up to 5 photos, 10 MB each.">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? [])
              const invalid = selected.length > 5
                ? 'Attach no more than 5 photos.'
                : selected.some((file) => file.size > 10 * 1024 * 1024)
                  ? 'Each photo must be 10 MB or smaller.'
                  : ''
              setMediaError(invalid)
              setImages(invalid ? [] : selected)
            }}
          />
        </Field>
        {images.length > 0 && <p className="text-sm text-ink-soft">{images.map((image) => image.name).join(', ')}</p>}
        <Field label="Video (optional)" hint="MP4, WebM, or MOV. One video, up to 50 MB.">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null
              const invalid = selected && selected.size > 50 * 1024 * 1024
                ? 'The video must be 50 MB or smaller.'
                : ''
              setMediaError(invalid)
              setVideo(invalid ? null : selected)
            }}
          />
        </Field>
        {video && <p className="text-sm text-ink-soft">{video.name}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={send.isPending || Boolean(mediaError)}>{send.isPending ? 'Sending…' : 'Send request'}</button>
      </form>
    </div>
  )
}
