import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLogout, useMe } from '../lib/auth.js'
import { PageSpinner } from './ui.jsx'
import CallCenter from './CallCenter.jsx'

const NAV = {
  owner: [
    ['/shops', 'Find a shop'],
    ['/garage', 'My garage'],
    ['/requests', 'My requests'],
    ['/work-orders', 'Work orders'],
    ['/parts', 'Parts'],
    ['/maintenance', 'Maintenance'],
  ],
  shop: [
    ['/shop', 'My shop'],
    ['/technician', 'Technician'],
    ['/work-orders', 'Work orders'],
    ['/parts', 'Parts'],
  ],
  parts_shop: [
    ['/parts-shop', 'Parts shop'],
    ['/parts', 'Marketplace'],
  ],
  admin: [
    ['/admin', 'Dashboard'],
    ['/admin/shops', 'Verify shops'],
    ['/work-orders', 'Work orders'],
    ['/shops', 'Browse shops'],
  ],
  support: [
    ['/admin/interviews', 'Interview queue'],
  ],
}
const GUEST_NAV = [['/shops', 'Find a shop']]

const linkClass = ({ isActive }) =>
  `rounded px-2 py-2 font-semibold underline-offset-[6px] decoration-[3px] ${isActive ? 'underline' : 'hover:underline'}`

export default function Layout() {
  const { data: user, isPending } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const links = user ? NAV[user.role] ?? GUEST_NAV : GUEST_NAV
  const close = () => setOpen(false)

  return (
    <div className="flex min-h-svh flex-col">
      <a href="#main" className="sr-only rounded bg-card px-3 py-2 font-semibold text-ink focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50">
        Skip to content
      </a>

      {/* The danfo band: the one loud thing on the page. */}
      <header className="border-b-[6px] border-slate-950 bg-danfo text-slate-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" onClick={close} className="inline-flex items-center gap-2.5 font-display text-3xl font-extrabold tracking-tight">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-sm bg-ink text-xl text-danfo">K</span>
            <span>Kaza</span>
          </Link>
          <button
            type="button"
            className="btn btn-secondary btn-sm md:hidden"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
          <nav
            id="site-nav"
            aria-label="Main"
            className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-1 pt-2 md:flex md:w-auto md:flex-row md:items-center md:gap-3 md:pt-0`}
          >
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} onClick={close} className={linkClass}>
                {label}
              </NavLink>
            ))}
            {!isPending &&
              (user ? (
                <div className="flex items-center gap-3 md:ml-2">
                  <span className="font-semibold">{user.full_name?.split(' ')[0]}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={logout.isPending}
                    onClick={() => logout.mutate(undefined, { onSettled: () => { close(); navigate('/') } })}
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 md:ml-2">
                  <Link to="/login" onClick={close} className="font-semibold underline-offset-[6px] hover:underline">
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    onClick={close}
                    className="btn btn-sm bg-white text-[#0F172A] hover:bg-slate-100 focus-visible:outline-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A] focus-visible:ring-offset-2"
                  >
                    Sign up
                  </Link>
                </div>
              ))}
          </nav>
        </div>
      </header>

      <main id="main" className="min-w-0 flex-1 bg-page text-ink">
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t-2 border-line bg-card text-ink">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-semibold">Kaza · clear quotes, approved work.</p>
          <p className="text-ink-soft">Payment is arranged directly with the repair shop.</p>
        </div>
      </footer>
      <CallCenter />
    </div>
  )
}
