import * as React from "react"

import { cn } from "@/lib/utils"

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "neu"
export type ButtonSize = "sm" | "icon" | "icon-sm"

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0"

const VARIANTS: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
  outline: "paper-sm hover:border-primary/45 hover:bg-accent/50",
  ghost: "hover:bg-accent/60 hover:text-accent-foreground",
  neu: "paper-sm press text-foreground/85 hover:text-foreground",
}

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3",
  icon: "size-8",
  "icon-sm": "size-7 rounded-[4px]",
}

export function buttonStyles(variant: ButtonVariant = "default", size: ButtonSize = "sm", className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

export function Button({
  className,
  variant = "default",
  size = "sm",
  ...props
}: React.ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonStyles(variant, size, className)} {...props} />
}
