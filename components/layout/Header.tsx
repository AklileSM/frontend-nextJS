'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, GitCompareArrows, Home, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSidebar } from './SidebarContext';
import { ProfileMenu } from '@/components/app/ProfileMenu';
import { listProjects } from '@/services/apiClient';
import type { ApiProject } from '@/types/api';

export function Header() {
  const { toggle, open } = useSidebar();
  const pathname = usePathname();
  const onCompare = pathname?.startsWith('/app/compare');

  const [projects, setProjects] = useState<ApiProject[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProjects().then((p) => { if (!cancelled) setProjects(p); });
    return () => { cancelled = true; };
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-base-800 bg-base-950/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-base-700 text-white transition-colors hover:border-ink-300 lg:hidden"
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>

      <Breadcrumb projects={projects} />

      <div className="ml-auto flex items-center gap-2">
        <ProjectSwitcher projects={projects} />
        <CompareToggle onCompare={!!onCompare} />
        <ProfileMenu />
      </div>
    </header>
  );
}

// --- Breadcrumb -------------------------------------------------------------

function Breadcrumb({ projects }: { projects: ApiProject[] | null }) {
  const pathname = usePathname() ?? '/app';
  const params = useSearchParams();

  const crumbs: Array<{ label: string; href?: string }> = [];
  const parts = pathname.split('/').filter(Boolean);

  if (parts[1] === 'projects' && parts[2]) {
    const slug = parts[2];
    const projectName = projects?.find((p) => p.slug === slug)?.name ?? humanize(slug);

    if (parts[3] === 'files') {
      const date = params.get('date');
      crumbs.push({ label: projectName, href: `/app/projects/${slug}` });
      crumbs.push({ label: date ? `Files · ${date}` : 'Files' });
    } else {
      crumbs.push({ label: projectName });
    }
  } else if (parts[1] === 'room-explorer') {
    const room = params.get('room');
    crumbs.push({ label: 'Room explorer' });
    if (room) crumbs.push({ label: humanize(room) });
  } else if (parts[1] === 'compare') {
    crumbs.push({ label: 'Compare' });
  } else if (parts[1] === 'profile') {
    crumbs.push({ label: 'Profile' });
  } else if (parts[1] === 'viewer' && parts[2]) {
    crumbs.push({ label: 'Viewer' });
    crumbs.push({ label: humanize(parts[2]) });
  } else if (parts[1] === 'pdf-viewer') {
    crumbs.push({ label: 'PDF viewer' });
  } else if (parts[1] === 'admin') {
    crumbs.push({ label: 'Admin' });
  }

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-base-700">/</span>}
            {c.href && !last ? (
              <Link href={c.href} className="text-ink-300 transition-colors hover:text-white">
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'font-medium text-white' : 'text-ink-300'}>{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function humanize(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

// --- Project switcher -------------------------------------------------------

function ProjectSwitcher({ projects }: { projects: ApiProject[] | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const slugFromPath = pathname?.match(/^\/app\/projects\/([^/]+)/)?.[1] ?? null;
  const slugFromStorage = (() => { try { return sessionStorage.getItem('sidebar.lastProjectSlug'); } catch { return null; } })();
  const currentSlug = slugFromPath ?? slugFromStorage;
  const current = (currentSlug ? projects?.find((p) => p.slug === currentSlug) : null) ?? projects?.[0];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hidden items-center gap-2 rounded-md border border-base-700 bg-base-900/40 px-3 py-1.5 text-[13px] text-white transition-colors hover:border-ink-300 sm:inline-flex"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
          Project
        </span>
        <span className="font-medium">{current?.name ?? '—'}</span>
        <ChevronDown
          size={13}
          className={`text-ink-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top right' }}
            role="menu"
            className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-md border border-base-700 bg-base-900 shadow-2xl shadow-black/50"
          >
            <p className="border-b border-base-800 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">
              Switch project
            </p>
            <ul className="p-1">
              {projects?.map((p) => {
                const active = p.slug === currentSlug;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/app/projects/${p.slug}`);
                      }}
                      role="menuitem"
                      className={`flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2.5 text-[13px] transition-colors ${
                        active
                          ? 'bg-amber-500/15 text-amber-500'
                          : 'text-ink-200 hover:bg-base-800 hover:text-white'
                      }`}
                    >
                      <span className="font-medium">{p.name}</span>
                      <code className="font-mono text-[11px] text-ink-400">{p.slug}</code>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Compare toggle ---------------------------------------------------------

function CompareToggle({ onCompare }: { onCompare: boolean }) {
  if (onCompare) {
    return (
      <Link
        href="/app"
        className="inline-flex items-center gap-2 rounded-md border border-base-700 bg-base-900/40 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300"
      >
        <Home size={14} />
        <span className="hidden sm:inline">Back to app</span>
      </Link>
    );
  }
  return (
    <Link
      href="/app/compare"
      className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-1.5 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
    >
      <GitCompareArrows size={14} />
      <span className="hidden sm:inline">Compare</span>
    </Link>
  );
}
