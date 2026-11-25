import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface VoiceSearchButtonProps {
  onResult: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onListeningChange?: (listening: boolean) => void;
  onError?: (message: string) => void;
  tabIndex?: number;
  className?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export function VoiceSearchButton({
  onResult,
  onFinalResult,
  onListeningChange,
  onError,
  tabIndex,
  className = '',
  buttonRef,
}: VoiceSearchButtonProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const getSpeechCtor = (): SpeechRecognitionConstructor | null => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as WindowWithSpeech;
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  };

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore cleanup error
      }
      recognitionRef.current = null;
    };
  }, []);

  const updateListening = (next: boolean) => {
    setListening(next);
    onListeningChange?.(next);
  };

  const handleToggle = () => {
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      updateListening(false);
      return;
    }

    const SpeechCtor = getSpeechCtor();
    if (!SpeechCtor) {
      onError?.('Tarayıcınız sesli aramayı desteklemiyor.');
      return;
    }

    try {
      const recognition = new SpeechCtor();
      recognition.lang = 'tr-TR';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      let latestFinal = '';

      recognition.onresult = (ev) => {
        let combined = '';
        let hasFinal = false;
        for (let i = 0; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res?.[0]?.transcript ?? '';
          combined += text;
          if (res?.isFinal) hasFinal = true;
        }
        const cleaned = combined.trim();
        if (cleaned) {
          onResult(cleaned);
          if (hasFinal) {
            latestFinal = cleaned;
          }
        }
      };

      recognition.onerror = (ev) => {
        updateListening(false);
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          onError?.('Sesli arama için mikrofon izni gerekli.');
        } else if (ev.error === 'no-speech') {
          onError?.('Ses algılanamadı, tekrar deneyin.');
        } else if (ev.error !== 'aborted') {
          onError?.('Sesli arama başlatılamadı.');
        }
      };

      recognition.onend = () => {
        updateListening(false);
        recognitionRef.current = null;
        if (latestFinal) {
          onFinalResult?.(latestFinal);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      updateListening(true);
    } catch {
      updateListening(false);
      onError?.('Sesli arama başlatılamadı.');
    }
  };

  const supported = Boolean(getSpeechCtor());

  return (
    <button
      ref={buttonRef}
      type="button"
      tabIndex={tabIndex}
      onClick={handleToggle}
      aria-label={listening ? 'Sesli Aramayı Durdur' : 'Sesli Arama (Türkçe)'}
      aria-pressed={listening}
      title={
        !supported
          ? 'Bu tarayıcıda sesli arama desteklenmiyor'
          : listening
            ? 'Dinleniyor... Durdurmak için dokunun'
            : 'Sesli Arama (Türkçe)'
      }
      className={`min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        listening
          ? 'bg-rose-500 text-white animate-pulse'
          : supported
            ? 'text-[#B5BBC7] hover:text-white hover:bg-white/12'
            : 'text-[#6E7582] hover:bg-white/6'
      } ${className}`}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
