import type { ReactNode } from "react"
import { Activity, ArrowDown, ArrowDownUp, ArrowUp, Database, Wallet } from "lucide-react"

import type { IconType } from "@/components/Bits"
import { NodeMap } from "@/components/NodeMap"
import { speedHistory, type Latency, type LatencyMap, type Node } from "@/lib/api"
import { bytes, money, percent, rate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { monthlySpend, monthUsage } from "@/lib/view"

type TileTone = "primary" | "ok" | "info" | "warn"

const BUBBLE: Record<TileTone, string> = {
  primary: "border-primary/25 bg-primary/10 text-primary",
  ok: "border-ok/25 bg-ok/10 text-ok",
  info: "border-info/25 bg-info/10 text-info",
  warn: "border-warn/30 bg-warn/12 text-warn",
}

function Tile({
  icon: Icon,
  label,
  tone = "primary",
  children,
}: {
  icon: IconType
  label: string
  tone?: TileTone
  children: ReactNode
}) {
  return (
    <div className="rise paper relative flex flex-col items-center justify-center overflow-hidden rounded-xl border p-3.5 pt-4 text-center">
      <span className="tape pointer-events-none absolute -top-2 left-1/2 h-3 w-12 -translate-x-1/2 rotate-1 rounded-[1px]" />
      <div className="relative flex items-center gap-2 text-muted-foreground">
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-[3px] border", BUBBLE[tone])}>
          <Icon className="size-3.5" />
        </span>
        <span className="label-caps text-[10px]">{label}</span>
      </div>
      <div className="relative mt-2">{children}</div>
    </div>
  )
}

function Flow({ down, up, className }: { down: string; up: string; className?: string }) {
  return (
    <div className={cn("ink grid grid-cols-1 gap-x-2 sm:grid-cols-2", className)}>
      <span className="inline-flex items-center justify-center gap-1">
        <ArrowDown className="size-3 shrink-0 text-info" />
        {down}
      </span>
      <span className="inline-flex items-center justify-center gap-1">
        <ArrowUp className="size-3 shrink-0 text-chart-4" />
        {up}
      </span>
    </div>
  )
}

function Spark({ series }: { series: { values: number[]; className: string }[] }) {
  const top = Math.max(...series.flatMap((s) => s.values), 1)
  const width = Math.max(...series.map((s) => s.values.length), 2) - 1
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      {series.map((s, i) => (
        <polyline
          key={i}
          className={s.className}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          points={s.values.map((v, x) => `${(x / width) * 100},${23 - (v / top) * 22}`).join(" ")}
        />
      ))}
    </svg>
  )
}

export function Summary({
  nodes,
  latency,
  onOpen,
  showMap = true,
  showLatency = true,
  showCost = true,
}: {
  nodes: Node[]
  latency: LatencyMap
  onOpen?: (id: number) => void
  showMap?: boolean
  showLatency?: boolean
  showCost?: boolean
}) {
  const monthRx = nodes.reduce((sum, n) => sum + n.month_rx, 0)
  const monthTx = nodes.reduce((sum, n) => sum + n.month_tx, 0)
  // 每个节点按自己的计费模式（上下行 / 取大 / 单向）折算后再合计
  const monthTotal = nodes.reduce((sum, n) => sum + monthUsage(n), 0)
  const monthLimit = nodes.reduce((sum, n) => sum + Math.max(0, n.traffic_limit), 0)
  const monthPct = nodes.length > 0 && monthLimit > 0 ? percent(monthTotal, monthLimit) : null
  const lats = nodes
    .map((n) => latency[n.id])
    .filter((l): l is Latency => !!l && !l.failed && !l.none && l.latency !== null)
  const avg = lats.length > 0 ? lats.reduce((s, l) => s + (l.latency ?? 0), 0) / lats.length : null
  const now = speedHistory.at(-1) ?? { rx: 0, tx: 0 }
  const spend = monthlySpend(nodes)

  return (
    <div
      className={cn(
        // items-start：概览卡按自身内容高度排，不被右侧地图拉伸成两条高卡片
        "grid items-start gap-3",
        showMap && "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]",
      )}
    >
      {/* 不显示地图时，概览卡自己铺满整行 */}
      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          !showMap && "sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]",
        )}
      >
        <Tile icon={Database} label="本月流量" tone="primary">
          <div className="ink text-xl font-semibold">
            {nodes.length > 0 ? bytes(monthTotal) : "—"}
            {monthPct !== null && (
              <span
                className={cn(
                  "ml-1 text-sm font-normal",
                  monthPct >= 90 ? "text-destructive" : monthPct >= 75 ? "text-warn" : "text-muted-foreground",
                )}
              >
                {monthPct.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="ink mt-0.5 truncate text-[11px] text-muted-foreground">
            {nodes.length === 0 ? "还没有节点" : `↓ ${bytes(monthRx)} · ↑ ${bytes(monthTx)}`}
          </div>
        </Tile>

        <Tile icon={ArrowDownUp} label="实时网速" tone="info">
          <Flow down={rate(now.rx)} up={rate(now.tx)} className="text-sm font-semibold" />
          <div className="mt-1">
            <Spark
              series={[
                { values: speedHistory.map((s) => s.rx), className: "text-info" },
                { values: speedHistory.map((s) => s.tx), className: "text-chart-4" },
              ]}
            />
          </div>
        </Tile>

        {showLatency && (
          <Tile icon={Activity} label="平均延迟" tone="ok">
            <div className="ink text-xl font-semibold">{avg === null ? "—" : `${Math.round(avg)} ms`}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {lats.length > 0 ? `来自 ${lats.length} 个探测节点` : "等待探测数据"}
            </div>
          </Tile>
        )}

        {showCost && (
          <Tile icon={Wallet} label="月支出" tone="warn">
            <div className="ink text-xl font-semibold">
              {spend[0] ? money(spend[0].amount, spend[0].currency) : "—"}
              {spend[0] && <span className="text-sm font-normal text-muted-foreground"> / 月</span>}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {spend.length === 0
                ? "暂无付费节点"
                : spend.length === 1
                  ? "按账单周期折算"
                  : `另有 ${spend.slice(1).map((s) => money(s.amount, s.currency)).join(" · ")}`}
            </div>
          </Tile>
        )}
      </div>
      {showMap && <NodeMap nodes={nodes} onOpen={onOpen} />}
    </div>
  )
}
