'use client';

import { useEffect, useState } from 'react';
import { getViewerContext, type ViewerContext } from '@/components/explorer/viewerContext';

const SIDEBAR_SLUG_KEY = 'sidebar.lastProjectSlug';

export function useViewerContext() {
  const [ctx, setCtx] = useState<ViewerContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallbackHref, setFallbackHref] = useState('/app');

  useEffect(() => {
    const loaded = getViewerContext();
    setCtx(loaded);
    if (!loaded) {
      try {
        const slug = localStorage.getItem(SIDEBAR_SLUG_KEY);
        if (slug) setFallbackHref(`/app/projects/${slug}/files`);
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  return { ctx, loading, fallbackHref };
}
