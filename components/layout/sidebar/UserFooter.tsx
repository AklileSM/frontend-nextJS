'use client';

/** Sticky footer at the bottom of the sidebar showing the current user's
 *  avatar (initials), username, and role chip. Collapses to just the avatar
 *  when the sidebar is in icon-only mode. */

export function UserFooter({
  expanded,
  username,
  role,
}: {
  expanded: boolean;
  username: string;
  role: string;
}) {
  const initials = (() => {
    const parts = username.split(/[\s._-]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return username.slice(0, 2).toUpperCase();
  })();

  return (
    <div className={`border-t border-base-800 px-3 py-3 ${expanded ? '' : 'lg:px-2 lg:py-3'}`}>
      <div className={`flex items-center gap-3 ${expanded ? '' : 'lg:justify-center'}`}>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500 font-display text-[12px] font-bold text-base-950">
          {initials}
        </span>
        <div className={`min-w-0 flex-1 ${expanded ? 'block' : 'lg:hidden'}`}>
          <div className="truncate text-[13px] font-medium text-white">{username}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">{role}</div>
        </div>
      </div>
    </div>
  );
}
