import { memo, useState, type ComponentType, type ReactNode } from "react"
import { Activity } from "lucide-react"

import { Badge, type BadgeVariant } from "@/components/ui/badge"
import { HOUR_BUCKETS, type Latency, type LatencyHour, type Node, type ProbeStat } from "@/lib/api"
import { OS_ICONS, osSlug, osVersion } from "@/lib/os-icons"
import {
  countryName,
  CYCLES,
  daysUntil,
  duration,
  expiryLabel,
  expiryTone,
  flagOf,
  jitterTone,
  latencyTone,
  money,
  uptime,
  type Tone,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import { statusOf } from "@/lib/view"

export type IconType = ComponentType<{ className?: string }>

/**
 * 概览卡与节点卡**共用同一个栅格**：同一个 template、同一个 gap、同一个容器宽度，
 * 所以上下两组卡片的列边界严格对齐，不会「上面 4 列、下面 3 列」地错开。
 * 列数是写死的四档（1/2/3/4），不做成可配置——概览卡里地图要钉在最后一列并纵向跨两行，
 * 列数一变就会在最后一行留个洞。对齐优先于可调。
 */
export const CARD_GRID = "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-destructive",
  muted: "text-muted-foreground",
}

export const TONE_BADGE: Record<Tone, BadgeVariant> = {
  ok: "ok",
  warn: "warn",
  bad: "danger",
  muted: "muted",
}

export const BAR_TONE = {
  cpu: "bar-cpu",
  mem: "bar-mem",
  disk: "bar-disk",
  net: "bar-net",
} as const

export type BarTone = keyof typeof BAR_TONE

export function statusLabel(node: Node): string {
  const status = statusOf(node)
  if (status === "online") return node.metrics ? `在线 ${uptime(node.metrics.uptime)}` : "在线"
  if (status === "offline") {
    return node.last_seen ? `离线 ${duration(Math.max(0, Date.now() / 1000 - node.last_seen))}` : "离线"
  }
  return "未接入"
}

export function StatusDot({ node, className }: { node: Node; className?: string }) {
  const status = statusOf(node)
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "online" ? "bg-ok pulse-ok" : status === "offline" ? "bg-destructive/80" : "bg-muted-foreground/40",
        className,
      )}
    />
  )
}

/** 在线状态。和旁边的 agent 版本号一样是普通标签：不斜、不盖章，
 *  与标题行其他元素严格平行对齐 */
export function StatusPill({ node, className }: { node: Node; className?: string }) {
  const status = statusOf(node)
  return (
    <Badge
      variant={status === "online" ? "ok" : status === "offline" ? "danger" : "muted"}
      className={cn("py-1 font-normal", className)}
    >
      <StatusDot node={node} />
      {statusLabel(node)}
    </Badge>
  )
}

let flagSupport: boolean | null = null

export function flagsSupported(): boolean {
  if (flagSupport !== null) return flagSupport
  try {
    const size = 32
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) {
      flagSupport = false
      return flagSupport
    }
    ctx.font = "24px sans-serif"
    ctx.textBaseline = "top"
    ctx.fillStyle = "#000"
    ctx.fillText("\u{1F1EF}\u{1F1F5}", 1, 1)
    const data = ctx.getImageData(0, 0, size, size).data
    let colored = 0
    for (let i = 0; i < data.length; i += 4) {
      const spread = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])
      if (data[i + 3] > 0 && spread > 30) colored++
    }
    flagSupport = colored > 4
  } catch {
    flagSupport = false
  }
  return flagSupport
}

const FLAG_ICON = (code: string) =>
  `https://cdn.jsdelivr.net/npm/flag-icons@7.5.0/flags/4x3/${code.toLowerCase()}.svg`

export function FlagIcon({ code, className }: { code: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c) || failed) {
    return (
      <span
        className={cn(
          "rounded-[3px] bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground",
          className,
        )}
        title={countryName(code)}
      >
        {c || "??"}
      </span>
    )
  }
  return (
    <img
      src={FLAG_ICON(c)}
      alt={countryName(c)}
      width={16}
      height={12}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("h-3 w-4 shrink-0 rounded-[1px] border border-border/60 object-cover", className)}
    />
  )
}

export function CountryLabel({ code, name = false, className }: { code: string; name?: boolean; className?: string }) {
  if (!code) return null
  const flag = flagOf(code)
  const emoji = flag !== "" && flagsSupported()
  if (!emoji && !name) return <FlagIcon code={code} className={className} />
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground", className)}
      title={countryName(code)}
    >
      {emoji ? <span aria-hidden>{flag}</span> : <FlagIcon code={code} />}
      {name && <span className="max-w-24 truncate">{countryName(code)}</span>}
    </span>
  )
}

/** 系统版本用发行版图标表示：Debian 的旋涡、Ubuntu 的圆环、Windows 的四格一眼可辨。
 *  图标走 currentColor，深浅色都跟着主题走；文字只留版本号，完整串放 title。
 *  认不出发行版时退回原来的纯文字，不要硬套一个别的图标。 */
export function OsLabel({
  os,
  withName = false,
  className,
}: {
  os?: string | null
  withName?: boolean
  className?: string
}) {
  if (!os) return null
  const slug = osSlug(os)
  if (!slug) {
    return (
      <span className={cn("min-w-0 truncate", className)} title={os}>
        {os}
      </span>
    )
  }
  const version = osVersion(os)
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)} title={os}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 shrink-0 fill-current">
        <path d={OS_ICONS[slug]} />
      </svg>
      {withName && <span className="shrink-0">{OS_LABEL[slug] ?? ""}</span>}
      {version && <span className="min-w-0 truncate">{version}</span>}
    </span>
  )
}

const OS_LABEL: Record<string, string> = {
  debian: "Debian",
  ubuntu: "Ubuntu",
  centos: "CentOS",
  redhat: "RHEL",
  fedora: "Fedora",
  rockylinux: "Rocky",
  almalinux: "AlmaLinux",
  archlinux: "Arch",
  alpinelinux: "Alpine",
  opensuse: "openSUSE",
  gentoo: "Gentoo",
  nixos: "NixOS",
  linuxmint: "Mint",
  manjaro: "Manjaro",
  zorin: "Zorin",
  deepin: "Deepin",
  raspberrypi: "Raspberry Pi",
  linux: "Linux",
  freebsd: "FreeBSD",
  openwrt: "OpenWrt",
  proxmox: "Proxmox",
  synology: "DSM",
  unraid: "Unraid",
  truenas: "TrueNAS",
  windows: "Windows",
}

/** 资源一行：标签 + 刻度轨道 + 百分比 + 明细（核数 / 负载 / 真实用量）。
 *  列表视图用。进度条走 `transform: scaleX()` 而不是 `width`：
 *  改宽度会触发布局，改 transform 只走合成层。 */
export function MeterRow({
  label,
  pct,
  tone,
  detail,
  className,
}: {
  label: string
  pct: number | null
  tone: BarTone
  detail?: string
  className?: string
}) {
  const filled = pct === null ? 0 : Math.min(100, Math.max(0, pct))
  const danger = pct !== null && filled >= 90
  const warn = pct !== null && filled >= 75 && !danger
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="w-7 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <span className="track h-1.5 min-w-0 flex-1 overflow-hidden rounded-[2px] border">
        <span
          className={cn(
            "block h-full origin-left transition-transform duration-700",
            danger ? "bar-danger" : BAR_TONE[tone],
          )}
          style={{ transform: `scaleX(${filled / 100})` }}
        />
      </span>
      <span
        className={cn(
          "ink w-8 shrink-0 text-right text-[10px]",
          danger ? "font-semibold text-destructive" : warn ? "text-warn" : "text-foreground/85",
        )}
      >
        {pct === null ? "—" : `${filled.toFixed(0)}%`}
      </span>
      {/* 明细列**永远渲染**，哪怕内容是空的。
          以前写成 `detail !== undefined &&`：离线节点没有明细时这一列整个消失，
          进度条（flex-1）把空位撑开，百分比就被推到右边，和下面两行对不上。 */}
      <span
        className="ink w-[6.75rem] shrink-0 truncate text-right text-[10px] text-muted-foreground"
        title={detail}
      >
        {detail}
      </span>
    </div>
  )
}

/** 纸上的小格：卡片里的信息条都用它，像本子上画的一行表格 */export function Slot({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <div
      title={title}
      className={cn("slot flex min-w-0 items-center justify-between gap-2 rounded-[3px] border px-2.5 py-1.5", className)}
    >
      {children}
    </div>
  )
}

/** 区块小标题：宋体 + 字距，像本子上的手写标签 */
export function SectionTitle({
  icon: Icon,
  children,
  className,
}: {
  icon?: IconType
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-1.5 text-[10px] text-muted-foreground", className)}>
      {Icon && <Icon className="size-3 shrink-0" />}
      <span className="label-caps">{children}</span>
    </div>
  )
}

export function bandProbe(latency?: Latency): ProbeStat | null {
  if (!latency || latency.none || latency.failed) return null
  return latency.probes.find((p) => p.latency !== null) ?? null
}

export function latencyText(latency?: Latency): { text: string; tone: Tone } {
  if (!latency || latency.none || latency.failed) return { text: "—", tone: "muted" }
  const probe = bandProbe(latency)
  if (!probe || probe.latency === null || probe.min === null || probe.max === null) {
    return { text: "超时", tone: "bad" }
  }
  const low = Math.round(probe.min)
  const high = Math.round(probe.max)
  const spread = Math.round((probe.max - probe.min) / 2)
  const text = low === high ? `${Math.round(probe.latency)} ms` : `${low}–${high} ms${spread > 0 ? ` ±${spread}` : ""}`
  return { text, tone: latencyTone(probe.latency, probe.loss) }
}

const HEAT_BLOCKS = {
  ok: "bg-heat-ok",
  mild: "bg-heat-mild",
  warn: "bg-heat-warn",
  hot: "bg-heat-hot",
  bad: "bg-heat-bad",
  muted: "bg-heat-muted",
} as const

const HEAT_TEXT = {
  ok: "text-ok",
  mild: "text-ok",
  warn: "text-warn",
  hot: "text-chart-4",
  bad: "text-destructive",
  muted: "text-muted-foreground",
} as const

type Heat = keyof typeof HEAT_BLOCKS

function heatOf(value: number | null, kind: "latency" | "loss"): Heat {
  if (value === null) return "muted"
  if (kind === "latency") {
    return value < 60 ? "ok" : value < 110 ? "mild" : value < 180 ? "warn" : value < 280 ? "hot" : "bad"
  }
  return value < 0.5 ? "ok" : value < 2 ? "mild" : value < 5 ? "warn" : value < 10 ? "hot" : "bad"
}

function hourLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit" })
}

/** 24 小时热力色带的一行。卡片视图与列表视图共用同一个组件、同一份 hours 数据，
 *  两个视图的显示因此天然一致；compact 只改尺寸与是否显示左侧标签，不改配色与阈值 */
function HeatRow({
  label,
  hours,
  kind,
  probes,
  compact = false,
}: {
  label?: string
  hours: LatencyHour[]
  kind: "latency" | "loss"
  probes: number
  compact?: boolean
}) {
  const cell = compact ? "h-2" : "h-3"
  return (
    <div className={cn("flex items-center", compact ? "gap-0" : "gap-1.5")}>
      {label && <span className="label-caps w-7 shrink-0 text-[10px] text-muted-foreground">{label}</span>}
      <span className={cn("flex min-w-0 flex-1 items-center", compact ? "gap-px" : "gap-[2px]")}>
        {hours.length > 0
          ? hours.map((hour, i) => {
              const value = kind === "latency" ? hour.latency : hour.loss
              return (
                <span
                  key={i}
                  title={`${hourLabel(hour.ts)} · ${
                    value === null ? "无数据" : kind === "latency" ? `${Math.round(value)} ms` : `${value.toFixed(1)}%`
                  }${probes > 1 ? `（${probes} 个探测均值）` : ""}`}
                  className={cn("min-w-0 flex-1 rounded-[1px]", cell, HEAT_BLOCKS[heatOf(value, kind)])}
                />
              )
            })
          : // 没有数据时也铺满 24 格，卡片行高才与有数据的节点一致
            Array.from({ length: HOUR_BUCKETS }, (_, i) => (
              <span key={i} className={cn("min-w-0 flex-1 rounded-[1px]", cell, HEAT_BLOCKS.muted)} />
            ))}
      </span>
    </div>
  )
}

function HeatStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span>
      {label} <span className={cn("ink", tone)}>{value}</span>
    </span>
  )
}

export const LatencyPanel = memo(function LatencyPanel({ latency, className }: { latency?: Latency; className?: string }) {
  const probes = latency?.probes ?? []
  const hours = latency?.hours ?? []
  const failed = latency?.failed === true
  const avgLatency = latency?.avgLatency ?? null
  const avgLoss = latency?.avgLoss ?? null
  const jitter = latency?.jitter ?? null

  return (
    <div className={cn("slot rounded-[3px] border px-3 py-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <SectionTitle icon={Activity}>24 小时 · 每格 1 小时</SectionTitle>
        <span
          className={cn("shrink-0 text-[10px]", failed ? "text-destructive" : "ink text-muted-foreground")}
          title={failed ? undefined : probes.map((p) => p.name).join("、")}
        >
          {failed ? "读取失败" : probes.length > 0 ? `${probes.length} 个探测` : ""}
        </span>
      </div>
      <div className="mt-2 space-y-0.5">
        <HeatRow label="延迟" hours={hours} kind="latency" probes={probes.length} />
        <HeatRow label="丢包" hours={hours} kind="loss" probes={probes.length} />
      </div>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 truncate text-[10px] text-muted-foreground">
        <HeatStat
          label="延迟"
          tone={HEAT_TEXT[heatOf(avgLatency, "latency")]}
          value={avgLatency === null ? "—" : `${Math.round(avgLatency)}ms`}
        />
        <HeatStat
          label="波动"
          tone={TONE_TEXT[jitterTone(jitter)]}
          value={jitter === null ? "—" : `${Math.round(jitter)}ms`}
        />
        <HeatStat
          label="丢包"
          tone={HEAT_TEXT[heatOf(avgLoss, "loss")]}
          value={avgLoss === null ? "—" : `${avgLoss.toFixed(1)}%`}
        />
      </div>
    </div>
  )
})

export function LatencyMini({ latency, className }: { latency?: Latency; className?: string }) {
  const best = latencyText(latency)
  const hours = latency?.hours ?? []
  const probes = latency?.probes ?? []
  return (
    <span className={cn("flex min-w-0 flex-col justify-center gap-1", className)}>
      {/* 与卡片视图同一份 hours（多探测按小时求均值）与同一个 HeatRow，两个视图显示一致 */}
      <span className="flex min-w-0 flex-col gap-0.5">
        <HeatRow hours={hours} kind="latency" probes={probes.length} compact />
        <HeatRow hours={hours} kind="loss" probes={probes.length} compact />
      </span>
      <span className={cn("ink truncate text-[10px] whitespace-nowrap", TONE_TEXT[best.tone])}>{best.text}</span>
    </span>
  )
}

export function ExpiryText({
  date,
  compact = false,
  className,
}: {
  date?: string | null
  compact?: boolean
  className?: string
}) {
  const days = daysUntil(date)
  if (days === null) {
    return (
      <span className={cn("ink text-muted-foreground", className)} title="永不到期">
        ∞
      </span>
    )
  }
  return (
    <span className={cn("ink", TONE_TEXT[expiryTone(days)], className)} title={date ?? "永不到期"}>
      {compact ? (days < 0 ? `过期${-days}天` : `${days}天`) : expiryLabel(days)}
    </span>
  )
}

export function PriceText({ node, className }: { node: Node; className?: string }) {
  if (node.price <= 0) return <span className={cn("text-muted-foreground", className)}>免费</span>
  const cycle = CYCLES[node.billing_cycle] ?? node.billing_cycle
  return (
    <span className={cn("ink", className)}>
      {money(node.price, node.currency)}
      {cycle && <span className="text-muted-foreground"> / {cycle}</span>}
    </span>
  )
}

export function Chip({
  icon: Icon,
  children,
  tone = "muted",
  title,
  className,
}: {
  icon?: IconType
  children: ReactNode
  tone?: Tone
  title?: string
  className?: string
}) {
  return (
    <span
      title={title}
      className={cn("slot inline-flex min-w-0 items-center gap-1.5 rounded-[3px] border px-2 py-1 text-xs", className)}
    >
      {Icon && <Icon className={cn("size-3.5 shrink-0", TONE_TEXT[tone])} />}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
  className,
}: {
  icon: IconType
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: "primary" | "info" | Tone
  className?: string
}) {
  return (
    <div className={cn("rise paper flex min-w-0 items-center gap-3 rounded-xl border p-3.5", className)}>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-[4px] border",
          tone === "primary"
            ? "border-primary/25 bg-primary/10 text-primary"
            : tone === "info"
              ? "border-info/25 bg-info/10 text-info"
              : cn("border-border/70 bg-muted/60", TONE_TEXT[tone]),
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="label-caps text-[10px] text-muted-foreground">{label}</div>
        <div className="ink truncate text-base font-semibold">{value}</div>
        {sub && <div className="ink truncate text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
}
