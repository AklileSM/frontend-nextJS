'use client';

import { useEffect, useState } from 'react';
import { getViewerContext, type ViewerContext } from '@/components/explorer/viewerContext';

export function useViewerContext() {
  const [ctx, setCtx] = useState<ViewerContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCtx(getViewerContext());
    setLoading(false);
  }, []);

  return { ctx, loading };
}
