import { useCallback, useEffect, useRef, useState } from 'react';

type AnySpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: {
    results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }> & { isFinal?: boolean }>;
    resultIndex: number;
  }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function getRecognition(): AnySpeechRecognition | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  return new SR() as AnySpeechRecognition;
}

export function useSpeechToText(lang = 'vi-VN') {
  const recRef = useRef<AnySpeechRecognition | null>(null);
  const manualStopRef = useRef(false);
  const onFinalRef = useRef<((text: string) => void) | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const createAndStart = useCallback(() => {
    const rec = getRecognition();
    if (!rec) return null;
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i] as any;
        const transcript = res[0].transcript as string;
        if (res.isFinal) {
          if (onFinalRef.current && transcript.trim()) {
            onFinalRef.current(transcript.trim());
          }
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setError(e.error || 'Lỗi ghi âm');
    };

    rec.onend = () => {
      // Auto-restart if user didn't manually stop (Chrome auto-stops after ~60s)
      if (!manualStopRef.current && recRef.current) {
        try {
          rec.start();
          return;
        } catch {
          // If restart fails (e.g. permission revoked), fall through to stop state
        }
      }
      setListening(false);
      setInterim('');
      recRef.current = null;
    };

    try {
      rec.start();
    } catch (err: any) {
      setError(err?.message || 'Không khởi động được mic');
      return null;
    }
    return rec;
  }, [lang]);

  const start = useCallback((onFinal: (text: string) => void) => {
    if (!supported) {
      setError('Trình duyệt không hỗ trợ nhận giọng nói');
      return;
    }
    if (listening) return;
    onFinalRef.current = onFinal;
    manualStopRef.current = false;
    setError(null);
    setInterim('');
    setListening(true);
    const rec = createAndStart();
    if (rec) recRef.current = rec;
    else setListening(false);
  }, [listening, supported, createAndStart]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    recRef.current?.stop();
  }, []);

  useEffect(() => () => {
    manualStopRef.current = true;
    recRef.current?.stop();
  }, []);

  return { listening, interim, error, supported, start, stop };
}
