'use client';

import {
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/landing/Logo';
import styles from './demo.module.css';

const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75];

function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '0:00';
  const seconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function DemoPlayer() {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState(false);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2400);
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setError(true);
      }
    } else {
      video.pause();
    }
    revealControls();
  }, [revealControls]);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch {
      // Fullscreen may be unavailable in an embedded browser; playback remains usable.
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'k') {
      event.preventDefault();
      void togglePlayback();
    } else if (key === 'arrowright') {
      event.preventDefault();
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
    } else if (key === 'arrowleft') {
      event.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (key === 'm') {
      video.muted = !video.muted;
      setMuted(video.muted);
    } else if (key === 'f') {
      void toggleFullscreen();
    }
    revealControls();
  };

  const seekPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-base-950 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(245,158,11,0.12),transparent_42%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
        <header className="flex items-center justify-between border-b border-base-800 pb-5">
          <Logo />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400 sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,.8)]" />
            Product demo
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-8 sm:py-10 lg:py-12">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-500">Site intelligence, in context</p>
              <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] sm:text-[36px]">
                SiteScope platform overview
              </h1>
            </div>
            <p className="max-w-[42ch] text-[13px] leading-6 text-ink-300 sm:text-right">
              From field capture to a structured, reviewable construction record.
            </p>
          </div>

          <div
            ref={shellRef}
            role="region"
            aria-label="SiteScope demo video player"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onMouseMove={revealControls}
            onMouseLeave={() => playing && setControlsVisible(false)}
            onTouchStart={revealControls}
            className="group relative aspect-video w-full overflow-hidden rounded-xl border border-base-700 bg-black shadow-[0_28px_90px_rgba(0,0,0,.45)] outline-none ring-amber-500/60 focus-visible:ring-2"
          >
            <video
              ref={videoRef}
              src="/demo/demo.mp4"
              preload="metadata"
              playsInline
              onClick={() => void togglePlayback()}
              onDoubleClick={() => void toggleFullscreen()}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
              onDurationChange={(event) => setDuration(event.currentTarget.duration)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onPlay={() => {
                setPlaying(true);
                setError(false);
                revealControls();
              }}
              onPause={() => {
                setPlaying(false);
                setControlsVisible(true);
              }}
              onWaiting={() => setWaiting(true)}
              onPlaying={() => setWaiting(false)}
              onEnded={() => {
                setPlaying(false);
                setControlsVisible(true);
              }}
              onError={() => setError(true)}
              className="h-full w-full cursor-pointer object-contain"
            />

            {!playing && !error && (
              <button
                type="button"
                onClick={() => void togglePlayback()}
                aria-label="Play demo"
                className="absolute left-1/2 top-1/2 z-10 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-base-950/75 text-white shadow-2xl backdrop-blur-md transition hover:scale-105 hover:border-amber-500/70 hover:bg-amber-500 hover:text-base-950 sm:h-20 sm:w-20"
              >
                <Play className="ml-1" size={28} fill="currentColor" />
              </button>
            )}

            {waiting && !error && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-black/20">
                <LoaderCircle className="animate-spin text-amber-500" size={30} />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-base-950/95 px-6 text-center">
                <div>
                  <p className="font-display text-xl font-semibold">The demo could not be loaded</p>
                  <p className="mt-2 text-sm text-ink-300">Check the video file, then try again.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setError(false);
                      videoRef.current?.load();
                    }}
                    className="mt-5 inline-flex items-center gap-2 rounded-md border border-base-600 bg-base-900 px-4 py-2 text-sm text-white transition hover:border-amber-500/60"
                  >
                    <RotateCcw size={15} /> Retry
                  </button>
                </div>
              </div>
            )}

            <div
              className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-3 pb-3 pt-16 transition-opacity duration-200 sm:px-5 sm:pb-4 ${
                controlsVisible && !error ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <label className="block" aria-label="Video progress">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step="0.01"
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (videoRef.current) videoRef.current.currentTime = next;
                    setCurrentTime(next);
                  }}
                  className={styles.timeline}
                  style={{ '--progress': `${seekPercent}%` } as React.CSSProperties}
                />
              </label>

              <div className="mt-2 flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => void togglePlayback()}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="grid h-9 w-9 place-items-center rounded-md text-white transition hover:bg-white/10"
                >
                  {playing ? <Pause size={19} fill="currentColor" /> : <Play className="ml-0.5" size={19} fill="currentColor" />}
                </button>

                <div className="group/volume flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const video = videoRef.current;
                      if (!video) return;
                      video.muted = !video.muted;
                      setMuted(video.muted);
                    }}
                    aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
                    className="grid h-9 w-9 place-items-center rounded-md text-white transition hover:bg-white/10"
                  >
                    {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <label className="hidden w-0 overflow-hidden transition-all group-hover/volume:w-20 group-focus-within/volume:w-20 sm:block" aria-label="Volume">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        const video = videoRef.current;
                        if (!video) return;
                        video.volume = next;
                        video.muted = false;
                        setVolume(next);
                        setMuted(false);
                      }}
                      className={styles.volume}
                    />
                  </label>
                </div>

                <span className="ml-1 font-mono text-[11px] tabular-nums text-ink-200 sm:text-[12px]">
                  {formatTime(currentTime)} <span className="text-ink-400">/ {formatTime(duration)}</span>
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
                      const next = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
                      if (videoRef.current) videoRef.current.playbackRate = next;
                      setPlaybackRate(next);
                    }}
                    aria-label={`Playback speed ${playbackRate} times`}
                    title="Change playback speed"
                    className="h-9 min-w-10 rounded-md px-2 font-mono text-[11px] text-ink-100 transition hover:bg-white/10 hover:text-white"
                  >
                    {playbackRate}×
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    className="grid h-9 w-9 place-items-center rounded-md text-white transition hover:bg-white/10"
                  >
                    {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
            <span>Demo preview · placeholder footage</span>
            <span className="hidden sm:inline">Space to play · arrows to seek · F for fullscreen</span>
          </div>
        </section>
      </div>
    </main>
  );
}
