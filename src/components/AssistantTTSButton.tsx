"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSpeechSynthesisSupported, markdownToPlainText, speak, stopSpeaking } from "@/lib/tts";

type Props = {
  message: string;
  className?: string;
};

export function AssistantTTSButton({ message, className }: Props) {
  const supported = isSpeechSynthesisSupported();
  const plainText = useMemo(() => markdownToPlainText(message), [message]);

  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // If user navigates away / component unmounts, stop speech started by this button.
    return () => {
      if (utteranceRef.current) stopSpeaking();
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      utteranceRef.current = null;
      setSpeaking(false);
      return;
    }

    stopSpeaking();
    const u = speak(plainText);
    utteranceRef.current = u;
    if (!u) return;

    setSpeaking(true);
    u.onend = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };
    u.onerror = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={speaking ? "Stop speaking" : "Speak message"}
      title={speaking ? "Stop" : "Speak"}
      className={
        "tts-btn " +
        (speaking ? "tts-btn--speaking " : "") +
        (className ? className : "")
      }
    >
      {speaking ? (
        <VolumeX size={16} strokeWidth={2} className="tts-btn__icon" />
      ) : (
        <Volume2 size={16} strokeWidth={2} className="tts-btn__icon" />
      )}
    </button>
  );
}
