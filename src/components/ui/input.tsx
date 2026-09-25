import * as React from "react"

import { cn } from "@/lib/utils"

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "rule h-8 w-full rounded-[3px] border px-3 text-sm text-foreground transition outline-none placeholder:text-muted-foreground/70 focus-visible:ring-[3px] focus-visible:ring-ring/25",
        className,
      )}
      {...props}
    />
  )
}
