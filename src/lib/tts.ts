"use client";

export type SpeakOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

// Very lightweight markdown -> plain text conversion for TTS.
// Goal: avoid reading markdown syntax like **, ``, #, links markup, etc.
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return "";

  let text = markdown;

  // Code fences: keep content, drop ```lang
  text = text.replace(/```[\s\S]*?```/g, (block) => {
    const inner = block.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "");
    return `\n${inner}\n`;
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, "$1");

  // Images ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1");

  // Links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

  // Strip headings markers
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");

  // Strip emphasis markers
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");

  // Strikethrough
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // Blockquotes
  text = text.replace(/^\s*>\s?/gm, "");

  // Task list markers
  text = text.replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, "");

  // List bullets -> remove marker
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");

  // Tables: remove pipes
  text = text.replace(/\|/g, " ");

  // Collapse whitespace
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[\t ]{2,}/g, " ");

  return text.trim();
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function stopSpeaking() {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

export function speak(text: string, opts: SpeakOptions = {}): SpeechSynthesisUtterance | null {
  if (!isSpeechSynthesisSupported()) return null;
  const utterance = new SpeechSynthesisUtterance(text);
  if (opts.lang) utterance.lang = opts.lang;
  if (typeof opts.rate === "number") utterance.rate = opts.rate;
  if (typeof opts.pitch === "number") utterance.pitch = opts.pitch;
  if (typeof opts.volume === "number") utterance.volume = opts.volume;
  window.speechSynthesis.speak(utterance);
  return utterance;
}
