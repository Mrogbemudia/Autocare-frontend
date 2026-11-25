import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { EmptyState, ErrorState, FormError, PageSpinner, StatusBadge } from '../components/ui.jsx'

export default function ClientDashboard() {
  const qc = useQueryClient()
  const maintenance = useQuery({queryKey:['maintenance'],queryFn:api.maintenance.get})
  const insuranceProducts = useQuery({queryKey:['insurance','products'],queryFn:api.insurance.products})
  const insuranceRequests = useQuery({queryKey:['insurance','requests'],queryFn:api.insurance.list})
  const [vehicleId,setVehicleId]=useState('')
  const [templateId,setTemplateId]=useState('')
  const [intervalKm,setIntervalKm]=useState('')
  const [intervalMonths,setIntervalMonths]=useState('')
  const [leadDays,setLeadDays]=useState('14')
  const [leadKm,setLeadKm]=useState('500')
  const [docLeadDays,setDocLeadDays]=useState('30')
  const [productId,setProductId]=useState('')
  const [ownerNote,setOwnerNote]=useState('')
  const [insuranceVehicle,setInsuranceVehicle]=useState('')

  const rule = useMutation({
    mutationFn:()=>api.maintenance.setRule({vehicleId,templateId:Number(templateId),intervalKm:intervalKm?Number(intervalKm):undefined,intervalMonths:intervalMonths?Number(intervalMonths):undefined}),
    onSuccess:()=>qc.invalidateQueries({queryKey:['maintenance']}),
  })
  const reminders=useMutation({
    mutationFn:()=>api.maintenance.setReminders({maintenanceLeadDays:Number(leadDays),maintenanceLeadKm:Number(leadKm),documentLeadDays:Number(docLeadDays),inAppEnabled:true}),
  })
  const apply=useMutation({
    mutationFn:()=>api.insurance.apply({vehicleId:insuranceVehicle,productId,ownerNote}),
    onSuccess:()=>qc.invalidateQueries({queryKey:['insurance','requests']}),
  })

  if (maintenance.isPending) return <PageSpinner />
  if (maintenance.error) return <ErrorState error={maintenance.error} onRetry={maintenance.refetch} />
  const data=maintenance.data

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <h1 className="text-3xl">Maintenance and insurance</h1>
      <section className="card p-5">
        <h2 className="text-xl">Maintenance reminders</h2>
        {data.vehicles.length===0?<p className="mt-3 text-sm text-ink-soft">Add a vehicle in your garage before configuring maintenance.</p>:(
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Vehicle<select className="input mt-1.5 font-normal" value={vehicleId} onChange={(e)=>setVehicleId(e.target.value)}><option value="">Choose vehicle</option>{data.vehicles.map((v)=><option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}</select></label>
            <label className="text-sm font-semibold">Maintenance type<select className="input mt-1.5 font-normal" value={templateId} onChange={(e)=>setTemplateId(e.target.value)}><option value="">Choose type</option>{data.templates.map((t)=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <label className="text-sm font-semibold">Every kilometres (optional)<input className="input mt-1.5 font-normal" type="number" min="1" value={intervalKm} onChange={(e)=>setIntervalKm(e.target.value)} /></label>
            <label className="text-sm font-semibold">Every months (optional)<input className="input mt-1.5 font-normal" type="number" min="1" value={intervalMonths} onChange={(e)=>setIntervalMonths(e.target.value)} /></label>
          </div>
        )}
        <FormError>{rule.error?.message}</FormError>
        <button type="button" className="btn btn-primary mt-4" disabled={rule.isPending||!vehicleId||!templateId||(!intervalKm&&!intervalMonths)} onClick={()=>rule.mutate()}>{rule.isPending?'Saving…':'Save maintenance rule'}</button>
        <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
          <label className="text-sm font-semibold">Maintenance days before<input className="input mt-1.5 font-normal" type="number" min="0" max="120" value={leadDays} onChange={(e)=>setLeadDays(e.target.value)} /></label>
          <label className="text-sm font-semibold">Kilometres before<input className="input mt-1.5 font-normal" type="number" min="0" value={leadKm} onChange={(e)=>setLeadKm(e.target.value)} /></label>
          <label className="text-sm font-semibold">Document days before<input className="input mt-1.5 font-normal" type="number" min="0" max="180" value={docLeadDays} onChange={(e)=>setDocLeadDays(e.target.value)} /></label>
        </div>
        <button type="button" className="btn btn-secondary mt-4" disabled={reminders.isPending} onClick={()=>reminders.mutate()}>{reminders.isPending?'Saving…':'Save reminder settings'}</button>
        {data.upcoming.length>0&&<div className="mt-5"><h3 className="font-semibold">Configured schedules</h3><ul className="mt-2 space-y-2">{data.upcoming.map((item)=><li key={`${item.vehicle_id}-${item.template_id}`} className="rounded bg-road p-3 text-sm"><strong>{item.make} {item.model}</strong> · {item.label} · every {item.interval_km?`${item.interval_km} km`:''}{item.interval_km&&item.interval_months?' or ':''}{item.interval_months?`${item.interval_months} months`:''}</li>)}</ul></div>}
      </section>

      <section className="card p-5">
        <h2 className="text-xl">Insurance applications</h2>
        {insuranceProducts.isPending?<PageSpinner/>:insuranceProducts.error?<ErrorState error={insuranceProducts.error} onRetry={insuranceProducts.refetch}/>:(
          <>
            {data.vehicles.length>0&&insuranceProducts.data?.length>0?(
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">Vehicle<select className="input mt-1.5 font-normal" value={insuranceVehicle} onChange={(e)=>setInsuranceVehicle(e.target.value)}><option value="">Choose vehicle</option>{data.vehicles.map((v)=><option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}</select></label>
                <label className="text-sm font-semibold">Insurance product<select className="input mt-1.5 font-normal" value={productId} onChange={(e)=>setProductId(e.target.value)}><option value="">Choose product</option>{insuranceProducts.data.map((p)=><option key={p.id} value={p.id}>{p.insurer_name} · {p.name}</option>)}</select></label>
                <label className="text-sm font-semibold sm:col-span-2">Note<textarea className="input mt-1.5 font-normal" rows="3" value={ownerNote} onChange={(e)=>setOwnerNote(e.target.value)} /></label>
              </div>
            ):<EmptyState title="Insurance products or vehicles unavailable"/>}
            <FormError>{apply.error?.message}</FormError>
            {data.vehicles.length>0&&insuranceProducts.data?.length>0&&<button type="button" className="btn btn-primary mt-4" disabled={apply.isPending||!insuranceVehicle||!productId} onClick={()=>apply.mutate()}>{apply.isPending?'Submitting…':'Apply for insurance'}</button>}
          </>
        )}
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-semibold">My applications</h3>
          {insuranceRequests.isPending?<PageSpinner/>:insuranceRequests.error?<ErrorState error={insuranceRequests.error} onRetry={insuranceRequests.refetch}/>:insuranceRequests.data?.length===0?<p className="mt-2 text-sm text-ink-soft">No applications yet.</p>:(
            <ul className="mt-3 space-y-2">{insuranceRequests.data.map((item)=><li key={item.id} className="flex justify-between gap-3 rounded bg-road p-3 text-sm"><div><strong>{item.insurer_name}</strong> · {item.product_name}<p>{item.make} {item.model} {item.year}</p></div><StatusBadge status={item.status}/></li>)}</ul>
          )}
        </div>
      </section>
    </div>
  )
}
