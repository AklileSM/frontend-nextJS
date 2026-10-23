'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchRobotAssistantSpeech } from '@/services/api/robotAssistant';

/* The Web Speech API is not in TypeScript's DOM lib, so only the parts used here are typed. */
type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in the browser to use voice.',
  'service-not-allowed':
    "The browser's speech service isn't available here. It may be switched off for this browser profile.",
  'no-speech': "I didn't hear anything. Press the mic and try again.",
  'audio-capture': 'No microphone was found.',
  network: 'Voice input needs an internet connection: the browser sends the audio to its speech service.',
};

// After the server's voice fails, replies use the browser's voice for this long instead of
// waiting on the server every time.
const SERVER_VOICE_RETRY_MS = 60_000;

/** Replies are written for reading; a few symbols need saying differently. */
export function toSpeech(text: string): string {
  return text
    .replace(/360°/g, '360 degree')
    .replace(/°/g, ' degrees')
    .replace(/\s*→\s*/g, ', then ')
    .replace(/["“”]/g, '');
}

/**
 * Push-to-talk speech input and spoken replies. Recognition uses the browser's speech service
 * (Chrome and Edge; Chrome sends the audio to Google to transcribe it). Replies are spoken by the
 * server's voice (Kokoro), or by the browser's own voice when that isn't available.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechRequestRef = useRef<AbortController | null>(null);
  const serverVoiceDownUntil = useRef(0);

  // Checked after mount: the page is rendered on the server first, where there is no window.
  useEffect(() => setSupported(recognitionCtor() !== null), []);

  const stopSpeaking = useCallback(() => {
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined') return;
      stopSpeaking();
      const spoken = toSpeech(text);
      const speakWithBrowser = () => {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
      };
      if (Date.now() < serverVoiceDownUntil.current) {
        speakWithBrowser();
        return;
      }

      const request = new AbortController();
      speechRequestRef.current = request;
      fetchRobotAssistantSpeech(spoken, request.signal)
        .then((blob) => {
          if (request.signal.aborted) return undefined;
          const audio = new Audio(URL.createObjectURL(blob));
          audio.onended = () => {
            URL.revokeObjectURL(audio.src);
            if (audioRef.current === audio) audioRef.current = null;
          };
          audioRef.current = audio;
          return audio.play();
        })
        .catch((err: unknown) => {
          // Interrupted by a newer reply or by the mic: say nothing.
          if (request.signal.aborted) return;
          // The browser refusing to play sound isn't the server's fault.
          if (!(err instanceof DOMException && err.name === 'NotAllowedError')) {
            serverVoiceDownUntil.current = Date.now() + SERVER_VOICE_RETRY_MS;
          }
          speakWithBrowser();
        })
        .finally(() => {
          if (speechRequestRef.current === request) speechRequestRef.current = null;
        });
    },
    [stopSpeaking],
  );

  const listen = useCallback((onFinal: (text: string) => void) => {
    const Recognition = recognitionCtor();
    if (!Recognition || recognitionRef.current) return;
    // Don't transcribe the assistant's own voice.
    stopSpeaking();

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalText = '';

    recognition.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }
      setInterim(finalText + pending);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setError(ERROR_MESSAGES[event.error] ?? `Voice input stopped (${event.error}).`);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      if (finalText.trim()) onFinal(finalText.trim());
    };

    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError('Voice input could not start.');
    }
  }, [stopSpeaking]);

  const stopListening = useCallback(() => recognitionRef.current?.stop(), []);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      stopSpeaking();
    },
    [stopSpeaking],
  );

  return { supported, listening, interim, error, listen, stopListening, speak };
}
