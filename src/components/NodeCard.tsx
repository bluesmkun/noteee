import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CalendarClock,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
} from "lucide-react"

import {
  CountryLabel,
  ExpiryText,
  LatencyPanel,
  OsLabel,
  PriceText,
  SectionTitle,
  Slot,
  StatusPill,
} from "@/components/Bits"
import { Meter } from "@/components/Meter"
import { Card } from "@/components/ui/card"
import type { Latency, Node } from "@/lib/api"
import { bytes, daysUntil, expiryRisk, FOREVER, pair, percent, rate, type ExpiryRisk } from "@/lib/format"
import { cn } from "@/lib/utils"
import { deployed, monthUsage } from "@/lib/view"

/** 到期风险只体现在文字颜色上，格子底色保持固定，避免一张卡里出现太多色块 */
const RISK_TEXT: Record<Exclude<ExpiryRisk, "none">, string> = {
  soon: "text-warn",
  critical: "text-destructive",
}

export function NodeCard({
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
  const risk = expiryRisk(daysUntil(node.expires_at))
  const serial = String((node.sort ?? 0) + 1).padStart(2, "0")

  // 发行版已经由图标表达，这里只留架构与虚拟化
  const extra = [node.virt && node.virt !== "none" ? node.virt : "", node.arch].filter(Boolean).join(" · ")

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="page-turn cv-card rise group relative min-w-0 cursor-pointer gap-0 overflow-hidden p-4 pt-5 hover:border-primary/45 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      {/* 贴在纸上的胶带 */}
      <span className="tape pointer-events-none absolute -top-2 left-6 h-3.5 w-14 -rotate-2 rounded-[1px]" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="ink shrink-0 text-[10px] text-muted-foreground/70">{serial}</span>
          <h3 className="serif line-clamp-2 text-[15px] font-semibold break-words" title={node.name}>
            {node.name}
          </h3>
        </div>
        <StatusPill node={node} className="shrink-0" />
      </div>

      {/* meta 行单独占一整行。挤在状态章旁边时它只剩 180px 左右，
          OsLabel 会被压到 0 宽，而里面那个 shrink-0 的发行版图标照样画出来，
          于是压在后面的「kvm · x86_64」上 —— 这就是「文字和图标重叠」的来源。 */}
      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <CountryLabel code={node.country} name className="shrink-0" />
        {node.os ? (
          <OsLabel os={node.os} className="shrink-0" />
        ) : (
          <span className="shrink-0">等待首次上报</span>
        )}
        {extra && <span className="min-w-0 truncate">{extra}</span>}
      </p>

      {deployed(node) ? (
        <>
          {/* 硬件占用：一张卡里最该被看见的一块，所以放在最上面、字号最大 */}
          <div className="mt-3.5 border-t border-dashed border-border pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <SectionTitle icon={Gauge}>硬件占用</SectionTitle>
              <span
                className="ink truncate text-[10px] text-muted-foreground"
                title={m ? `负载（1 / 5 / 15 分）${m.load.map((n) => n.toFixed(2)).join("  ")}` : undefined}
              >
                {m ? `负载 ${m.load[0].toFixed(2)}` : "—"}
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-2">
              <Meter
                big
                icon={Cpu}
                tone="cpu"
                label="CPU"
                pct={m ? m.cpu : null}
                foot={node.cpu_cores > 0 ? `${node.cpu_cores} 核` : "—"}
              />
              <Meter
                big
                icon={MemoryStick}
                tone="mem"
                label="内存"
                pct={m ? percent(m.mem_used, m.mem_total) : null}
                foot={m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total)}
              />
              <Meter
                big
                icon={HardDrive}
                tone="disk"
                label="硬盘"
                pct={m ? percent(m.disk_used, m.disk_total) : null}
                foot={m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total)}
              />
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-border pt-3">
            <Meter
              icon={ArrowDownUp}
              tone="net"
              label="本月流量"
              pct={trafficPct}
              empty={FOREVER}
              foot={node.traffic_limit > 0 ? pair(used, node.traffic_limit) : `${bytes(used)} / ${FOREVER}`}
            />
          </div>

          {showLatency && (
            <div className="mt-3">
              <LatencyPanel latency={latency} />
            </div>
          )}

          <div className={cn("mt-2.5 grid gap-2", showCost ? "grid-cols-2" : "grid-cols-1")}>
            <Slot title={node.expires_at ?? "永不到期"}>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarClock className="size-3.5" />
                到期
              </span>
              <ExpiryText
                date={node.expires_at}
                className={cn("truncate text-[12px] font-semibold", risk !== "none" && RISK_TEXT[risk])}
              />
            </Slot>
            {showCost && (
              <Slot title="按账单周期计费">
                <span className="shrink-0 text-[11px] text-muted-foreground">续费</span>
                <span className="min-w-0 truncate text-[12px] font-semibold">
                  <PriceText node={node} />
                </span>
              </Slot>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Slot title="实时下行速率">
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <ArrowDown className="size-3.5 shrink-0 text-info" />
                下行
              </span>
              <span className="ink min-w-0 truncate text-[12px] font-semibold">{m ? rate(m.net_rx) : "—"}</span>
            </Slot>
            <Slot title="实时上行速率">
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <ArrowUp className="size-3.5 shrink-0 text-chart-4" />
                上行
              </span>
              <span className="ink min-w-0 truncate text-[12px] font-semibold">{m ? rate(m.net_tx) : "—"}</span>
            </Slot>
          </div>

          <Slot className="mt-2 gap-3" title="TCP / UDP 连接数与进程数">
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
              <Network className="size-3.5 shrink-0" />
              连接
            </span>
            <span className="ink flex min-w-0 items-baseline gap-2.5 text-[12px]">
              <span className="truncate">
                TCP <span className="font-semibold">{m ? m.tcp : "—"}</span>
              </span>
              <span className="truncate text-muted-foreground">
                UDP <span className="font-semibold">{m ? m.udp : "—"}</span>
              </span>
              <span className="truncate text-muted-foreground">
                进程 <span className="font-semibold">{m ? m.procs : "—"}</span>
              </span>
            </span>
          </Slot>
        </>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          还没有接入。在后台生成安装命令并执行一次。
        </p>
      )}
    </Card>
  )
}
