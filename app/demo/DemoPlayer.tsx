'use client';

import {
  ArrowRight,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/landing/Logo';
import styles from './demo.module.css';

const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75];

// `lock` was dropped from TypeScript's DOM lib, and `webkitEnterFullscreen` is Safari-only.
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
};
type WebkitVideoElement = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '0:00';
  const seconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function DemoPlayer() {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);
  // Captured on pointerdown, before the shell's touchstart handler reveals the controls.
  const tapRef = useRef({ touch: false, controlsWereVisible: true });
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
    const video = videoRef.current as WebkitVideoElement | null;
    if (!shell) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (shell.requestFullscreen) {
        await shell.requestFullscreen();
        // Phones stay in portrait unless the orientation is locked explicitly. Locking is only
        // permitted while fullscreen and is unsupported on some browsers, so failures are ignored.
        const orientation = screen.orientation as LockableScreenOrientation | undefined;
        if (window.matchMedia('(pointer: coarse)').matches && orientation?.lock) {
          await orientation.lock('landscape').catch(() => {});
        }
      } else if (video?.webkitEnterFullscreen) {
        // iPhone Safari has no element fullscreen; its native video fullscreen rotates with the device.
        video.webkitEnterFullscreen();
      }
    } catch {
      // Fullscreen may be unavailable in an embedded browser; playback remains usable.
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === shellRef.current;
      setFullscreen(isFullscreen);
      if (!isFullscreen) screen.orientation?.unlock?.();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // `timeupdate` is intentionally infrequent in several browsers. Sample the media clock while
  // playing so the custom progress indicator moves continuously instead of jumping every second.
  useEffect(() => {
    if (!playing) return;
    const updateProgress = () => {
      if (videoRef.current && !scrubbingRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
      animationFrameRef.current = window.requestAnimationFrame(updateProgress);
    };
    animationFrameRef.current = window.requestAnimationFrame(updateProgress);
    return () => {
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [playing]);

  const seekToClientX = useCallback((clientX: number) => {
    const video = videoRef.current;
    const timeline = timelineRef.current;
    if (!video || !timeline) return;
    const mediaDuration = Number.isFinite(video.duration) ? video.duration : duration;
    if (!mediaDuration || mediaDuration <= 0) return;
    const bounds = timeline.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const nextTime = ratio * mediaDuration;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [duration]);

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
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-base-950 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />

      <header className="sticky top-0 z-40 border-b border-base-800/80 bg-base-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4 sm:h-16 sm:px-8 lg:px-12">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="hidden rounded-md px-3 py-2 text-[14px] font-medium text-ink-200 transition-colors hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-amber-500 px-3.5 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 sm:px-4 sm:text-[14px]"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-[1280px] px-4 sm:px-8 lg:px-12">
        <section className="pb-16 pt-10 sm:pb-24 sm:pt-16 lg:pt-20">
          <div className="mx-auto mb-7 max-w-[760px] text-center sm:mb-10">
            <h1 className="font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.025em] text-white sm:mt-5 sm:text-[48px] lg:text-[58px]">
              See <span className="text-amber-500">SiteScope</span> in action
            </h1>
            <p className="mx-auto mt-4 max-w-[56ch] text-[15px] leading-[1.65] text-ink-300 sm:mt-5 sm:text-[17px]">
              Follow a capture from site to a date-indexed, room-by-room record, opened in the
              right viewer and turned into a defensible PDF report.
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
            className="group relative -mx-4 aspect-video overflow-hidden border-y border-base-800 bg-black shadow-[0_28px_90px_rgba(0,0,0,.5)] outline-none ring-amber-500/60 focus-visible:ring-2 sm:mx-0 sm:rounded-2xl sm:border sm:border-base-700 sm:ring-offset-0 [&:fullscreen]:mx-0 [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
          >
            <video
              ref={videoRef}
              src="/demo/demo.mp4"
              preload="metadata"
              playsInline
              onPointerDown={(event) => {
                tapRef.current = { touch: event.pointerType === 'touch', controlsWereVisible: controlsVisible };
              }}
              onClick={() => {
                // On touch screens a tap toggles the controls; the play/pause buttons handle playback.
                if (!tapRef.current.touch) {
                  void togglePlayback();
                } else if (tapRef.current.controlsWereVisible) {
                  if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                  setControlsVisible(false);
                } else {
                  revealControls();
                }
              }}
              onDoubleClick={() => void toggleFullscreen()}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
              onDurationChange={(event) => setDuration(event.currentTarget.duration)}
              onCanPlay={(event) => setDuration(event.currentTarget.duration)}
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
                className="absolute left-1/2 top-1/2 z-10 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 text-base-950 shadow-[0_0_0_8px_rgba(245,158,11,.18),0_18px_40px_rgba(0,0,0,.5)] transition hover:scale-105 hover:bg-amber-400 active:scale-95 sm:h-20 sm:w-20"
              >
                <Play className="ml-1 h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" />
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
              className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-1 pt-10 transition-opacity duration-200 sm:px-5 sm:pb-4 sm:pt-16 ${
                // The gradient overlaps the centre play button on short (mobile) players, so only
                // the controls themselves accept input.
                controlsVisible && !error ? 'pointer-events-none opacity-100 [&>*]:pointer-events-auto' : 'pointer-events-none opacity-0'
              }`}
            >
              <div
                ref={timelineRef}
                role="slider"
                tabIndex={0}
                aria-label="Video progress"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration || 0)}
                aria-valuenow={Math.round(currentTime)}
                aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
                onPointerDown={(event) => {
                  scrubbingRef.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  seekToClientX(event.clientX);
                  revealControls();
                }}
                onPointerMove={(event) => {
                  if (scrubbingRef.current) seekToClientX(event.clientX);
                }}
                onPointerUp={(event) => {
                  seekToClientX(event.clientX);
                  scrubbingRef.current = false;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  revealControls();
                }}
                onPointerCancel={() => {
                  scrubbingRef.current = false;
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  event.stopPropagation();
                  const video = videoRef.current;
                  if (!video) return;
                  const delta = event.key === 'ArrowRight' ? 5 : -5;
                  const next = Math.min(video.duration || 0, Math.max(0, video.currentTime + delta));
                  video.currentTime = next;
                  setCurrentTime(next);
                }}
                className={styles.timeline}
              >
                <span className={styles.timelineRail}>
                  <span className={styles.timelineProgress} style={{ width: `${seekPercent}%` }} />
                  <span className={styles.timelineThumb} style={{ left: `${seekPercent}%` }} />
                </span>
              </div>

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

          <div className="mt-10 text-center sm:mt-12">
            <Link
              href="/"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-5 py-3 text-[14px] font-semibold text-base-950 transition-colors hover:bg-amber-400 sm:w-auto"
            >
              Learn more
              <ArrowRight size={15} strokeWidth={2.2} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
