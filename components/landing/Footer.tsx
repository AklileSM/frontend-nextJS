import Link from 'next/link';
import { Logo } from './Logo';

const cols = [
  {
    heading: 'Platform',
    links: [
      { href: '#model', label: 'Data model' },
      { href: '#viewers', label: 'Viewers' },
      { href: '#reports', label: 'Report loop' },
      { href: '#compare', label: 'Compare' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/register', label: 'Get started' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '#access', label: 'Roles & access' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-base-800 bg-base-950">
      <div className="mx-auto grid max-w-[1480px] gap-14 px-8 py-16 sm:px-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] lg:px-24 xl:px-32">
        <div>
          <Logo />
          <p className="mt-4 max-w-[44ch] text-[14px] leading-[1.7] text-ink-300">
            Field documentation for indoor construction projects. Photos, panoramas, point
            clouds, videos, and field reports organised by room and date.
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-3">
          {cols.map((c) => (
            <div key={c.heading}>
              <h4 className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-400">
                {c.heading}
              </h4>
              <ul className="mt-4 space-y-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[14px] text-ink-200 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-base-800">
        <div className="mx-auto flex max-w-[1480px] flex-col items-start justify-between gap-2 px-8 py-6 text-[13px] text-ink-400 sm:flex-row sm:items-center sm:px-12 lg:px-24 xl:px-32">
          <span>© {year} SiteScope</span>
          <span>Built for the field.</span>
        </div>
      </div>
    </footer>
  );
}
