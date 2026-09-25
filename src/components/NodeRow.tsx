import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react"

import { CountryLabel, ExpiryText, LatencyMini, MiniBar, PriceText, StatusDot } from "@/components/Bits"
import type { Latency, Node } from "@/lib/api"
import { bytes, FOREVER, osName, percent, rate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { monthUsage } from "@/lib/view"

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
  const trafficRisk = trafficPct !== null && trafficPct >= 90 ? "bad" : trafficPct !== null && trafficPct >= 75 ? "warn" : "ok"
  const memPct = m ? percent(m.mem_used, m.mem_total) : null
  const diskPct = m ? percent(m.disk_used, m.disk_total) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="page-turn cv-row group flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border paper-row px-3 py-2.5 hover:border-primary/45 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      {/* 名称列给固定宽度：宽度一旦随名称长短变化，后面各列的起点就会逐行错位。
          剩余空间交给系统版本 / 流量 / 延迟三列按比例吸收，既不会在名称后留大洞，
          行与行之间的列也严格对齐 */}
      <div className="flex w-48 min-w-0 shrink-0 items-center gap-2">
        <StatusDot node={node} />
        <CountryLabel code={node.country} className="shrink-0" />
        <span className="serif truncate text-[13px] font-medium" title={node.name}>
          {node.name}
        </span>
      </div>

      <span
        className="hidden min-w-24 max-w-44 flex-1 truncate text-xs text-muted-foreground md:block"
        title={node.os ? osName(node.os) : "等待首次上报"}
      >
        {node.os ? osName(node.os) : "等待首次上报"}
      </span>

      <MiniBar className="hidden md:flex" label="CPU" tone="cpu" pct={m ? m.cpu : null} value={m ? `${m.cpu.toFixed(0)}%` : "—"} />
      <MiniBar className="hidden md:flex" label="内存" tone="mem" pct={memPct} value={memPct === null ? "—" : `${memPct.toFixed(0)}%`} />
      <MiniBar className="hidden lg:flex" label="硬盘" tone="disk" pct={diskPct} value={diskPct === null ? "—" : `${diskPct.toFixed(0)}%`} />

      <div
        className="hidden min-w-36 flex-1 lg:block"
        title={`本月已用 ${bytes(used)}${node.traffic_limit > 0 ? ` / ${bytes(node.traffic_limit)}` : " · 不限流量"}`}
      >
        <div className="flex items-baseline justify-between gap-2 text-[11px] leading-4">
          <span className="shrink-0 text-muted-foreground">流量</span>
          <span className="ink min-w-0 truncate text-muted-foreground">
            {bytes(used)} / {node.traffic_limit > 0 ? bytes(node.traffic_limit) : FOREVER}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="track h-2 min-w-0 flex-1 overflow-hidden rounded-[2px] border">
            <span
              className={cn(
                "block h-full transition-[width] duration-700",
                trafficRisk === "bad" ? "bar-danger" : "bar-net",
              )}
              style={{ width: `${trafficPct ?? 0}%` }}
            />
          </span>
          <span
            className={cn(
              "ink w-8 shrink-0 text-right text-xs font-semibold",
              trafficRisk === "bad" ? "text-destructive" : trafficRisk === "warn" ? "text-warn" : "text-foreground/85",
            )}
          >
            {trafficPct === null ? FOREVER : `${trafficPct.toFixed(0)}%`}
          </span>
        </div>
      </div>

      <div className="ink hidden w-24 shrink-0 text-[11px] leading-5 xl:block">
        <div className="flex items-center gap-1">
          <ArrowDown className="size-3 shrink-0 text-info" />
          {m ? rate(m.net_rx) : "—"}
        </div>
        <div className="flex items-center gap-1">
          <ArrowUp className="size-3 shrink-0 text-chart-4" />
          {m ? rate(m.net_tx) : "—"}
        </div>
      </div>

      <span
        className="ink hidden w-14 shrink-0 text-right text-[11px] leading-5 2xl:block"
        title={`TCP ${m?.tcp ?? "—"} · UDP ${m?.udp ?? "—"} · 进程 ${m?.procs ?? "—"}`}
      >
        <span className="block text-muted-foreground">TCP</span>
        <span className="block font-semibold">{m ? m.tcp : "—"}</span>
      </span>

      {showLatency && <LatencyMini latency={latency} className="min-w-32 flex-1 sm:min-w-40" />}

      <span className="hidden w-16 shrink-0 text-right xl:block">
        <ExpiryText date={node.expires_at} compact className="text-xs" />
      </span>
      {showCost && (
        <span className="ink hidden w-28 shrink-0 truncate text-right text-xs 2xl:block">
          <PriceText node={node} />
        </span>
      )}

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </div>
  )
}
