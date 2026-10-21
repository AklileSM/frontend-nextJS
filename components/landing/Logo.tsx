import Link from 'next/link';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label="SiteScope home"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/sitescope-icon-orange.svg" alt="" aria-hidden className="h-7 w-7" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/sitescope-wordmark-color-on-dark.svg" alt="" aria-hidden className="h-[21px] w-auto" />
    </Link>
  );
}
