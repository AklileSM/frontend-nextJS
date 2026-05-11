'use client';

import Link from 'next/link';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { analyzeImage } from '@/services/apiClient';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { useViewerContext } from './useViewerContext';
import { BackSide, SRGBColorSpace, TextureLoader } from 'three';

function PanoramaSphere({ src }: { src: string }) {
  const { gl } = useThree();
  const texture = useLoader(TextureLoader, src);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  return (
    <mesh>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={BackSide} />
    </mesh>
  );
}

export function PanoramaViewer() {
  const { ctx, loading } = useViewerContext();
  const [aiDescription, setAiDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [panoramaSrc, setPanoramaSrc] = useState('');
  const [debugging, setDebugging] = useState(false);

  const imageSrc = ctx?.file.full_src || ctx?.file.src || '';

  const backHref = useMemo(() => {
    if (!ctx) return '/app';
    return ctx.origin === 'project'
      ? `/app/projects/a6-stern?date=${encodeURIComponent(ctx.date)}`
      : `/app/room-explorer?room=${encodeURIComponent(ctx.roomSlug)}`;
  }, [ctx]);

  const runAi = async () => {
    if (!ctx || analyzing) return;
    setAnalyzing(true);
    try {
      const result = await analyzeImage(ctx.file.full_src || ctx.file.src, ctx.file.id);
      setAiDescription(result);
      toast.success('AI analysis complete.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!ctx) return;
    if (ctx.file.type !== 'image') {
      setImageReady(false);
      setImageError('Panorama viewer only supports image files.');
      return;
    }
    setImageReady(false);
    setImageError(null);
    const img = new Image();
    img.onload = () => {
      setPanoramaSrc(imageSrc);
      setImageReady(true);
    };
    img.onerror = () =>
      setImageError('Could not load this image as a panorama. Try opening it in Static viewer.');
    img.src = imageSrc;
  }, [ctx, imageSrc]);

  const runDebug = async () => {
    if (!ctx || debugging) return;
    const info: string[] = [];
    setDebugging(true);
    try {
      info.push(`file.type=${ctx.file.type}`);
      info.push(`file.src=${ctx.file.src}`);
      info.push(`file.full_src=${ctx.file.full_src ?? '(null)'}`);
      info.push(`resolved imageSrc=${imageSrc}`);
      info.push(`resolved panoramaSrc=${panoramaSrc || '(not prepared yet)'}`);

      const probe = new Image();
      const imageProbe = await new Promise<{ ok: boolean; width?: number; height?: number; error?: string }>(
        (resolve) => {
          probe.onload = () => resolve({ ok: true, width: probe.naturalWidth, height: probe.naturalHeight });
          probe.onerror = () => resolve({ ok: false, error: 'Image decode/load failed in browser.' });
          probe.src = imageSrc;
        },
      );
      if (imageProbe.ok) {
        info.push(`image probe ok: ${imageProbe.width}x${imageProbe.height}`);
      } else {
        info.push(`image probe failed: ${imageProbe.error}`);
      }

      try {
        const res = await fetch(imageSrc, { method: 'GET' });
        info.push(`fetch status=${res.status} ${res.statusText}`);
        info.push(`content-type=${res.headers.get('content-type') ?? '(missing)'}`);
        info.push(`content-length=${res.headers.get('content-length') ?? '(missing)'}`);
        if (res.ok) {
          const blob = await res.blob();
          info.push(`blob.type=${blob.type || '(empty)'}`);
          info.push(`blob.size=${blob.size}`);
        }
      } catch (err) {
        info.push(`fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      console.group('[SiteScope] Panorama debug');
      for (const line of info) console.info(line);
      console.groupEnd();
      setDebugging(false);
    }
  };

  if (loading) return <div className="p-6 text-ink-300">Loading viewer...</div>;
  if (!ctx) return <div className="p-6 text-ink-300">No file selected. Open a file from explorer first.</div>;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4 rounded-md border border-base-800 bg-base-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-[26px] text-white">{ctx.file.file_name}</h1>
            <p className="text-[12px] text-ink-300">Panorama viewer · orbit controls · AI</p>
          </div>
          <Link href={backHref} className="rounded-md border border-base-700 px-3 py-1.5 text-[13px] text-white">
            Back
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runDebug}
            disabled={debugging}
            className="rounded border border-base-700 px-2 py-1 text-[12px] text-white hover:border-ink-300 disabled:opacity-50"
          >
            {debugging ? 'Running debug...' : 'Run Panorama Debug'}
          </button>
          <Link
            href="/app/viewer/static"
            className="rounded border border-base-700 px-2 py-1 text-[12px] text-white hover:border-ink-300"
          >
            Open in Static
          </Link>
          <button
            type="button"
            onClick={runAi}
            disabled={analyzing}
            className="rounded border border-base-700 px-2 py-1 text-[12px] disabled:opacity-50"
          >
            {analyzing ? 'Running AI...' : 'Run AI'}
          </button>
        </div>

        <div className="h-[70vh] overflow-hidden rounded-md border border-base-800 bg-black/30">
          {imageReady && !imageError ? (
            <Canvas camera={{ position: [0, 0, 20], fov: 70 }}>
              <PanoramaSphere src={panoramaSrc || imageSrc} />
              <OrbitControls enablePan={true} enableZoom={false} enableDamping={true} dampingFactor={0.3} />
            </Canvas>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6 text-center text-[13px] text-ink-300">
              {imageError ?? 'Loading panorama image...'}
            </div>
          )}
        </div>
        {imageError && (
          <div className="rounded-md border border-base-800 bg-base-950/60 p-3 text-[12px] text-ink-300">
            <p>{imageError}</p>
            <img
              src={imageSrc}
              alt={ctx.file.file_name}
              className="mt-3 max-h-40 w-full rounded border border-base-800 object-contain"
            />
          </div>
        )}

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
