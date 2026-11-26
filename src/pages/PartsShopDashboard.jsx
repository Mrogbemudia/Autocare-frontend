import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { formatNaira } from '../lib/format.js'
import { EmptyState, ErrorState, FormError, PageSpinner, StatusBadge } from '../components/ui.jsx'
import { StartCallButton } from '../components/CallCenter.jsx'

export default function PartsShopDashboard() {
  const qc = useQueryClient()
  const dashboard = useQuery({queryKey:['parts-shop','dashboard'],queryFn:api.partsShop.dashboard})
  const orders = useQuery({queryKey:['parts-shop','orders'],queryFn:api.partsShop.orders})
  const [editing,setEditing] = useState(null)
  const [name,setName] = useState('')
  const [brand,setBrand] = useState('')
  const [partNumber,setPartNumber] = useState('')
  const [condition,setCondition] = useState('new')
  const [price,setPrice] = useState('')
  const [stock,setStock] = useState('0')
  const [description,setDescription] = useState('')
  const [image,setImage] = useState(null)
  const [docType,setDocType] = useState('cac')
  const [docReference,setDocReference] = useState('')
  const [documents,setDocuments] = useState([])
  const [locationError,setLocationError] = useState('')

  const openForm = (part=null) => {
    setEditing(part?.id ?? 'new')
    setName(part?.name ?? '')
    setBrand(part?.brand ?? '')
    setPartNumber(part?.part_number ?? '')
    setCondition(part?.condition ?? 'new')
    setPrice(part?.price_kobo ? String(part.price_kobo) : '')
    setStock(part?.stock_qty ? String(part.stock_qty) : '0')
    setDescription(part?.description ?? '')
  }
  const save = useMutation({
    mutationFn: () => api.parts.save(editing === 'new' ? null : editing,{
      name,brand,partNumber,condition,priceKobo:Number(price),stockQty:Number(stock),description,isActive:true,
    },image),
    onSuccess: () => { setEditing(null); setImage(null); qc.invalidateQueries({queryKey:['parts-shop','dashboard']}) },
  })
  const uploadDocs = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('docType',docType)
      if (docReference.trim()) form.append('referenceNumber',docReference.trim())
      documents.forEach((file)=>form.append('documents',file))
      return api.documents.submit('parts_shop',form)
    },
  })
  const orderStatus = useMutation({
    mutationFn: ({orderId,status}) => api.parts.vendorUpdateStatus(orderId,{status}),
    onSuccess: () => {
      qc.invalidateQueries({queryKey:['parts-shop','orders']})
      qc.invalidateQueries({queryKey:['parts-shop','dashboard']})
    },
  })
  const locationUpdate = useMutation({
    mutationFn: ({orderId,latitude,longitude}) => api.parts.updateDeliveryLocation(orderId,{latitude,longitude}),
    onSuccess: () => qc.invalidateQueries({queryKey:['parts-shop','orders']}),
  })
  const shareDeliveryLocation = (orderId) => {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('Location sharing is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({coords}) => locationUpdate.mutate({orderId,latitude:coords.latitude,longitude:coords.longitude}),
      (error) => setLocationError(error.message || 'Could not get your location.'),
      {enableHighAccuracy:true,timeout:15_000,maximumAge:10_000},
    )
  }

  if (dashboard.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl">Parts seller dashboard</h1>
        <PageSpinner />
      </div>
    )
  }
  if (dashboard.error) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <h1 className="text-3xl">Parts seller dashboard</h1>
        <ErrorState error={dashboard.error} onRetry={dashboard.refetch} />
      </div>
    )
  }
  const data = dashboard.data
  if (!data?.shop || !data.orders || !Array.isArray(data.parts)) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <h1 className="text-3xl">Parts seller dashboard</h1>
        <ErrorState
          error={{ message: 'The server returned incomplete parts shop data. Please retry or contact support.' }}
          onRetry={dashboard.refetch}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl">{data.shop.business_name}</h1>
        <p className="mt-1 text-ink-soft">Parts shop dashboard · <StatusBadge status={data.shop.verification_status} /></p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-sub">Total revenue</p><p className="mt-2 text-2xl font-bold">{formatNaira(data.revenue_kobo)}</p></div>
        <div className="card p-5"><p className="text-sm text-sub">Orders</p><p className="mt-2 text-2xl font-bold">{data.orders.total}</p></div>
        <div className="card p-5"><p className="text-sm text-sub">Open orders</p><p className="mt-2 text-2xl font-bold">{data.orders.open}</p></div>
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl">Parts catalogue</h2><button type="button" className="btn btn-primary btn-sm" onClick={()=>openForm()}>Add item</button></div>
        {editing && (
          <div className="mt-4 rounded-md border border-line p-4">
            <h3 className="font-semibold">{editing === 'new' ? 'Add spare part' : 'Edit spare part'}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Name<input className="input mt-1.5 font-normal" value={name} onChange={(e)=>setName(e.target.value)} /></label>
              <label className="text-sm font-semibold">Brand<input className="input mt-1.5 font-normal" value={brand} onChange={(e)=>setBrand(e.target.value)} /></label>
              <label className="text-sm font-semibold">Part number<input className="input mt-1.5 font-normal" value={partNumber} onChange={(e)=>setPartNumber(e.target.value)} /></label>
              <label className="text-sm font-semibold">Condition<select className="input mt-1.5 font-normal" value={condition} onChange={(e)=>setCondition(e.target.value)}><option value="new">New</option><option value="foreign_used">Foreign used</option><option value="local_used">Local used</option></select></label>
              <label className="text-sm font-semibold">Price (kobo)<input className="input mt-1.5 font-normal" type="number" min="1" value={price} onChange={(e)=>setPrice(e.target.value)} /></label>
              <label className="text-sm font-semibold">Stock quantity<input className="input mt-1.5 font-normal" type="number" min="0" value={stock} onChange={(e)=>setStock(e.target.value)} /></label>
              <label className="text-sm font-semibold sm:col-span-2">Description<textarea className="input mt-1.5 font-normal" rows="3" value={description} onChange={(e)=>setDescription(e.target.value)} /></label>
              <label className="text-sm font-semibold sm:col-span-2">Image<input className="input mt-1.5 font-normal" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>setImage(e.target.files?.[0] ?? null)} /></label>
            </div>
            <FormError>{save.error?.message}</FormError>
            <div className="mt-4 flex gap-2"><button type="button" className="btn btn-primary btn-sm" disabled={save.isPending || name.length<2 || !price} onClick={()=>save.mutate()}>{save.isPending?'Saving…':'Save item'}</button><button type="button" className="btn btn-secondary btn-sm" onClick={()=>setEditing(null)}>Cancel</button></div>
          </div>
        )}
        {data.parts.length===0 ? <p className="mt-4 text-sm text-ink-soft">No listed parts yet.</p> : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.parts.map((part)=><li key={part.id} className="rounded-md border border-line p-4"><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{part.name}</h3><p className="text-sm text-ink-soft">{part.brand || 'No brand'} · {part.condition}</p></div><StatusBadge status={part.is_active?'active':'inactive'} /></div><p className="mt-2 font-semibold">{formatNaira(part.price_kobo)}</p><p className="text-sm text-ink-soft">Stock: {part.stock_qty}</p><button type="button" className="btn btn-secondary btn-sm mt-3" onClick={()=>openForm(part)}>Edit</button></li>)}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-xl">Verification documents</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Document type<select className="input mt-1.5 font-normal" value={docType} onChange={(e)=>setDocType(e.target.value)}><option value="nin">NIN</option><option value="cac">CAC</option><option value="certificate">Certificate</option><option value="other">Additional business document</option></select></label>
          <label className="text-sm font-semibold">Reference<input className="input mt-1.5 font-normal" value={docReference} onChange={(e)=>setDocReference(e.target.value)} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Files<input className="input mt-1.5 font-normal" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e)=>setDocuments(Array.from(e.target.files??[]))} /></label>
        </div>
        <FormError>{uploadDocs.error?.message}</FormError>
        <button type="button" className="btn btn-primary mt-4" disabled={uploadDocs.isPending || documents.length===0} onClick={()=>uploadDocs.mutate()}>{uploadDocs.isPending?'Uploading…':'Submit documents'}</button>
      </section>

      <section className="card p-5">
        <h2 className="text-xl">Orders</h2>
        {orders.isPending ? <PageSpinner /> : orders.error ? <ErrorState error={orders.error} onRetry={orders.refetch} /> : orders.data?.length===0 ? <EmptyState title="No orders yet" /> : (
          <>
            <FormError>{orderStatus.error?.message || locationUpdate.error?.message || locationError}</FormError>
            <ul className="mt-4 space-y-3">{orders.data.map((order)=><li key={order.id} className="rounded-md border border-line p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">Order #{order.id.slice(0,8)}</p><p className="text-sm text-ink-soft">{order.fulfilment_type} · {formatNaira(order.total_kobo)}</p></div><StatusBadge status={order.status} /></div><StartCallButton recipientId={order.buyer_id} context={{partsOrderId:order.id}} children="Call buyer privately" /><select className="input mt-3 max-w-xs font-normal" value={order.status} onChange={(e)=>orderStatus.mutate({orderId:order.id,status:e.target.value})}><option value="awaiting_payment">Awaiting payment</option><option value="paid">Paid</option><option value="preparing">Preparing</option>{order.fulfilment_type==='pickup'?<option value="ready_for_pickup">Ready for pickup</option>:<option value="out_for_delivery">Out for delivery</option>}<option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>{order.fulfilment_type==='delivery'&&!['completed','cancelled'].includes(order.status)&&<button type="button" className="btn btn-secondary btn-sm ml-2" disabled={locationUpdate.isPending} onClick={()=>shareDeliveryLocation(order.id)}>{locationUpdate.isPending?'Updating location…':'Share delivery location'}</button>}</li>)}</ul>
          </>
        )}
      </section>
    </div>
  )
}
