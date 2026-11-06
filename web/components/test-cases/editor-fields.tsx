"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PropertySelect as OptionSelect } from "@/components/task-detail/property-select";
import type { EditorOption } from "./editor-options";

type Icon = React.ComponentType<{ size?: number; className?: string }>;

type EditorTextFieldProps = {
  label: string;
  icon: Icon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  readOnly?: boolean;
};

export function EditorTextField({ label, icon: Icon, value, onChange, placeholder, readOnly }: EditorTextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        <Icon size={16} className="text-muted-foreground" />
        {label}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="resize-none"
        aria-label={label}
        placeholder={placeholder}
      />
    </div>
  );
}

type PropertySelectProps = {
  id: string;
  label: string;
  icon: Icon;
  value: string;
  onValueChange: (value: string) => void;
  options: EditorOption[];
  showSearch?: boolean;
  disabled?: boolean;
  action?: React.ReactNode;
};

export function PropertySelect({
  id,
  label,
  icon: Icon,
  value,
  onValueChange,
  options,
  disabled,
  action,
}: PropertySelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          <Icon size={16} className="text-muted-foreground" />
          {label}
        </Label>
        {action}
      </div>
      <OptionSelect
        id={id}
        value={value}
        options={options}
        disabled={disabled}
        className="max-w-none"
        onSelect={(next) => onValueChange(String(next))}
      />
    </div>
  );
}
