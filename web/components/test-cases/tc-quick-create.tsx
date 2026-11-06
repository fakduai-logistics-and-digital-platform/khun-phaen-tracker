"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

type TcQuickCreateProps = {
  onCreate: (title: string) => Promise<void>;
};

export function TcQuickCreate({ onCreate }: TcQuickCreateProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");

  const reset = () => {
    setEditing(false);
    setTitle("");
  };

  if (!editing) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
        {t("testCases__quick_create")}
      </Button>
    );
  }

  return (
    <Input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      className="h-8 flex-1"
      placeholder={t("testCases__title_placeholder")}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const value = title;
          void onCreate(value).finally(reset);
        }
        if (e.key === "Escape") reset();
      }}
      onBlur={() => {
        if (!title.trim()) setEditing(false);
      }}
    />
  );
}
