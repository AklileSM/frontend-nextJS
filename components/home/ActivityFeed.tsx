'use client';

import { formatDistanceToNow, parseISO } from 'date-fns';
import { Box, FileText, Film, FilePlus2, Image as ImageIcon, MapPin, UserMinus, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getProjectActivity } from '@/services/apiClient';
import type { ApiProjectActivityEntry } from '@/types/api';

type Props = {
  projectSlug: string;
  limit?: number;
};

/** Pick out a metadata field by name, returning a string or null without
 *  forcing the caller to type-assert. */
function readStr(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === 'string' ? v : null;
}

type Rendering = {
  Icon: typeof ImageIcon;
  tint: string;
  verb: string;
  target: string;
  context: string | null;
};

/** Map an activity row into the icon, verb, target line, and context line
 *  the feed renders. Unknown actions fall back to a generic rendering so
 *  a new server-side action key never breaks the page. */
function renderActivity(row: ApiProjectActivityEntry): Rendering {
  const m = row.metadata;
  const fileName = readStr(m, 'file_name') ?? '';
  const roomName = readStr(m, 'room_name') ?? '';
  const captureDate = readStr(m, 'capture_date') ?? '';

  switch (row.action) {
    case 'upload.image':
      return {
        Icon: ImageIcon,
        tint: 'text-amber-400',
        verb: 'uploaded an image',
        target: fileName,
        context: [roomName, captureDate].filter(Boolean).join(' · ') || null,
      };
    case 'upload.video':
      return {
        Icon: Film,
        tint: 'text-steel-400',
        verb: 'uploaded a video',
        target: fileName,
        context: [roomName, captureDate].filter(Boolean).join(' · ') || null,
      };
    case 'upload.pointcloud':
      return {
        Icon: Box,
        tint: 'text-violet-300',
        verb: 'uploaded a point cloud',
        target: fileName,
        context: [roomName, captureDate].filter(Boolean).join(' · ') || null,
      };
    case 'upload.pdf':
      return {
        Icon: FileText,
        tint: 'text-ink-200',
        verb: 'uploaded a PDF',
        target: fileName,
        context: [roomName, captureDate].filter(Boolean).join(' · ') || null,
      };
    case 'annotation.create': {
      const flag = readStr(m, 'flag');
      const preview = readStr(m, 'preview') ?? '';
      return {
        Icon: MapPin,
        tint:
          flag === 'safety'
            ? 'text-red-400'
            : flag === 'delayed'
              ? 'text-sky-400'
              : 'text-amber-400',
        verb: 'added an annotation',
        target: fileName || 'a file',
        context: preview ? `“${preview}”` : roomName || null,
      };
    }
    case 'report.publish':
      return {
        Icon: FilePlus2,
        tint: 'text-emerald-400',
        verb: 'published a report',
        target: readStr(m, 'report_label') ?? fileName,
        context: roomName || null,
      };
    case 'member.add':
      return {
        Icon: UserPlus,
        tint: 'text-emerald-400',
        verb: 'added member',
        target: readStr(m, 'added_username') ?? '',
        context: readStr(m, 'role'),
      };
    case 'member.remove':
      return {
        Icon: UserMinus,
        tint: 'text-red-400',
        verb: 'removed member',
        target: readStr(m, 'removed_username') ?? '',
        context: null,
      };
    default:
      return {
        Icon: ImageIcon,
        tint: 'text-ink-300',
        verb: row.action,
        target: '',
        context: null,
      };
  }
}

export function ActivityFeed({ projectSlug, limit = 50 }: Props) {
  const [rows, setRows] = useState<ApiProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProjectActivity(projectSlug, { limit })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Could not load activity.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectSlug, limit]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-start gap-3 rounded-md border border-base-800 bg-base-900/40 px-3 py-2">
            <div className="h-7 w-7 shrink-0 rounded-full bg-base-800" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 rounded bg-base-800" />
              <div className="h-2.5 w-1/3 rounded bg-base-800/70" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-[12px] text-ink-400">
        No activity yet for this project.
      </p>
    );
  }

  return (
    // 380px is enough for ~6 rows on most screens; rows beyond that scroll
    // inside the panel rather than expanding the page.
    <div className="-mr-1 max-h-[380px] overflow-y-auto pr-1">
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const r = renderActivity(row);
          // parseISO + try/catch handles the rare malformed timestamp; we
          // fall back to the raw string rather than crashing the feed.
          let when = row.created_at;
          try {
            when = formatDistanceToNow(parseISO(row.created_at), { addSuffix: true });
          } catch {
            /* keep raw */
          }
          return (
            <li key={row.id} className="flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-base-900/60">
              <span
                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-base-900 ${r.tint}`}
                aria-hidden
              >
                <r.Icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink-100">
                  <span className="font-medium text-white">{row.username}</span>{' '}
                  <span className="text-ink-300">{r.verb}</span>{r.target ? ' ' : ''}
                  {r.target && (
                    <span className="font-medium text-white">{r.target}</span>
                  )}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink-400">
                  {when}
                  {r.context ? ` · ${r.context}` : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
