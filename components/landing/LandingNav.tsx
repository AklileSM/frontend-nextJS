'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';

const links = [
  { href: '#model', label: 'Data model' },
  { href: '#viewers', label: 'Viewers' },
  { href: '#reports', label: 'Reports' },
  { href: '#access', label: 'Access' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-200 ${
        scrolled ? 'border-b border-base-800 bg-base-950/85 backdrop-blur' : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-[1480px] items-center justify-between px-8 py-4 sm:px-12 lg:px-24 xl:px-32">
        <Logo />

        <div className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[16px] font-medium text-ink-200 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-md px-4 py-2 text-[15px] font-medium text-ink-200 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-amber-500 px-5 py-2.5 text-[15px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-base-700 text-white"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      <div
        className={`md:hidden overflow-hidden border-t border-base-800 bg-base-950 transition-[max-height,opacity] duration-200 ${
          open ? 'max-h-[28rem] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!open}
      >
        <div className="flex flex-col gap-1 px-8 py-5 sm:px-12">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2.5 text-[15px] text-ink-200 hover:bg-base-900 hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-md border border-base-700 px-3 py-2.5 text-center text-[14px] font-medium text-white"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="rounded-md bg-amber-500 px-3 py-2.5 text-center text-[14px] font-semibold text-base-950"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
