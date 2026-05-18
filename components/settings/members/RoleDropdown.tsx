'use client';

/** Three-option role dropdown (viewer / editor / owner) used in two places:
 *  the per-row role cell in the members table, and the invite form.
 *
 *  Renders the popup as a fixed-position element so it escapes parent
 *  overflow contexts (the table cell would otherwise clip it). */

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ApiProjectMember } from '@/types/api';

const ROLES: ApiProjectMember['role'][] = ['viewer', 'editor', 'owner'];

function dotColor(r: ApiProjectMember['role']) {
  return r === 'owner' ? 'bg-amber-400' : r === 'editor' ? 'bg-steel-400' : 'bg-ink-500';
}

export function RoleDropdown({
  value,
  onChange,
}: {
  value: ApiProjectMember['role'];
  onChange: (r: ApiProjectMember['role']) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(true);
  };

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={openDropdown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex w-full items-center justify-between gap-1.5 rounded-md border border-base-700 bg-base-950 px-2.5 py-1 text-[12px] text-white transition-colors hover:border-base-600"
      >
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor(value)}`} />
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
        <ChevronDown size={11} className="text-ink-500" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            className="fixed z-50 rounded-md border border-base-700 bg-base-900 py-1 shadow-xl"
          >
            {ROLES.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onMouseDown={() => { onChange(r); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-[12px] transition-colors hover:bg-base-800 ${
                    r === value ? 'text-white' : 'text-ink-400'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor(r)}`} />
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
