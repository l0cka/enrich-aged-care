"use client";

import { useEffect, useState } from "react";

type ToastMessage = {
  id: number;
  text: string;
  variant: "success" | "error";
};

let toastId = 0;
let listeners: Array<(message: ToastMessage) => void> = [];

export function showToast(text: string, variant: "success" | "error" = "success"): void {
  const message: ToastMessage = { id: ++toastId, text, variant };
  listeners.forEach((listener) => listener(message));
}

export function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (message: ToastMessage) => {
      setMessages((prev) => [...prev, message]);

      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== message.id));
      }, 3000);
    };

    listeners.push(listener);

    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (!messages.length) {
    return null;
  }

  return (
    <div className="toast-container" aria-live="polite">
      {messages.map((message) => (
        <div key={message.id} className={`toast toast--${message.variant}`} role="status">
          {message.text}
        </div>
      ))}
    </div>
  );
}
