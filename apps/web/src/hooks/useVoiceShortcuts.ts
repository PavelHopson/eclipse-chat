import { useEffect, useRef } from "react";
import {
  getVoiceShortcuts,
  isTypingTarget,
  matchesVoiceShortcut,
  type VoiceShortcutAction,
} from "../lib/voiceShortcuts";

type VoiceShortcutHandlers = Partial<Record<VoiceShortcutAction, () => void | Promise<void>>>;

type Options = {
  enabled: boolean;
  handlers: VoiceShortcutHandlers;
};

/**
 * Handles configurable voice shortcuts only while a VoiceRoom is mounted.
 * Text fields and key repeats are ignored so a shortcut never eats user input.
 */
export function useVoiceShortcuts({ enabled, handlers }: Options): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) return;
      const shortcuts = getVoiceShortcuts();
      const action = (Object.keys(shortcuts) as VoiceShortcutAction[]).find((candidate) =>
        matchesVoiceShortcut(event, shortcuts[candidate]),
      );
      if (!action) return;
      const handler = handlersRef.current[action];
      if (!handler) return;
      event.preventDefault();
      void handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}
