import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRegister } from '../lib/auth.js'
import { applyFieldErrors } from '../lib/forms.js'
import { NIGERIAN_STATES, SERVICE_TYPES } from '../lib/constants.js'
import { ownerRegisterSchema, shopRegisterSchema } from '../lib/schemas.js'
import { Field, FormError } from '../components/ui.jsx'

function PartsShopForm() {
  const signup = useRegister('parts_shop')
  const [values,setValues] = useState({
    full_name:'',email:'',phone:'',password:'',confirm_password:'',
    business_name:'',state:'',city_area:'',address:'',description:'',
    offers_pickup:true,offers_delivery:false,delivery_fee_kobo:0,
  })
  const [error,setError] = useState('')
  const update=(key,value)=>setValues((old)=>({...old,[key]:value}))
  return (
    <form onSubmit={(event)=>{event.preventDefault(); if(values.password!==values.confirm_password){setError('Passwords do not match');return;} setError(''); signup.mutate(values,{onError:(err)=>setError(err.message)})}} className="card space-y-4 p-6">
      <FormError>{error||signup.error?.message}</FormError>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input value={values.full_name} onChange={(e)=>update('full_name',e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={values.email} onChange={(e)=>update('email',e.target.value)} /></Field>
        <Field label="Phone number" hint="Used only for account security"><input type="tel" value={values.phone} onChange={(e)=>update('phone',e.target.value)} /></Field>
        <Field label="Business name"><input value={values.business_name} onChange={(e)=>update('business_name',e.target.value)} /></Field>
        <Field label="Password"><input type="password" value={values.password} onChange={(e)=>update('password',e.target.value)} /></Field>
        <Field label="Confirm password"><input type="password" value={values.confirm_password} onChange={(e)=>update('confirm_password',e.target.value)} /></Field>
        <Field label="State"><select value={values.state} onChange={(e)=>update('state',e.target.value)}><option value="">Choose state</option>{NIGERIAN_STATES.map((state)=><option key={state}>{state}</option>)}</select></Field>
        <Field label="City or area"><input value={values.city_area} onChange={(e)=>update('city_area',e.target.value)} /></Field>
      </div>
      <Field label="Business address"><input value={values.address} onChange={(e)=>update('address',e.target.value)} /></Field>
      <Field label="Description"><textarea rows="3" value={values.description} onChange={(e)=>update('description',e.target.value)} /></Field>
      <div className="flex flex-wrap gap-4 text-sm">
        <label><input type="checkbox" checked={values.offers_pickup} onChange={(e)=>update('offers_pickup',e.target.checked)} /> Offers pickup</label>
        <label><input type="checkbox" checked={values.offers_delivery} onChange={(e)=>update('offers_delivery',e.target.checked)} /> Offers delivery</label>
      </div>
      {values.offers_delivery&&<Field label="Delivery fee (kobo)"><input type="number" min="0" value={values.delivery_fee_kobo} onChange={(e)=>update('delivery_fee_kobo',Number(e.target.value))} /></Field>}
      <button type="submit" className="btn w-full bg-[#FACC15] text-[#0F172A]" disabled={signup.isPending}>{signup.isPending?'Creating account…':'Register parts shop'}</button>
    </form>
  )
}

function AccountFields({ register, errors }) {
  return (
    <>
      <Field label="Full name" error={errors.full_name?.message}>
        <input autoComplete="name" {...register('full_name')} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <input type="email" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Phone number" hint="For example 0803 123 4567" error={errors.phone?.message}>
        <input type="tel" autoComplete="tel" {...register('phone')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" hint="At least 8 characters" error={errors.password?.message}>
          <input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label="Confirm password" error={errors.confirm_password?.message}>
          <input type="password" autoComplete="new-password" {...register('confirm_password')} />
        </Field>
      </div>
    </>
  )
}

function OwnerForm() {
  const signup = useRegister('owner')
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ resolver: zodResolver(ownerRegisterSchema) })
  const onSubmit = (values) => signup.mutate(values, { onError: (err) => applyFieldErrors(err, setError) })
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-4 p-6">
      <FormError>{signup.error?.message}</FormError>
      <AccountFields register={register} errors={errors} />
      <button
        type="submit"
        className="btn w-full bg-[#FACC15] text-[#0F172A] hover:bg-[#EAB308] focus-visible:outline-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A] focus-visible:ring-offset-2"
        disabled={signup.isPending}
      >
        {signup.isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}

function ShopForm() {
  const signup = useRegister('shop')
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(shopRegisterSchema),
    defaultValues: { service_codes: [], state: '', sells_parts: false },
  })
  const onSubmit = (values) =>
    signup.mutate({ ...values, certification_notes: values.certification_notes || null }, { onError: (err) => applyFieldErrors(err, setError) })
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-4 p-6">
      <FormError>{signup.error?.message}</FormError>
      <AccountFields register={register} errors={errors} />
      <hr className="border-line" />
      <Field label="Business name" error={errors.business_name?.message}>
        <input {...register('business_name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="State" error={errors.state?.message}>
          <select {...register('state')}>
            <option value="">Choose a state</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="City or area" error={errors.city_area?.message}>
          <input {...register('city_area')} />
        </Field>
      </div>
      <Field label="Shop address" error={errors.address?.message}>
        <input autoComplete="street-address" {...register('address')} />
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold">Services you offer</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SERVICE_TYPES.map((s) => (
            <label key={s.code} className="flex items-center gap-2 rounded-md border border-line bg-card px-3 py-2">
              <input type="checkbox" value={s.code} className="size-4 accent-ink" {...register('service_codes')} />
              {s.label}
            </label>
          ))}
        </div>
        {errors.service_codes && <p role="alert" className="mt-1.5 text-sm font-medium text-alert">{errors.service_codes.message}</p>}
      </fieldset>
      <Field label="Certifications and experience" hint="Optional. An admin reads this when verifying your shop." error={errors.certification_notes?.message}>
        <textarea rows={4} {...register('certification_notes')} />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4" {...register('sells_parts')} />
        <span><strong>I sell parts as well</strong><span className="mt-1 block text-ink-soft">Create a parts catalogue under this same shop account. Parts sales require separate vendor verification.</span></span>
      </label>
      <button
        type="submit"
        className="btn w-full bg-[#FACC15] text-[#0F172A] hover:bg-[#EAB308] focus-visible:outline-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A] focus-visible:ring-offset-2"
        disabled={signup.isPending}
      >
        {signup.isPending ? 'Creating account…' : 'Register my shop'}
      </button>
      <p className="text-sm text-ink-soft">Your shop stays hidden until an admin verifies it.</p>
    </form>
  )
}

export default function Register() {
  const [params, setParams] = useSearchParams()
  const requestedRole = params.get('role')
  const role = requestedRole === 'shop' || requestedRole === 'parts_shop' ? requestedRole : 'owner'
  const tab = (value, label) => (
    <button
      type="button"
      aria-pressed={role === value}
      onClick={() => setParams({ role: value })}
      className={`btn flex-1 focus-visible:outline-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A] focus-visible:ring-offset-2 ${
        role === value
          ? 'bg-[#FACC15] text-[#0F172A] hover:bg-[#EAB308]'
          : 'btn-secondary'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl">Create your account</h1>
      <div className="mt-6 flex gap-2" role="group" aria-label="Account type">
        {tab('owner', 'I own a vehicle')}
        {tab('shop', 'I run a repair shop')}
        {tab('parts_shop', 'I run a parts shop')}
      </div>
      <div className="mt-4">
        {role === 'shop' ? <ShopForm key="shop" /> : role === 'parts_shop' ? <PartsShopForm key="parts_shop" /> : <OwnerForm key="owner" />}
      </div>
      <p className="mt-4 text-ink-soft">
        Already registered? <Link to="/login" className="font-semibold text-ink underline underline-offset-4">Log in</Link>
      </p>
    </div>
  )
}
