import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Moon, Sun } from "lucide-react"

import { PAPER_OPTIONS, type Paper } from "@/lib/theme"
import { cn } from "@/lib/utils"

const MODES = [
  { value: false, label: "浅色", Icon: Sun },
  { value: true, label: "深色", Icon: Moon },
] as const

/**
 * 外观开关：**一个按钮同时管明暗和纸张色调**。
 *
 * 按钮自己就是当前外观的缩略图 —— 底是当前的纸色（深色下就是对应的墨绿纸），
 * 符号是当前的明暗。点开是一个两行的小面板：上面选明暗，下面选纸。
 * 之前把纸张色调单独放在工具栏、明暗单独放在页头，两个控件风格也不统一，看着很散。
 */
export function Appearance({
  dark,
  onDark,
  paper,
  onPaper,
}: {
  dark: boolean
  onDark: (value: boolean) => void
  paper: Paper
  onPaper: (value: Paper) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const paperLabel = PAPER_OPTIONS.find((option) => option.value === paper)?.label ?? paper

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", away)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", away)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={`外观：${dark ? "深色" : "浅色"} · ${paperLabel}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="paper-sm press flex h-8 shrink-0 items-center gap-1.5 rounded-md border pr-1.5 pl-1.5 text-foreground/80 transition-colors hover:text-foreground"
      >
        <span
          aria-hidden
          className="grid size-[18px] place-items-center rounded-[3px] border border-border"
          style={{ background: `var(--paper-swatch-${paper})` }}
        >
          {dark ? <Moon className="size-3 text-foreground/75" /> : <Sun className="size-3 text-foreground/75" />}
        </span>
        <ChevronDown className={cn("size-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="paper absolute top-10 right-0 z-30 w-56 rounded-xl border p-3">
          <p className="label-caps mb-1.5 text-[10px] text-muted-foreground">明暗</p>
          <div className="grid grid-cols-2 gap-1.5">
            {MODES.map(({ value, label, Icon }) => (
              <button
                key={label}
                onClick={() => onDark(value)}
                title={`${label}模式`}
                aria-pressed={dark === value}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-[4px] border py-1.5 text-xs transition",
                  dark === value ? "paper-sm font-medium text-primary" : "slot text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          <p className="label-caps mt-3 mb-1.5 text-[10px] text-muted-foreground">纸张</p>
          <div className="space-y-1">
            {PAPER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onPaper(option.value)}
                title={`纸张：${option.label}`}
                aria-pressed={paper === option.value}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[4px] border px-2 py-1.5 text-xs transition",
                  paper === option.value ? "paper-sm font-medium" : "border-transparent hover:bg-muted/60",
                )}
              >
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-[2px] border border-border"
                  style={{ background: `var(--paper-swatch-${option.value})` }}
                />
                <span className="flex-1 text-left">{option.label}</span>
                {paper === option.value && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
