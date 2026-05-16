'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Box, FileText, Image as ImageIcon, Search, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { searchFiles } from '@/services/apiClient';
import { setViewerContext } from '@/components/explorer/viewerContext';
import type { ApiMediaFile, ApiMyUpload } from '@/types/api';

type Props = {
  projectSlug: string | null;
};

const DEBOUNCE_MS = 200;

function viewerHrefForType(type: string): string {
  if (type === 'pointcloud') return '/app/viewer/point-cloud';
  if (type === 'pdf') return '/app/pdf-viewer';
  return '/app/viewer/static';
}

function TypeIcon({ type }: { type: string }) {
  const size = 14;
  if (type === 'video') return <Video size={size} className="text-steel-400" />;
  if (type === 'pointcloud') return <Box size={size} className="text-violet-300" />;
  if (type === 'pdf') return <FileText size={size} className="text-ink-200" />;
  return <ImageIcon size={size} className="text-amber-500" />;
}

export function GlobalSearch({ projectSlug }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ApiMyUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Global '/' shortcut focuses the search input. Skip when the user is
  // already typing in another input/textarea/contenteditable element — they
  // probably mean a literal '/' there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          (t as HTMLElement).isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Click outside closes the result panel but leaves the query intact.
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [open]);

  // Debounced fetch. Abort the in-flight request on every keystroke so a
  // slow earlier response can't overwrite a fast later one.
  useEffect(() => {
    if (!projectSlug) return;
    const query = q.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      searchFiles(query, projectSlug, ac.signal)
        .then((rows) => {
          if (ac.signal.aborted) return;
          setResults(rows);
          setHighlight(0);
        })
        .catch((err) => {
          if (ac.signal.aborted || (err as DOMException)?.name === 'AbortError') return;
          setResults([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [q, projectSlug]);

  const open_ = open && q.trim().length > 0;

  const openResult = useCallback(
    (row: ApiMyUpload) => {
      if (!projectSlug) return;
      const file: ApiMediaFile = {
        id: row.id,
        src: row.src,
        type: row.media_type as ApiMediaFile['type'],
        file_name: row.file_name,
        full_src: row.full_src,
        capture_date: row.capture_date,
        conversion_status: row.conversion_status ?? null,
      };
      setViewerContext({
        file,
        roomSlug: row.room_slug,
        projectSlug,
        date: row.capture_date,
        origin: 'project',
      });
      setOpen(false);
      inputRef.current?.blur();
      router.push(viewerHrefForType(row.media_type));
    },
    [projectSlug, router],
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = results[highlight];
      if (row) openResult(row);
    }
  };

  const empty = useMemo(
    () => open_ && !loading && results.length === 0 && q.trim().length > 0,
    [open_, loading, results.length, q],
  );

  if (!projectSlug) return null;

  return (
    <div ref={wrapRef} className="relative hidden min-w-0 flex-1 max-w-md md:block">
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => q.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search files…"
          aria-label="Search files in this project"
          className="w-full rounded-md border border-base-700 bg-base-900/40 py-1.5 pl-7 pr-10 text-[13px] text-white placeholder:text-ink-500 outline-none transition-colors focus:border-amber-500"
        />
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-base-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-400"
        >
          /
        </kbd>
      </div>

      <AnimatePresence>
        {open_ && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-md border border-base-700 bg-base-900 shadow-2xl shadow-black/50"
            role="listbox"
          >
            {loading && results.length === 0 ? (
              <p className="px-3 py-3 font-mono text-[11px] text-ink-300">Searching…</p>
            ) : empty ? (
              <p className="px-3 py-3 font-mono text-[11px] text-ink-300">No matches.</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto">
                {results.map((row, idx) => {
                  const isActive = idx === highlight;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setHighlight(idx)}
                        onMouseDown={(e) => {
                          // Use mousedown so the input doesn't lose focus
                          // first (which would close the panel before the
                          // click fires).
                          e.preventDefault();
                          openResult(row);
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                          isActive ? 'bg-base-800' : 'hover:bg-base-800/60'
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded border border-base-700 bg-base-900">
                          {row.media_type === 'image' && row.src ? (
                            <img
                              src={row.src}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">
                              <TypeIcon type={row.media_type} />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-white">{row.file_name}</p>
                          <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink-400">
                            {row.room_name} · {row.capture_date}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
