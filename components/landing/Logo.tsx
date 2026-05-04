import Link from 'next/link';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label="SiteScope home"
    >
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] bg-amber-500 font-mono text-[11px] font-medium text-base-950"
      >
        SS
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight text-white">
        SiteScope
      </span>
    </Link>
  );
}
