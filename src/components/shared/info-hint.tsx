"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type InfoHintTone = "muted" | "info" | "warning" | "danger" | "success";
type InfoHintSize = "xs" | "sm" | "md";

interface InfoHintProps {
  content: React.ReactNode;
  label?: string;
  className?: string;
  tone?: InfoHintTone;
  size?: InfoHintSize;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  contentClassName?: string;
}

const toneClassNames: Record<InfoHintTone, string> = {
  muted: "text-muted-foreground/70 hover:text-foreground",
  info: "text-info hover:text-info/80",
  warning: "text-warning hover:text-warning/80",
  danger: "text-danger hover:text-danger/80",
  success: "text-success hover:text-success/80",
};

const sizeClassNames: Record<InfoHintSize, { button: string; icon: string }> = {
  xs: { button: "size-3.5", icon: "size-3" },
  sm: { button: "size-4", icon: "size-3.5" },
  md: { button: "size-5", icon: "size-4" },
};

/**
 * Botão "(?)" compacto que abre um Popover com a informação detalhada.
 * Substitui textos descritivos inline (subtitles, helpers, descriptions)
 * mantendo toda a informação acessível sob demanda.
 */
export function InfoHint({
  content,
  label = "Mais informações",
  className,
  tone = "muted",
  size = "sm",
  align = "start",
  side = "bottom",
  contentClassName,
}: InfoHintProps) {
  if (content === null || content === undefined || content === false || content === "") {
    return null;
  }

  const sizes = sizeClassNames[size];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            sizes.button,
            toneClassNames[tone],
            className,
          )}
        >
          <HelpCircle className={sizes.icon} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className={cn("text-sm leading-relaxed", contentClassName)}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {typeof content === "string" ? (
          <p className="text-muted-foreground">{content}</p>
        ) : (
          content
        )}
      </PopoverContent>
    </Popover>
  );
}
