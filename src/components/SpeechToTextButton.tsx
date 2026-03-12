"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionType = typeof window.SpeechRecognition;

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function SpeechToTextButton({ value, onChange, disabled }: Props) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>("");

  const SpeechRecognitionCtor: any = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  }, []);

  useEffect(() => {
    setIsSupported(Boolean(SpeechRecognitionCtor));

    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
    };
  }, [SpeechRecognitionCtor]);

  const start = () => {
    if (disabled) return;
    if (!SpeechRecognitionCtor) return;

    // Ensure any previous instance is stopped
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }

    finalTranscriptRef.current = "";

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setStatusText("Listening...");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (result.isFinal) {
          finalTranscriptRef.current += transcript;
        } else {
          interim += transcript;
        }
      }

      const base = value || "";
      const append = (finalTranscriptRef.current + interim).trim();
      if (!append) return;

      // Append transcript, preserving existing input. Add a space if needed.
      const needsSpace = base.length > 0 && !base.endsWith(" ");
      const next = (base + (needsSpace ? " " : "") + append).trimStart();
      onChange(next);
    };

    recognition.onerror = (event: any) => {
      // Common errors: 'not-allowed', 'service-not-allowed', 'no-speech', 'audio-capture'
      setStatusText(event?.error ? `STT error: ${event.error}` : "STT error");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setStatusText(null);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      setStatusText("Unable to start microphone");
      setIsListening(false);
    }
  };

  const stop = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    setIsListening(false);
    setStatusText(null);
  };

  const toggle = () => {
    if (!isSupported) return;
    if (isListening) stop();
    else start();
  };

  const tooltip = !isSupported
    ? "Speech recognition not supported in this browser"
    : isListening
      ? "Stop recording"
      : "Start recording";

  return (
    <div className="stt-wrapper">
      <button
        type="button"
        className={`stt-mic-button ${isListening ? "is-listening" : ""}`}
        aria-pressed={isListening}
        aria-label="Speech to text"
        onClick={toggle}
        disabled={disabled || !isSupported}
        title={tooltip}
      >
        <span className="stt-mic-icon" aria-hidden>
          {isListening ? "■" : "🎙"}
        </span>
      </button>
      {isListening && <div className="stt-status">Listening...</div>}
      {!isSupported && <div className="stt-status">STT not supported</div>}
      {statusText && !isListening && <div className="stt-status">{statusText}</div>}
    </div>
  );
}
