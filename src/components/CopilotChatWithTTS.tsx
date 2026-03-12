"use client";

import { useEffect, useMemo, useRef } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { AssistantTTSButton } from "@/components/AssistantTTSButton";
import { isSpeechSynthesisSupported, markdownToPlainText, speak, stopSpeaking } from "@/lib/tts";

type Props = {
  autoReadEnabled: boolean;
  className?: string;
  labels?: {
    title?: string;
    initial?: string;
    placeholder?: string;
  };
};

// NOTE: CopilotKit exposes a custom message renderer via className hooks,
// but does not (yet) provide a stable public API to inject per-message actions.
// This wrapper uses a MutationObserver to:
// 1) auto-read newly added assistant messages when enabled
// 2) inject a small speaker button into assistant message bubbles
//
// If CopilotKit adds a first-class message renderer, we should migrate away from DOM injection.
export function CopilotChatWithTTS({ autoReadEnabled, className, labels }: Props) {
  const supported = isSpeechSynthesisSupported();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenHashRef = useRef<string | null>(null);

  const observer = useMemo(() => {
    if (!supported) return null;

    const handleNewAssistantMessage = (el: HTMLElement) => {
      // Try to find the visible message text.
      const text = el.textContent ?? "";
      const plain = markdownToPlainText(text);
      const hash = `${plain.length}:${plain.slice(0, 80)}`;

      // Inject per-message speak button once.
      if (!el.querySelector("[data-tts-btn='true']")) {
        const btnHost = document.createElement("span");
        btnHost.setAttribute("data-tts-btn", "true");
        btnHost.className = "tts-btn-host";

        // Use React to render the button would require a portal; keep it simple:
        // create a plain button matching our CSS.
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tts-btn";
        button.title = "Speak";
        button.setAttribute("aria-label", "Speak message");
        button.innerHTML = "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5'></polygon><path d='M15.54 8.46a5 5 0 0 1 0 7.07'></path><path d='M19.07 4.93a10 10 0 0 1 0 14.14'></path></svg>";

        let speaking = false;
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (speaking) {
            stopSpeaking();
            speaking = false;
            button.classList.remove("tts-btn--speaking");
            button.title = "Speak";
            return;
          }

          stopSpeaking();
          const u = speak(plain);
          if (!u) return;
          speaking = true;
          button.classList.add("tts-btn--speaking");
          button.title = "Stop";
          u.onend = () => {
            speaking = false;
            button.classList.remove("tts-btn--speaking");
            button.title = "Speak";
          };
          u.onerror = () => {
            speaking = false;
            button.classList.remove("tts-btn--speaking");
            button.title = "Speak";
          };
        });

        btnHost.appendChild(button);
        el.appendChild(btnHost);
      }

      if (!autoReadEnabled) return;
      if (!plain) return;
      if (lastSpokenHashRef.current === hash) return;
      lastSpokenHashRef.current = hash;

      stopSpeaking();
      speak(plain);
    };

    return new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          // Heuristic: CopilotKit assistant bubbles include data-copilot-message-role="assistant"
          // (classnames can change, so we prefer role attribute if present).
          const assistantEls: HTMLElement[] = [];

          const selfIsAssistant = node.getAttribute?.("data-copilot-message-role") === "assistant";
          if (selfIsAssistant) assistantEls.push(node);

          node.querySelectorAll?.("[data-copilot-message-role='assistant']").forEach((el) => {
            if (el instanceof HTMLElement) assistantEls.push(el);
          });

          // Fallback: older styles use .copilot-chat-message-assistant
          node.querySelectorAll?.(".copilot-chat-message-assistant").forEach((el) => {
            if (el instanceof HTMLElement) assistantEls.push(el);
          });

          assistantEls.forEach(handleNewAssistantMessage);
        });
      }
    });
  }, [autoReadEnabled, supported]);

  useEffect(() => {
    if (!observer) return;
    const root = rootRef.current;
    if (!root) return;

    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [observer]);

  if (!supported) {
    return <CopilotChat className={className} labels={labels} />;
  }

  return (
    <div ref={rootRef} className={className}>
      <CopilotChat labels={labels} />
    </div>
  );
}
