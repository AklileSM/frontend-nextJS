'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const SIDEBAR_SLUG_KEY = 'sidebar.lastProjectSlug';

export const dynamic = 'force-dynamic';

export default function AppHomePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const slug = sessionStorage.getItem(SIDEBAR_SLUG_KEY);
      if (slug) {
        router.replace(`/app/projects/${slug}`);
        return;
      }
    } catch { /* ignore */ }
    router.replace('/projects');
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={18} className="animate-spin text-ink-500" />
    </div>
  );
}
