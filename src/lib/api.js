/** The only place the frontend talks to the backend. */
const BASE = '/api'
const REQUEST_TIMEOUT_MS = 60_000 // free-tier backends can take ~1 minute to wake

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
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(buildUrl(path, params), {
      method,
      credentials: 'same-origin', // auth cookies stay first-party through the /api proxy
      signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
  return result?.user ? { ...result.user, ...(result.shop ? { shop: result.shop } : {}) } : null
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
      phone: shop.phone,
    },
  }
}

export const api = {
  auth: {
    me: async () => asUser(await data(request('/auth/me'))),
    login: async (body) => asUser(await post('/auth/login', body)),
    registerOwner: async (body) => asUser(await post('/auth/register/owner', body)),
    registerShop: async (body) => asUser(await post('/auth/register/shop', body)),
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
  },
  vehicles: {
    list: () => data(request('/vehicles')),
    create: (body) => post('/vehicles', body),
    update: (vehicleId, body) => patch(`/vehicles/${id(vehicleId)}`, body),
    remove: (vehicleId) => request(`/vehicles/${id(vehicleId)}`, { method: 'DELETE' }),
  },
  requests: {
    list: () => data(request('/service-requests')).then((rows) => rows.map(asRequest)),
    create: (body) => post('/service-requests', {
      ...body,
      location_type: body.location_type === 'shop' ? 'visit_shop' : body.location_type,
    }),
  },
  admin: {
    shops: (params) => request('/admin/shops', { params }).then((json) => ({
      ...json,
      data: fromApi(json?.data ?? []).map(asAdminShop),
    })),
    reviewShop: (shopId, { status, note }) => {
      const action = { verified: 'verify', rejected: 'reject', suspended: 'suspend' }[status]
      return post(`/admin/shops/${id(shopId)}/${action}`, { note })
    },
  },
}
