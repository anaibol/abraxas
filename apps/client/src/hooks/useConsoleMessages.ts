import { useState, useRef, useCallback } from "react";
import type { ConsoleMessage } from "../ui/Console";

const MAX_MESSAGES = 50;

export function useConsoleMessages() {
  const idRef = useRef(0);
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);

  const add = useCallback((text: string, color?: string, channel?: ConsoleMessage["channel"]) => {
    setMessages((prev) => {
      const next = [
        ...prev,
        { id: ++idRef.current, text, color, channel, timestamp: Date.now() },
      ];
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    });
  }, []);

  const reset = useCallback((initial: ConsoleMessage) => {
    setMessages([{ ...initial, id: ++idRef.current }]);
  }, []);

  return { messages, add, reset, nextId: () => ++idRef.current };
}
