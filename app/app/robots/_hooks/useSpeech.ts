'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

/** Replies are written for reading; a few symbols need saying differently. */
export function toSpeech(text: string): string {
  return text
    .replace(/360°/g, '360 degree')
    .replace(/°/g, ' degrees')
    .replace(/\s*→\s*/g, ', then ')
    .replace(/["“”]/g, '');
}

/**
 * Push-to-talk speech input and spoken replies, using the browser's built-in speech services.
 * Recognition works in Chrome and Edge; Chrome sends the audio to Google to transcribe it.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);

  // Checked after mount: the page is rendered on the server first, where there is no window.
  useEffect(() => setSupported(recognitionCtor() !== null), []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(toSpeech(text));
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, []);

  const listen = useCallback((onFinal: (text: string) => void) => {
    const Recognition = recognitionCtor();
    if (!Recognition || recognitionRef.current) return;
    // Don't transcribe the assistant's own voice.
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

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
  }, []);

  const stopListening = useCallback(() => recognitionRef.current?.stop(), []);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported, listening, interim, error, listen, stopListening, speak };
}
