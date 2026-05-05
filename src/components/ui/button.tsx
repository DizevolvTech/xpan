"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { readClientAccessContext } from "@/lib/client-access-context";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-[0.005em] transition-[transform,box-shadow,background-color,border-color,color,filter] duration-200 ease-out disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px] active:translate-y-0 active:duration-75",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-card)] hover:-translate-y-px hover:shadow-[var(--shadow-soft)] hover:brightness-[1.06]",
        destructive:
          "border border-transparent bg-destructive text-white shadow-[var(--shadow-card)] hover:-translate-y-px hover:shadow-[var(--shadow-soft)] hover:brightness-[1.06]",
        outline:
          "border-border-strong/30 bg-surface text-foreground hover:border-border-strong/55 hover:bg-panel hover:-translate-y-px",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/85",
        ghost:
          "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "h-auto border-none p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-lg px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  allowInReadOnly = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    allowInReadOnly?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const isReadOnlyTenantView = readClientAccessContext().accessMode === "read-only-tenant";
  const blocksInReadOnly =
    !allowInReadOnly &&
    !asChild &&
    (variant === "default" || variant === "destructive" || props.type === "submit");
  const disabled = props.disabled || (isReadOnlyTenantView && blocksInReadOnly);

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-read-only-disabled={disabled && isReadOnlyTenantView ? "true" : "false"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      disabled={disabled}
    />
  );
}

export { Button, buttonVariants };
