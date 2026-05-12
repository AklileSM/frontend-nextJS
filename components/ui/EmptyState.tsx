import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { FolderOpen } from 'lucide-react';

type Action =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type Props = {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: Action;
};

export function EmptyState({ icon: Icon = FolderOpen, title, body, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-base-700 bg-base-900/20 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-base-700 bg-base-900">
        <Icon size={20} className="text-ink-400" />
      </div>
      <p className="mt-4 text-[14px] font-medium text-white">{title}</p>
      {body && (
        <p className="mt-1.5 max-w-[36ch] text-[13px] leading-[1.6] text-ink-300">{body}</p>
      )}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="mt-6 inline-flex items-center rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-6 inline-flex items-center rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
