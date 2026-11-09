"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type StatusToastProps = {
  message?: string;
  onMessageChange?: (message: string) => void;
  type?: "success" | "error" | "info";
  duration?: number;
};

const TYPE_ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;

export function StatusToast({ message = "", onMessageChange, type = "success", duration = 3000 }: StatusToastProps) {
  const { t } = useI18n();
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

  const Icon = TYPE_ICONS[type];

  return (
    <div className="fixed top-20 right-4 z-10000 w-[min(24rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-top-2 duration-300">
      <Alert variant={type === "error" ? "destructive" : "default"} className="shadow-lg">
        <Icon />
        <AlertTitle>{t(`toast__title_${type}`)}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}
