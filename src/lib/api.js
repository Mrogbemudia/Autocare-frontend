/** The only place the frontend talks to the backend. */
const BASE = '/api'
const REQUEST_TIMEOUT_MS = 60_000 // free-tier backends can take ~1 minute to wake
const MEDIA_UPLOAD_TIMEOUT_MS = 5 * 60_000

// A 401 on these must not trigger a silent refresh.
const NO_REFRESH = new Set([
  '/auth/login',
  '/auth/register/owner',
  '/auth/register/shop',
  '/auth/refresh',
  '/auth/logout',
])

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', fields = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function buildUrl(path, params) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return `${BASE}${path}${query ? `?${query}` : ''}`
}

const snakeCase = (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

function fromApi(value) {
  if (Array.isArray(value)) return value.map(fromApi)
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [snakeCase(key), fromApi(item)]))
  }
  return value
}

function toApi(value) {
  if (Array.isArray(value)) return value.map(toApi)
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined)
        .map(([key, item]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), toApi(item)]),
    )
  }
  return value
}

function validationFields(json) {
  if (json?.error?.fields) return fromApi(json.error.fields)
  if (!Array.isArray(json?.error?.details)) return null
  return Object.fromEntries(json.error.details.map(({ field, message }) => [field.split('.').map(snakeCase).join('.'), message]))
}

async function send(path, { method = 'GET', body, params } = {}) {
  const controller = new AbortController()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const timer = setTimeout(
    () => controller.abort(),
    isFormData ? MEDIA_UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  )
  try {
    const res = await fetch(buildUrl(path, params), {
      method,
      credentials: 'same-origin', // auth cookies stay first-party through the /api proxy
      signal: controller.signal,
      headers: body && !isFormData ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
    const json = res.status === 204 ? null : await res.json().catch(() => null)
    if (!res.ok) {
      throw new ApiError(json?.error?.message ?? 'Something went wrong. Please try again.', {
        status: res.status,
        code: json?.error?.code,
        fields: validationFields(json),
      })
    }
    return json
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(
      'Cannot reach Kaza right now. Check your connection and try again. The server may still be waking up.',
      { status: 0, code: 'NETWORK' },
    )
  } finally {
    clearTimeout(timer)
  }
}

// One refresh at a time, even if several requests get a 401 together.
let refreshing = null
function refreshSession() {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function request(path, options) {
  try {
    return await send(path, options)
  } catch (err) {
    if (err.status === 401 && !NO_REFRESH.has(path) && (await refreshSession())) {
      return send(path, options)
    }
    throw err
  }
}

const data = (promise) => promise.then((json) => fromApi(json?.data ?? null))
const post = (path, body) => data(request(path, { method: 'POST', body: toApi(body) }))
const patch = (path, body) => data(request(path, { method: 'PATCH', body: toApi(body) }))
const id = encodeURIComponent

function asUser(result) {
  return result?.user ? {
    ...result.user,
    ...(result.shop ? { shop: result.shop } : {}),
    ...(result.partsShop ? { partsShop: result.partsShop } : {}),
  } : null
}

function asRequest(row) {
  if (!row) return row
  return {
    ...row,
    shop: row.shop_name ? { business_name: row.shop_name } : undefined,
    vehicle: row.make ? {
      vehicle_type: row.vehicle_type,
      make: row.make,
      model: row.model,
      year: row.year,
      plate_number: row.plate_number,
    } : undefined,
  }
}

function asAdminShop(shop) {
  if (!shop) return shop
  return {
    ...shop,
    owner: {
      full_name: shop.owner_name,
      email: shop.email,
    },
  }
}

export const api = {
  auth: {
    me: async () => asUser(await data(request('/auth/me'))),
    login: async (body) => asUser(await post('/auth/login', body)),
    registerOwner: async (body) => asUser(await post('/auth/register/owner', body)),
    registerShop: async (body) => asUser(await post('/auth/register/shop', body)),
    registerPartsShop: async (body) => asUser(await post('/auth/register/parts-shop', body)),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  shops: {
    list: (params) => {
      const { city, ...filters } = params ?? {}
      return request('/shops', {
        params: { ...filters, cityArea: city },
      }).then((json) => ({ ...json, data: fromApi(json?.data ?? []) }))
    },
    get: (shopId) => data(request(`/shops/${id(shopId)}`)),
    mine: () => data(request('/shops/me')),
    serviceTypes: () => data(request('/shops/service-types')),
    updateMine: (body) => patch('/shops/me', body),
  },
  vehicles: {
    list: () => data(request('/vehicles')),
    get: (vehicleId) => data(request(`/vehicles/${id(vehicleId)}`)),
    create: (body) => post('/vehicles', body),
    update: (vehicleId, body) => patch(`/vehicles/${id(vehicleId)}`, body),
    remove: (vehicleId) => request(`/vehicles/${id(vehicleId)}`, { method: 'DELETE' }),
  },
  requests: {
    list: () => data(request('/service-requests')).then((rows) => rows.map(asRequest)),
    get: (requestId) => data(request(`/service-requests/${id(requestId)}`)).then(asRequest),
    cancel: (requestId) => post(`/service-requests/${id(requestId)}/cancel`, {}),
    listQuotes: (requestId) => data(request(`/service-requests/${id(requestId)}/quotes`)),
    proposeBooking: (requestId, proposedAt) =>
      post(`/service-requests/${id(requestId)}/bookings`, { proposed_at: proposedAt }),
    create: (body) => {
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        return data(request('/service-requests', { method: 'POST', body })).then(asRequest)
      }
      return post('/service-requests', {
        ...body,
        location_type: body.location_type === 'shop' ? 'visit_shop' : body.location_type,
      }).then(asRequest)
    },
    submitQuote: (requestId, body) => post(`/service-requests/${id(requestId)}/quotes`, body),
  },
  quotes: {
    accept: (quoteId, proposedAt) => post(`/quotes/${id(quoteId)}/accept`, { proposed_at: proposedAt }),
    reject: (quoteId, reason) => post(`/quotes/${id(quoteId)}/reject`, { reason }),
  },
  bookings: {
    confirm: (bookingId) => post(`/bookings/${id(bookingId)}/confirm`, {}),
    decline: (bookingId, reason) => post(`/bookings/${id(bookingId)}/decline`, { reason }),
  },
  workOrders: {
    list: () => data(request('/work-orders')),
    get: (workOrderId) => data(request(`/work-orders/${id(workOrderId)}`)),
    changeStatus: (workOrderId, body) =>
      patch(`/work-orders/${id(workOrderId)}/status`, body),
    raiseExtraWork: (workOrderId, body) =>
      post(`/work-orders/${id(workOrderId)}/extra-work`, body),
    approveExtraWork: (extraWorkId, note) =>
      post(`/extra-work/${id(extraWorkId)}/approve`, { note }),
    declineExtraWork: (extraWorkId, note) =>
      post(`/extra-work/${id(extraWorkId)}/decline`, { note }),
    submitRepairPlan: (workOrderId, body) => data(request(`/work-orders/${id(workOrderId)}/repair-plans`, {
      method: 'POST',
      body,
    })),
    reviewRepairPlan: (planId, decision, note) =>
      post(`/repair-plans/${id(planId)}/${decision}`, { note }),
  },
  admin: {
    stats: () => data(request('/admin/stats')),
    shops: (params) => request('/admin/shops', { params }).then((json) => ({
      ...json,
      data: fromApi(json?.data ?? []).map(asAdminShop),
    })),
    reviewShop: (shopId, { status, note }) => {
      const action = { verified: 'verify', rejected: 'reject', suspended: 'suspend' }[status]
      return post(`/admin/shops/${id(shopId)}/${action}`, { note })
    },
  },

  technician: {
    dashboard: () => data(request('/technician/dashboard')),
  },
  grading: {
    status: () => data(request('/grading/status')),
    start: (body) => data(request('/grading/attempts', { method: 'POST', body: toApi(body) })),
    submit: (attemptId, answers) =>
      post(`/grading/attempts/${id(attemptId)}/submit`, { answers }),
  },
  interviews: {
    list: () => data(request('/interviews')),
    request: (body) => post('/interviews', body),
  },
  documents: {
    submit: (ownerType, body) => data(request(`/verification-documents/${id(ownerType)}`, { method: 'POST', body })),
  },
  partsShop: {
    dashboard: () => data(request('/parts-shop/dashboard')),
    update: (body) => patch('/parts-shop/me', body),
    orders: () => data(request('/parts-shop/orders')),
  },
  parts: {
    list: (params) => request('/parts', { params }).then((json) => ({ ...json, data: fromApi(json?.data ?? []) })),
    save: (partId, body, image) => {
      const form = new FormData()
      Object.entries(body).forEach(([key, value]) => {
        if (value !== undefined && value !== null) form.append(key, String(value))
      })
      if (image) form.append('image', image)
      return data(request(partId ? `/parts/${id(partId)}` : '/parts', { method: partId ? 'PATCH' : 'POST', body: form }))
    },
    checkout: (body) => post('/parts/orders', body),
    orders: () => data(request('/parts/orders')),
    order: (orderId) => data(request(`/parts/orders/${id(orderId)}`)),
    vendorUpdateStatus: (orderId, body) =>
      patch(`/parts-shop/orders/${id(orderId)}/status`, body),
    paystack: (orderId) => post(`/parts/orders/${id(orderId)}/paystack`, {}),
    verifyPaystack: (reference) => post(`/parts/payments/paystack/verify/${id(reference)}`, {}),
    bankTransfer: (orderId) => post(`/parts/orders/${id(orderId)}/bank-transfer`, {}),
  },
  maintenance: {
    get: () => data(request('/maintenance')),
    setRule: (body) => post('/maintenance/rules', body),
    setReminders: (body) => post('/reminders', body),
  },
  insurance: {
    products: () => data(request('/insurance/products')),
    apply: (body) => post('/insurance/requests', body),
    list: () => data(request('/insurance/requests')),
  },
  calls: {
    create: (body) => post('/calls', body),
    incoming: () => data(request('/calls/incoming')),
    update: (callId, status) => patch(`/calls/${id(callId)}/status`, { status }),
    signal: (callId, kind, payload) => post(`/calls/${id(callId)}/signals`, { kind, payload }),
    signals: (callId, after) => data(request(`/calls/${id(callId)}/signals`, { params: after ? { after } : {} })),
  },
}
