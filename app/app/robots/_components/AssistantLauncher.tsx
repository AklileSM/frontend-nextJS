'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Mic, RotateCcw, Send, Sparkles, Square, X } from 'lucide-react';
import type { AssistantMessage } from '../_hooks/useRobotAssistant';

type Voice = {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
};

type Props = {
  messages: AssistantMessage[];
  sending: boolean;
  onSend: (text: string) => void;
  onReset: () => void;
  disabled: boolean;
  voice: Voice;
};

const EXAMPLES = ['Go to room1 and take a 360 photo', 'Create a schedule', 'What waypoints are there?', 'Stop'];

const NUDGES = [
  'Hi! I can help you run the robot or answer questions.',
  'Need a capture? Tell me where to send the robot.',
  'Want a capture every morning? I can set up a schedule.',
  'You can type to me, or press the mic and just talk.',
];
const FIRST_NUDGE_MS = 4000;
const NUDGE_EVERY_MS = 90 * 1000;
const NUDGE_VISIBLE_MS = 10000;
/* Closing a nudge with its x pauses them for a while; opening the chat only pauses them until it closes. */
const SNOOZE_MS = 10 * 60 * 1000;
const SNOOZE_KEY = 'sitescope-assistant-nudges-snoozed-until';

function snoozedUntil(): number {
  try {
    return Number(window.sessionStorage.getItem(SNOOZE_KEY) || 0);
  } catch {
    return 0;
  }
}

function snooze(): number {
  const until = Date.now() + SNOOZE_MS;
  try {
    window.sessionStorage.setItem(SNOOZE_KEY, String(until));
  } catch {
    // Storage can be unavailable (private windows); the snooze then lasts until the page reloads.
  }
  return until;
}

/**
 * Floating assistant: a round button in the bottom-right corner that opens a chat panel. While
 * closed it occasionally pops a short speech bubble, and shows the assistant's latest reply there
 * when one arrives in the background (for example when a waiting mission starts).
 */
export function AssistantLauncher({ messages, sending, onSend, onReset, disabled, voice }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [bubble, setBubble] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nudgeIndex = useRef(0);
  const snoozed = useRef(0);
  const everOpened = useRef(false);
  const reduceMotion = useReducedMotion();

  const unread = open ? 0 : messages.slice(seen).filter((message) => message.role === 'assistant').length;

  useEffect(() => {
    snoozed.current = snoozedUntil();
  }, []);

  // While the chat is closed, a nudge pops up on its own: soon after the page opens, then every
  // so often, each time with the button calling for attention.
  useEffect(() => {
    if (open) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      if (Date.now() < snoozed.current) return;
      setBubble(NUDGES[nudgeIndex.current % NUDGES.length]);
      nudgeIndex.current += 1;
      hide = setTimeout(() => setBubble(null), NUDGE_VISIBLE_MS);
    };
    // Soon after the page opens; after the chat was used, only at the regular interval.
    const first = setTimeout(show, everOpened.current ? NUDGE_EVERY_MS : FIRST_NUDGE_MS);
    const every = setInterval(show, NUDGE_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      if (hide) clearTimeout(hide);
    };
  }, [open]);

  // A reply that lands while the chat is closed shows in the bubble instead of a nudge.
  useEffect(() => {
    // A new chat (or a project/robot switch) shortens the list; restart the unread count with it.
    if (messages.length < seen) setSeen(messages.length);
    if (open) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && messages.length > seen) setBubble(last.text);
  }, [messages, open, seen]);

  useEffect(() => {
    if (!open) return;
    setSeen(messages.length);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, sending]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openChat = () => {
    everOpened.current = true;
    setBubble(null);
    setOpen(true);
  };

  const dismissBubble = () => {
    snoozed.current = snooze();
    setBubble(null);
  };

  const calling = !open && Boolean(bubble);

  const submit = (text: string) => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open ? (
          <motion.section
            key="panel"
            role="dialog"
            aria-label="Assistant"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="flex h-[min(600px,calc(100vh-7rem))] w-[min(400px,calc(100vw-2.5rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-base-700 bg-base-900 shadow-2xl shadow-black/50"
          >
            <header className="flex items-center gap-3 border-b border-base-800 px-4 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-base-950">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-white">Assistant</p>
                <p className="truncate text-[11px] text-ink-400">Ask anything, or tell the robot where to go.</p>
              </div>
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={onReset}
                  title="New chat"
                  className="rounded-lg p-1.5 text-ink-400 transition hover:bg-base-800 hover:text-white"
                >
                  <RotateCcw size={14} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-base-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-[13px] text-ink-300">Hi! How can I help?</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        disabled={disabled}
                        onClick={() => submit(example)}
                        className="rounded-full border border-base-700 px-3 py-1.5 text-[12px] text-ink-300 transition hover:border-amber-500/50 hover:text-white disabled:opacity-50"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-amber-500/15 text-amber-50'
                          : message.error
                            ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                            : 'border border-base-800 bg-base-950 text-ink-100'
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))
              )}
              {sending ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-base-800 bg-base-950 px-3.5 py-2 text-[13px] text-ink-400">
                    Thinking…
                  </div>
                </div>
              ) : null}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
              }}
              className="flex items-center gap-2 border-t border-base-800 px-3 py-3"
            >
              <button
                type="button"
                onClick={voice.listening ? voice.onStop : voice.onStart}
                disabled={disabled || !voice.supported || (sending && !voice.listening)}
                title={
                  !voice.supported
                    ? 'Voice input needs Chrome or Edge'
                    : voice.listening
                      ? 'Stop listening'
                      : 'Press and speak'
                }
                aria-pressed={voice.listening}
                className={`inline-flex shrink-0 items-center justify-center rounded-lg border p-2 transition disabled:opacity-40 ${
                  voice.listening
                    ? 'animate-pulse border-red-500/50 bg-red-500/15 text-red-200'
                    : 'border-base-700 text-ink-300 hover:border-amber-500/50 hover:text-white'
                }`}
              >
                {voice.listening ? <Square size={14} /> : <Mic size={14} />}
              </button>
              <input
                ref={inputRef}
                value={voice.listening ? voice.interim : draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  disabled ? 'Pick a project and a robot first' : voice.listening ? 'Listening…' : 'Message the assistant…'
                }
                disabled={disabled}
                readOnly={voice.listening}
                maxLength={1000}
                className="min-w-0 flex-1 rounded-lg border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white placeholder:text-ink-500 focus:border-amber-500/60 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={disabled || !draft.trim()}
                title="Send"
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-500 p-2 text-base-950 transition hover:bg-amber-400 disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </form>
            {voice.error ? <p className="px-4 pb-3 text-[12px] text-red-300">{voice.error}</p> : null}
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!open && bubble ? (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            style={{ transformOrigin: 'bottom right' }}
            className="relative max-w-[min(280px,calc(100vw-2.5rem))] rounded-2xl rounded-br-sm border border-base-700 bg-base-900 py-2.5 pl-3.5 pr-8 text-[13px] leading-snug text-ink-100 shadow-xl shadow-black/40"
          >
            <button type="button" onClick={openChat} className="line-clamp-3 text-left">
              {bubble}
            </button>
            <button
              type="button"
              onClick={dismissBubble}
              title="Dismiss"
              className="absolute right-1.5 top-1.5 rounded p-1 text-ink-500 transition hover:text-white"
            >
              <X size={12} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => (open ? setOpen(false) : openChat())}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        animate={calling && !reduceMotion ? { rotate: [0, -14, 14, -10, 10, -4, 0], scale: [1, 1.12, 1.12, 1.08, 1.08, 1] } : { rotate: 0, scale: 1 }}
        transition={calling && !reduceMotion ? { duration: 0.9, repeat: 2, repeatDelay: 1.6 } : { duration: 0.2 }}
        className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-base-950 shadow-lg shadow-black/40 transition-colors hover:bg-amber-400 active:scale-95"
      >
        {calling && !reduceMotion ? (
          <span aria-hidden className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-amber-400/50" />
        ) : null}
        {open ? <X size={22} /> : <Sparkles size={24} />}
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-base-950 bg-red-500 px-1 font-mono text-[10px] font-semibold text-white">
            {unread}
          </span>
        ) : null}
      </motion.button>
    </div>
  );
}
