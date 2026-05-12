'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Inner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/projects/${slug}/settings${qs ? `?${qs}` : ''}`);
  }, [slug, searchParams, router]);

  return null;
}

export default function SettingsRedirect() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
