'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

type MenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

type Props = {
  items: MenuItem[];
  onOpenChange?: (open: boolean) => void;
  placement?: 'top' | 'bottom';
};

export function MoreMenu({ items, onOpenChange, placement = 'bottom' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded border border-base-700 text-ink-400 transition-colors hover:border-ink-300 hover:text-white"
        aria-label="More options"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className={`absolute right-0 z-50 min-w-[130px] rounded-md border border-base-700 bg-base-900 py-1 shadow-xl shadow-black/40 ${placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => { item.onClick(); setOpen(false); }}
              className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-base-800 ${
                item.danger ? 'text-red-300' : 'text-ink-200 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
