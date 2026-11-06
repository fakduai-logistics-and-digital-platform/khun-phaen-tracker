"use client";

import { useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBindable } from "./use-bindable";

type IconComponent = React.ComponentType<{ size?: number | string; className?: string }>;

export type SelectValue = string | number | null;

export type SelectOption = {
  value: SelectValue;
  label: string;
  badge?: boolean;
  badgeColor?: string;
  disabled?: boolean;
  icon?: IconComponent;
  iconClass?: string;
  pillClass?: string;
  avatarUrl?: string;
  avatarColor?: string;
};

type SearchableSelectProps = {
  id?: string;
  value?: SelectValue;
  onValueChange?: (value: SelectValue) => void;
  onSelect?: (value: SelectValue) => void;
  options?: SelectOption[];
  placeholder?: string;
  emptyText?: string;
  showSearch?: boolean;
  maxDisplay?: number;
  minimal?: boolean;
  customClass?: string;
  disabled?: boolean;
  dropdownClass?: string;
};

const isSameValue = (a: SelectValue, b: SelectValue) => {
  if (a === null || b === null) return a === b;
  return String(a) === String(b);
};

function OptionAvatar({
  url,
  color,
  label,
  className,
}: {
  url?: string;
  color?: string;
  label: string;
  className: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-white",
        className,
      )}
      style={{ backgroundColor: color || "#6366f1" }}
    >
      {url ? <img src={url} alt={label} className="h-full w-full object-cover" /> : label?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function OptionBadge({ color }: { color?: string }) {
  if (color?.startsWith("#")) {
    return <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
  }
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", color || "bg-muted-foreground/50")} />;
}

export function SearchableSelect({
  id = "select",
  value: valueProp = "all",
  onValueChange,
  onSelect,
  options = [],
  placeholder = "ค้นหา...",
  emptyText = "ไม่พบรายการ",
  showSearch = true,
  minimal = false,
  customClass = "",
  disabled = false,
  dropdownClass = "min-w-[200px]",
}: SearchableSelectProps) {
  const [value, setValue] = useBindable<SelectValue>(valueProp, onValueChange);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = searchQuery.trim().toLowerCase();
  const filteredOptions = query ? options.filter((opt) => opt.label.toLowerCase().includes(query)) : options;

  const selectedOption = options.find((opt) => isSameValue(opt.value, value));
  const selectedLabel = selectedOption?.label || "ทั้งหมด";
  const SelectedIcon = selectedOption?.icon;
  const selectedPillClass = selectedOption?.pillClass || "";
  const isEmptyValue = String(value) === "all" || value === null || value === "";

  function handleOpenChange(open: boolean) {
    if (disabled) return;
    setIsOpen(open);
    if (!open) setSearchQuery("");
  }

  function selectOption(optionValue: SelectValue) {
    setValue(optionValue);
    setIsOpen(false);
    setSearchQuery("");
    onSelect?.(optionValue);
  }

  return (
    <PopoverPrimitive.Root open={isOpen && !disabled} onOpenChange={handleOpenChange}>
      <div className={cn("relative", isOpen ? "z-[9000]" : "z-auto")}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              minimal
                ? "h-8 border-transparent bg-transparent px-2.5 text-xs hover:bg-accent"
                : "h-10 border-input bg-background px-3",
              disabled && "cursor-default opacity-60",
              customClass,
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {minimal && selectedPillClass ? (
                <span className={cn("inline-flex items-center gap-1.5", selectedPillClass)}>
                  {SelectedIcon && <SelectedIcon size={13} className="shrink-0" />}
                  <span>{selectedLabel}</span>
                </span>
              ) : (
                <>
                  {selectedOption?.avatarUrl || selectedOption?.avatarColor ? (
                    <OptionAvatar
                      url={selectedOption.avatarUrl}
                      color={selectedOption.avatarColor}
                      label={selectedLabel}
                      className="h-5 w-5 text-xs"
                    />
                  ) : SelectedIcon ? (
                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center",
                        selectedOption?.iconClass || "text-muted-foreground",
                      )}
                    >
                      <SelectedIcon size={14} className="shrink-0" />
                    </span>
                  ) : null}
                  <span className={isEmptyValue ? "text-muted-foreground" : "text-foreground"}>{selectedLabel}</span>
                </>
              )}
            </span>
            {!minimal && (
              <ChevronDown
                size={16}
                className={cn(
                  "ml-2 shrink-0 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
              />
            )}
          </button>
        </PopoverPrimitive.Trigger>
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => {
            if (!showSearch) return;
            e.preventDefault();
            searchInputRef.current?.focus();
          }}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className={cn(
            "z-[9000] max-h-80 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground outline-none ring-1 ring-black/5",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            dropdownClass,
          )}
        >
          {showSearch && (
            <div className="border-b border-border">
              <input
                type="text"
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="h-10 w-full border-none bg-transparent px-4 text-xs outline-none placeholder:text-muted-foreground focus:ring-0"
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-center text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              filteredOptions.map((option, index) => {
                if (option.disabled) {
                  return (
                    <div
                      key={`${String(option.value)}-${index}`}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      {option.label}
                    </div>
                  );
                }
                const selected = isSameValue(value, option.value);
                const OptionIcon = option.icon;
                return (
                  <button
                    key={`${String(option.value)}-${index}`}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2 text-left text-xs transition-colors hover:bg-accent",
                      selected ? "font-medium text-primary" : "text-foreground/80",
                    )}
                    onClick={() => selectOption(option.value)}
                  >
                    <div className={cn("flex items-center gap-2.5", option.pillClass)}>
                      {option.avatarUrl || option.avatarColor ? (
                        <OptionAvatar
                          url={option.avatarUrl}
                          color={option.avatarColor}
                          label={option.label}
                          className="h-6 w-6 text-xs"
                        />
                      ) : OptionIcon ? (
                        <span
                          className={cn(
                            "flex shrink-0 items-center justify-center",
                            option.iconClass || "text-muted-foreground",
                          )}
                        >
                          <OptionIcon size={14} className="shrink-0" />
                        </span>
                      ) : option.badge ? (
                        <OptionBadge color={option.badgeColor} />
                      ) : null}
                      <span>{option.label}</span>
                    </div>
                    {selected && <Check size={14} className="text-muted-foreground" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
