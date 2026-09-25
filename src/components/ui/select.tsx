import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/** track = 纸上的小格（主界面工具栏用）；default = 描边（详情页用） */
export type SelectVariant = "default" | "track"

const VARIANTS: Record<SelectVariant, string> = {
  default: "h-8 border border-input bg-card/60 pr-7 pl-2.5 hover:border-primary/45 focus-visible:border-ring",
  track: "slot h-8 border pr-7 pl-2.5",
}

export function Select({
  className,
  children,
  variant = "default",
  ...props
}: React.ComponentProps<"select"> & { variant?: SelectVariant }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        className={cn(
          "cursor-pointer appearance-none rounded-[3px] text-xs text-foreground transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </div>
  )
}
