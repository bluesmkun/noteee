import type { ReactNode } from "react"

import { BAR_TONE, type BarTone, type IconType } from "@/components/Bits"
import { cn } from "@/lib/utils"

type Props = {
  label: ReactNode
  icon?: IconType
  pct: number | null
  foot: ReactNode
  empty?: ReactNode
  tone?: BarTone
  /** 硬件占用用大号：百分比更醒目，轨道更粗 */
  big?: boolean
  className?: string
}

export function Meter({ label, icon: Icon, pct, foot, empty = "—", tone = "cpu", big = false, className }: Props) {
  const filled = pct === null ? 0 : Math.min(100, Math.max(0, pct))
  const danger = pct !== null && filled >= 90
  const warn = pct !== null && filled >= 75 && !danger
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {Icon && <Icon className={cn("shrink-0", big ? "size-3.5" : "size-3")} />}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "ink mt-1 font-semibold",
          big ? "text-[17px] leading-6" : "text-xs",
          pct === null ? "text-muted-foreground" : danger ? "text-destructive" : warn ? "text-warn" : "text-foreground/90",
        )}
      >
        {pct === null ? empty : `${filled < 10 ? filled.toFixed(1) : filled.toFixed(0)}%`}
      </div>
      <div className={cn("track mt-1.5 w-full overflow-hidden rounded-[2px] border", big ? "h-2.5" : "h-1.5")}>
        <div
          className={cn("h-full transition-[width] duration-700", danger ? "bar-danger" : BAR_TONE[tone])}
          style={{ width: `${filled}%` }}
        />
      </div>
      <div className={cn("ink mt-1 truncate text-muted-foreground", big ? "text-[10px]" : "text-[11px]")}>{foot}</div>
    </div>
  )
}
