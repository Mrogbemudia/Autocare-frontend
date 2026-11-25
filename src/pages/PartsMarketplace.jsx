import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { formatNaira } from '../lib/format.js'
import { EmptyState, ErrorState, FormError, PageSpinner, StatusBadge } from '../components/ui.jsx'

export default function PartsMarketplace() {
  const qc = useQueryClient()
  const [search,setSearch] = useState('')
  const [cart,setCart] = useState([])
  const [fulfilment,setFulfilment] = useState('pickup')
  const [address,setAddress] = useState('')
  const [payment,setPayment] = useState('paystack')
  const [checkoutResult,setCheckoutResult] = useState(null)
  const parts = useQuery({queryKey:['parts','marketplace',search],queryFn:()=>api.parts.list({search,pageSize:50})})
  const orders = useQuery({queryKey:['parts','orders'],queryFn:api.parts.orders})

  const checkout = useMutation({
    mutationFn: () => api.parts.checkout({
      items:cart.map((item)=>({partId:item.id,qty:item.qty})),
      fulfilmentType:fulfilment,
      address:fulfilment==='delivery'?address:undefined,
    }),
    onSuccess:(result) => {
      setCheckoutResult(result)
      qc.invalidateQueries({queryKey:['parts','orders']})
    },
  })
  const pay = useMutation({
    mutationFn: () => payment==='paystack'
      ? api.parts.paystack(checkoutResult.order.id)
      : api.parts.bankTransfer(checkoutResult.order.id),
    onSuccess:(result) => {
      if (result.authorizationUrl) window.location.assign(result.authorizationUrl)
      else setCheckoutResult((old)=>({...old,payment:result}))
    },
  })

  const add = (part) => setCart((old)=>{
    const existing=old.find((item)=>item.id===part.id)
    if (existing) return old.map((item)=>item.id===part.id?{...item,qty:Math.min(item.qty+1,part.stock_qty)}:item)
    return [...old,{...part,qty:1}]
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl">Parts marketplace</h1>
      <p className="mt-1 text-ink-soft">Compare verified vendors. Personal phone numbers are never displayed.</p>
      <label className="mt-5 block max-w-md text-sm font-semibold">Search
        <input className="input mt-1.5 font-normal" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Name, brand, or part number" />
      </label>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          {parts.isPending?<PageSpinner/>:parts.error?<ErrorState error={parts.error} onRetry={parts.refetch}/>:parts.data?.data?.length===0?<EmptyState title="No parts found"/>:(
            <ul className="grid gap-4 sm:grid-cols-2">
              {parts.data.data.map((part)=>(
                <li key={part.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{part.name}</h2><p className="text-sm text-ink-soft">{part.brand || 'No brand'} · {part.condition?.replace(/_/g,' ')}</p></div><p className="font-bold">{formatNaira(part.price_kobo)}</p></div>
                  {part.description && <p className="mt-3 text-sm">{part.description}</p>}
                  <p className="mt-3 text-sm text-ink-soft">{part.business_name} · {part.city_area}, {part.state}</p>
                  <p className="mt-1 text-sm text-ink-soft">Stock: {part.stock_qty} · {part.offers_pickup?'Pickup available':''}{part.offers_pickup&&part.offers_delivery?' · ':''}{part.offers_delivery?'Delivery available':''}</p>
                  <button type="button" className="btn btn-primary btn-sm mt-4" disabled={part.stock_qty<1} onClick={()=>add(part)}>{part.stock_qty<1?'Out of stock':'Add to cart'}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="card h-fit p-5">
          <h2 className="text-xl">Checkout</h2>
          {cart.length===0?<p className="mt-3 text-sm text-ink-soft">Your cart is empty.</p>:(
            <ul className="mt-3 space-y-2">{cart.map((item)=><li key={item.id} className="flex items-center justify-between gap-2 text-sm"><span>{item.name} × {item.qty}</span><button type="button" className="text-alert" onClick={()=>setCart((old)=>old.filter((i)=>i.id!==item.id))}>Remove</button></li>)}</ul>
          )}
          {cart.length>0 && (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">Fulfilment<select className="input mt-1.5 font-normal" value={fulfilment} onChange={(e)=>setFulfilment(e.target.value)}><option value="pickup">Self-pickup</option><option value="delivery">Delivery</option></select></label>
              {fulfilment==='delivery'&&<label className="block text-sm font-semibold">Delivery address<textarea className="input mt-1.5 font-normal" rows="3" value={address} onChange={(e)=>setAddress(e.target.value)} /></label>}
              <label className="block text-sm font-semibold">Payment<select className="input mt-1.5 font-normal" value={payment} onChange={(e)=>setPayment(e.target.value)}><option value="paystack">Paystack</option><option value="bank">Bank transfer</option></select></label>
              <FormError>{checkout.error?.message||pay.error?.message}</FormError>
              {!checkoutResult ? <button type="button" className="btn btn-primary w-full" disabled={checkout.isPending||cart.length===0||(fulfilment==='delivery'&&address.length<5)} onClick={()=>checkout.mutate()}>{checkout.isPending?'Creating order…':'Create order'}</button> : (
                <div className="space-y-2"><p className="text-sm">Order <strong>#{checkoutResult.order.id.slice(0,8)}</strong> · {formatNaira(checkoutResult.totalKobo)}</p><button type="button" className="btn btn-primary w-full" disabled={pay.isPending} onClick={()=>pay.mutate()}>{pay.isPending?'Processing…':payment==='paystack'?'Pay with Paystack':'Generate bank reference'}</button>{checkoutResult.payment?.reference&&<p className="rounded bg-road p-2 text-xs"><strong>Transfer reference:</strong> {checkoutResult.payment.reference}</p>}</div>
              )}
            </div>
          )}
        </aside>
      </div>
      <section className="mt-10">
        <h2 className="text-xl">My orders</h2>
        {orders.isPending?<PageSpinner/>:orders.error?<ErrorState error={orders.error} onRetry={orders.refetch}/>:orders.data?.length===0?<p className="mt-3 text-sm text-ink-soft">No orders yet.</p>:(
          <ul className="mt-4 space-y-3">{orders.data.map((order)=><li key={order.id} className="card p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{order.business_name}</p><p className="text-sm text-ink-soft">{order.fulfilment_type} · {formatNaira(order.total_kobo)}</p></div><StatusBadge status={order.status}/></div></li>)}</ul>
        )}
      </section>
    </div>
  )
}
