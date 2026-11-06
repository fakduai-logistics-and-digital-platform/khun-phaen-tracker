"use client";

import "@/app/login/login.css";
import { CheckCircle2 } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";

type AccountShellProps = {
  brandName: string;
  heroTitle1: string;
  heroTitle2: string;
  heroDescription: string;
  valueProps: string[];
  footer: React.ReactNode;
  children: React.ReactNode;
};

export function AccountLogo({ className }: { className: string }) {
  return <AppLogo className={className} />;
}

export function AccountShell({
  brandName,
  heroTitle1,
  heroTitle2,
  heroDescription,
  valueProps,
  footer,
  children,
}: AccountShellProps) {
  return (
    <div className="login-shell dark flex min-h-screen w-full bg-background text-foreground">
      <div className="hidden w-1/2 flex-col justify-between border-r p-12 lg:flex">
        <div className="flex items-center gap-3">
          <AccountLogo className="size-8 rounded-md object-contain" />
          <span className="text-xl font-bold">{brandName}</span>
        </div>

        <div className="mb-10">
          <h2 className="mb-6 text-4xl font-bold leading-[1.2]">
            {heroTitle1} <br />
            <span className="text-primary">{heroTitle2}</span>
          </h2>
          <p className="mb-8 max-w-md leading-relaxed text-muted-foreground">{heroDescription}</p>
          <ul className="space-y-3">
            {valueProps.map((prop) => (
              <li key={prop} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 text-primary" />
                {prop}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-6 text-sm text-muted-foreground">{footer}</div>
      </div>

      <div className="relative flex w-full items-center justify-center p-6 sm:p-12 lg:w-1/2">
        <div className="absolute right-6 top-6 z-50 flex items-center gap-2">
          <PaletteSwitch />
          <LanguagePicker />
        </div>

        <div className="relative z-10 w-full max-w-[420px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <AccountLogo className="size-10 rounded-md object-contain" />
          </div>
          <div className="rounded-xl border bg-card p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
