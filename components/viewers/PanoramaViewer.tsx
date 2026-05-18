'use client';

import Link from 'next/link';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { useViewerContext } from './useViewerContext';
import { backHrefFor } from '@/components/explorer/viewerContext';
import { BackSide, SRGBColorSpace, TextureLoader } from 'three';

function PanoramaSphere({ src, onLoad }: { src: string; onLoad: () => void }) {
  const { gl } = useThree();
  const texture = useLoader(TextureLoader, src);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <mesh>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={BackSide} />
    </mesh>
  );
}

export function PanoramaViewer() {
  const { ctx, loading, fallbackHref } = useViewerContext();
  const [aiDescription, setAiDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [sphereVisible, setSphereVisible] = useState(false);

  const imageSrc = ctx?.file.full_src || ctx?.file.src || '';

  const backHref = useMemo(() => (ctx ? backHrefFor(ctx) : fallbackHref), [ctx, fallbackHref]);

  useEffect(() => {
    setSphereVisible(false);
  }, [imageSrc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.history.back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return <div className="p-6 text-ink-300">Loading viewer…</div>;
  if (!ctx) return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-[14px] text-ink-300">No file selected, open a file from the explorer.</p>
      <Link href={fallbackHref} className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400">
        Back to Explorer
      </Link>
    </div>
  );

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4 rounded-md border border-base-800 bg-base-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[12px] tracking-[0.22em] text-amber-500">Panorama Viewer</p>
            <h1 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.015em] text-white sm:text-[26px]">{ctx.file.file_name}</h1>
          </div>
          <Link href={backHref} className="rounded-md border border-base-700 px-3 py-1.5 text-[13px] text-white">
            Back
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/viewer/static"
            className="rounded border border-base-700 px-2 py-1 text-[12px] text-white hover:border-ink-300"
          >
            Open in Static
          </Link>
          
        </div>

        <div className="relative h-[70vh] overflow-hidden rounded-md border border-base-800 bg-black/30">
          {!sphereVisible && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-300">
              Loading panorama image…
            </div>
          )}
          {imageSrc && (
            <Canvas camera={{ position: [0, 0, 20], fov: 70 }}>
              <Suspense fallback={null}>
                <PanoramaSphere src={imageSrc} onLoad={() => setSphereVisible(true)} />
              </Suspense>
              <OrbitControls enablePan={true} enableZoom={false} enableDamping={true} dampingFactor={0.3} />
            </Canvas>
          )}
        </div>

        {aiDescription && (
          <div className="rounded-md border border-base-800 bg-base-950/60 p-3 text-[13px] text-ink-200">
            <p className="mb-1 font-medium text-white">AI description</p>
            <p>{aiDescription}</p>
          </div>
        )}
      </section>

      <ReportBuilder
        file={ctx.file}
        viewerKind="panorama"
        aiDescription={aiDescription}
        state={{ mode: 'panorama' }}
        viewerContext={{ roomSlug: ctx.roomSlug, date: ctx.date }}
      />
    </div>
  );
}
