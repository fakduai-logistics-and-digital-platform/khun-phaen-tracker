"use client";

import type { LucideIcon } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EditorOption } from "./editor-options";

type SelectChoice = { value: string; label: string; icon?: LucideIcon; iconClass?: string; avatarColor?: string };

function ChoiceLabel({ choice }: { choice: SelectChoice }) {
  return (
    <span className="flex items-center gap-2">
      {choice.icon ? (
        <choice.icon className={cn("size-4", choice.iconClass)} />
      ) : choice.avatarColor ? (
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: choice.avatarColor }} />
      ) : null}
      <span className="truncate">{choice.label}</span>
    </span>
  );
}

type PropertyFieldProps = {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: (SelectChoice | EditorOption)[];
  disabled?: boolean;
  placeholder?: string;
  action?: React.ReactNode;
};

/** Labelled shadcn Select used for every property in the editor sidebar. */
export function PropertyField({
  id,
  label,
  value,
  onValueChange,
  options,
  disabled,
  placeholder,
  action,
}: PropertyFieldProps) {
  const choices = options as SelectChoice[];
  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {action}
      </div>
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              <ChoiceLabel choice={choice} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

type EditorTextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  readOnly?: boolean;
};

export function EditorTextField({ id, label, value, onChange, placeholder, readOnly }: EditorTextFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="min-h-24 resize-y"
        placeholder={placeholder}
      />
    </Field>
  );
}
