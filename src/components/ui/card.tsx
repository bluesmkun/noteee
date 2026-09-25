import * as React from "react"

import { cn } from "@/lib/utils"

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("paper flex flex-col rounded-xl border text-card-foreground", className)} {...props} />
  )
}
