"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusToastProps = {
  message?: string;
  onMessageChange?: (message: string) => void;
  type?: "success" | "error" | "info";
  duration?: number;
};

const TYPE_STYLES = {
  success: { className: "bg-success", icon: Check },
  error: { className: "bg-destructive", icon: AlertCircle },
  info: { className: "bg-primary text-primary-foreground", icon: Info },
} as const;

export function StatusToast({ message = "", onMessageChange, type = "success", duration = 3000 }: StatusToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const onMessageChangeRef = useRef(onMessageChange);
  onMessageChangeRef.current = onMessageChange;

  useEffect(() => {
    setDismissed(false);
    if (!message) return;
    const timeout = setTimeout(() => {
      setDismissed(true);
      onMessageChangeRef.current?.("");
    }, duration);
    return () => clearTimeout(timeout);
  }, [message, duration]);

  if (!message || dismissed) return null;

  const { className, icon: Icon } = TYPE_STYLES[type];

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className="fixed top-20 right-4 z-10000 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className={cn("flex items-center gap-2 rounded-lg px-4 py-3 text-white shadow-lg", className)}>
        <Icon size={20} />
        {message}
      </div>
    </div>
  );
}
