'use client';

/** Vertical nav rail used by the Drafts and Files tabs to switch between
 *  sub-views (Viewer / Comparison drafts; Images / Videos / PDFs).
 *  The active rail has an amber left-edge bar and a count chip on the right. */

type SideRailTab<T extends string> = { id: T; label: string; count?: number };

export function SideRail<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly SideRailTab<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="space-y-0.5 border-r border-base-800 pr-3">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`relative flex w-full items-center justify-between rounded px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${
              isActive
                ? 'bg-base-900 text-white'
                : 'text-ink-400 hover:bg-base-900/40 hover:text-white'
            }`}
          >
            <span>{t.label}</span>
            {typeof t.count === 'number' && (
              <span className={`font-mono text-[10px] ${isActive ? 'text-amber-400' : 'text-ink-500'}`}>
                {t.count}
              </span>
            )}
            {isActive && (
              <span className="absolute -left-px top-1.5 bottom-1.5 w-[2px] rounded bg-amber-500" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
