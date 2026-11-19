import { Link } from 'react-router-dom';
import { ThemeToggle } from '../lib/theme';

const COLUMNS = [
  ['For vehicle owners', [['Find a shop', '/shops'], ['My garage', '/garage'], ['My requests', '/requests']]],
  ['For repair shops', [['Register your shop', '/register'], ['Shop log in', '/login']]],
  ['Account', [['Log in', '/login'], ['Create account', '/register']]],
];

export default function Footer() {
  return (
    <footer className="border-t-2 border-line bg-card text-ink">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <p className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="inline-block h-5 w-5 rounded-sm bg-signal" aria-hidden="true" />
            Kaza
          </p>
          <p className="mt-3 max-w-xs text-sm text-sub">
            Verified repair shops and written quotes for vehicle owners across Nigeria.
          </p>
        </div>
        {COLUMNS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <h2 className="text-sm font-semibold">{title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-sub">
              {links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-ink">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 text-sm text-sub">
          <p className="text-sub">© {new Date().getFullYear()} Kaza. All prices are in naira (₦).</p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
