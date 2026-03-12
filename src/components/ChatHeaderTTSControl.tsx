"use client";

import { useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSpeechSynthesisSupported, stopSpeaking } from "@/lib/tts";

type Props = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
};

export function ChatHeaderTTSControl({ enabled, onToggle, className }: Props) {
  const supported = isSpeechSynthesisSupported();

  useEffect(() => {
    // If user turns off global TTS, stop anything currently speaking.
    if (!enabled) stopSpeaking();
  }, [enabled]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      className={"tts-toggle " + (enabled ? "tts-toggle--on " : "") + (className ?? "")}
      aria-label={enabled ? "Disable auto-read" : "Enable auto-read"}
      title={enabled ? "Auto-read on" : "Auto-read off"}
    >
      {enabled ? (
        <Volume2 size={18} strokeWidth={2} className="tts-toggle__icon" />
      ) : (
        <VolumeX size={18} strokeWidth={2} className="tts-toggle__icon" />
      )}
      <span className="tts-toggle__label">TTS</span>
    </button>
  );
}
