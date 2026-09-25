import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react"

import {
  CountryLabel,
  ExpiryText,
  LatencyMini,
  MeterRow,
  OsLabel,
  PriceText,
  StatusDot,
} from "@/components/Bits"
import type { Latency, Node } from "@/lib/api"
import { bytes, FOREVER, pair, percent, rate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { monthUsage } from "@/lib/view"

/**
 * 列表行用 CSS grid 而不是 flex：**同一个 grid-template-columns 套在每一行上，
 * 列对齐就是构造性成立的**，不需要靠「固定宽度 + flex-1 吸收余量」去凑。
 * 被 hidden 掉的格子不占位，所以每一档断点的列数都能和实际可见的格子数对上：
 *
 *   base 2 列（节点 / 资源）→ md 3 列（+延迟）→ lg 5 列（+流量 +网络）→ xl 6 列（+到期费用）
 *
 * 权重分配：**资源列拿最大的一份**（用户要求「左侧硬件信息再详细些」），
 * 延迟 / 网络 / 到期费用三列各压到 0.7~0.85，不再和资源平分。
 */
const ROW_GRID = cn(
  "grid items-center gap-x-4 gap-y-1",
  "grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)]",
  "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,0.9fr)]",
  "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.8fr)_minmax(0,0.85fr)]",
  "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.8fr)_minmax(0,0.85fr)_minmax(0,0.7fr)]",
)

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 text-[10px] leading-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="ink min-w-0 truncate text-foreground/90">{children}</span>
    </div>
  )
}

export function NodeRow({
  node,
  latency,
  onOpen,
  showLatency = true,
  showCost = true,
}: {
  node: Node
  latency?: Latency
  onOpen: () => void
  showLatency?: boolean
  showCost?: boolean
}) {
  const m = node.metrics
  const used = monthUsage(node)
  const trafficPct = node.traffic_limit > 0 ? percent(used, node.traffic_limit) : null
  const trafficRisk =
    trafficPct !== null && trafficPct >= 90 ? "bad" : trafficPct !== null && trafficPct >= 75 ? "warn" : "ok"
  const memPct = m ? percent(m.mem_used, m.mem_total) : null
  const diskPct = m ? percent(m.disk_used, m.disk_total) : null
  const extra = [node.virt && node.virt !== "none" ? node.virt : "", node.arch].filter(Boolean).join(" · ")

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="page-turn cv-row group flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border paper-row px-3.5 py-2.5 hover:border-primary/45 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      <div className={cn(ROW_GRID, "min-w-0 flex-1")}>
        {/* 节点：两行。发行版用图标表达，把左半边填满，不再是一行文字吊在左边 */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot node={node} />
            <CountryLabel code={node.country} className="shrink-0" />
            <span className="serif min-w-0 truncate text-[13px] font-medium" title={node.name}>
              {node.name}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            {node.os ? (
              <OsLabel os={node.os} withName className="min-w-0" />
            ) : (
              <span className="min-w-0 truncate">等待首次上报</span>
            )}
            {extra && <span className="min-w-0 truncate">{extra}</span>}
          </div>
        </div>

        {/* 资源：CPU / 内存 / 硬盘 三行，每行都带真实明细（核数、负载、已用 / 总量）。
            离线时没有实时数据，就退回静态总量 —— 三行的列结构必须完全一致 */}
        <div className="min-w-0 space-y-1">
          <MeterRow
            label="CPU"
            tone="cpu"
            pct={m ? m.cpu : null}
            detail={m ? `${node.cpu_cores || "?"} 核 · 负载 ${m.load[0].toFixed(2)}` : `${node.cpu_cores || "?"} 核`}
          />
          <MeterRow
            label="内存"
            tone="mem"
            pct={memPct}
            detail={m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total)}
          />
          <MeterRow
            label="硬盘"
            tone="disk"
            pct={diskPct}
            detail={m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total)}
          />
        </div>

        {/* 流量 */}
        <div
          className="hidden min-w-0 lg:block"
          title={`本月已用 ${bytes(used)}${node.traffic_limit > 0 ? ` / ${bytes(node.traffic_limit)}` : " · 不限流量"}`}
        >
          <div className="flex min-w-0 items-baseline justify-between gap-2 text-[10px] leading-4">
            <span className="shrink-0 text-muted-foreground">流量</span>
            <span className="ink min-w-0 truncate text-foreground/90">
              {bytes(used)} / {node.traffic_limit > 0 ? bytes(node.traffic_limit) : FOREVER}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="track h-1.5 min-w-0 flex-1 overflow-hidden rounded-[2px] border">
              <span
                className={cn(
                  "block h-full origin-left transition-transform duration-700",
                  trafficRisk === "bad" ? "bar-danger" : "bar-net",
                )}
                style={{ transform: `scaleX(${(trafficPct ?? 0) / 100})` }}
              />
            </span>
            <span
              className={cn(
                "ink w-8 shrink-0 text-right text-[10px] font-semibold",
                trafficRisk === "bad" ? "text-destructive" : trafficRisk === "warn" ? "text-warn" : "text-foreground/85",
              )}
            >
              {trafficPct === null ? FOREVER : `${trafficPct.toFixed(0)}%`}
            </span>
          </div>
        </div>

        {/* 网络：上下行 + TCP/UDP，三行 */}
        <div className="hidden min-w-0 lg:block">
          <Line label="下行">
            <span className="inline-flex items-center gap-1">
              <ArrowDown className="size-3 shrink-0 text-info" />
              {m ? rate(m.net_rx) : "—"}
            </span>
          </Line>
          <Line label="上行">
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="size-3 shrink-0 text-chart-4" />
              {m ? rate(m.net_tx) : "—"}
            </span>
          </Line>
          <div
            className="flex min-w-0 items-center justify-between gap-2 text-[10px] leading-4"
            title={`TCP ${m?.tcp ?? "—"} · UDP ${m?.udp ?? "—"} · 进程 ${m?.procs ?? "—"}`}
          >
            <span className="shrink-0 text-muted-foreground">TCP / UDP</span>
            <span className="ink min-w-0 truncate text-foreground/90">{m ? `${m.tcp} / ${m.udp}` : "—"}</span>
          </div>
        </div>

        {/* 延迟色带：与卡片视图同一个组件、同一份多探测聚合数据 */}
        {showLatency && (
          <div className="hidden min-w-0 md:block">
            <LatencyMini latency={latency} />
          </div>
        )}

        {/* 到期 / 费用 */}
        <div className="hidden min-w-0 xl:block">
          <Line label="到期">
            <ExpiryText date={node.expires_at} compact className="text-[11px]" />
          </Line>
          {showCost && (
            <Line label="续费">
              <PriceText node={node} />
            </Line>
          )}
        </div>
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </div>
  )
}
