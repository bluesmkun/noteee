import * as React from "react"

import { cn } from "@/lib/utils"

export type BadgeVariant = "primary" | "outline" | "muted" | "ok" | "warn" | "danger" | "info"

const VARIANTS: Record<BadgeVariant, string> = {
  primary: "border-primary/45 bg-primary/10 text-primary",
  outline: "border-border bg-card/60 text-muted-foreground",
  muted: "border-border/70 bg-muted/55 text-muted-foreground",
  ok: "border-ok/45 bg-ok/10 text-ok",
  warn: "border-warn/50 bg-warn/12 text-warn",
  danger: "border-destructive/45 bg-destructive/10 text-destructive",
  info: "border-info/45 bg-info/10 text-info",
}

export function Badge({
  className,
  variant = "primary",
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-[3px] border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}
