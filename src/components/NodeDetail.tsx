import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { Activity, ArrowDownUp, ChevronLeft, Cpu, MemoryStick, Network, Wallet } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { CountryLabel, latencyText, OsLabel, Stat, StatusPill, TONE_TEXT, type IconType } from "@/components/Bits"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchHistory, type History, type Latency, type Node, type PingPoint } from "@/lib/api"
import {
  axisBytes,
  axisTop,
  bytes,
  clockFor,
  cpuName,
  CYCLES,
  daysUntil,
  duration,
  expiryLabel,
  FOREVER,
  jitterTone,
  latencyTone,
  loadTone,
  lossTone,
  money,
  osName,
  pair,
  percent,
  quarters,
  rate,
  timeTicks,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import { monthUsage } from "@/lib/view"

const RANGES = [
  { hours: 1, label: "1 小时" },
  { hours: 6, label: "6 小时" },
  { hours: 24, label: "24 小时" },
  { hours: 168, label: "7 天" },
]

const TABS = [
  { key: "resources", label: "资源" },
  { key: "latency", label: "网络延迟" },
] as const

type TabKey = (typeof TABS)[number]["key"]

const RANGES_FOR: Record<TabKey, typeof RANGES> = {
  resources: RANGES,
  latency: RANGES.filter((r) => r.hours <= 24),
}

const AXIS = { stroke: "currentColor", fontSize: 11, tickLine: false, axisLine: false }
const SERIES = { dot: false as const, strokeWidth: 1.5, isAnimationActive: false }
const Y_WIDTH = 64

/** 图表浮层跟着主题走：深色下 recharts 默认的白底浮层会非常刺眼 */
const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid var(--color-border)",
  background: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  boxShadow: "0 10px 22px -16px rgb(0 0 0 / 0.5)",
} as const

const PROBE_GRID = "grid-cols-[minmax(6rem,1fr)_3.5rem_3.5rem_4.5rem_3.25rem_4.5rem]"

type FactRow = { label: string; value: ReactNode; title?: string }
type FactGroup = { label: string; icon: IconType; facts: FactRow[] }

const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="paper rounded-xl border p-4">
      <h4 className="label-caps mb-3 text-[10px] text-muted-foreground">{title}</h4>
      <div className="h-44 w-full text-muted-foreground">{children}</div>
    </div>
  )
}

function Tab({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-[3px] px-2.5 py-1 text-xs transition",
        active ? "paper-sm font-medium text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function despike(points: PingPoint[], window = 7, sigmas = 3): PingPoint[] {
  const half = window >> 1
  return points.map((p, i) => {
    if (p.latency === null) return p
    const near = points
      .slice(Math.max(0, i - half), i + half + 1)
      .map((x) => x.latency)
      .filter((v): v is number => v !== null)
    const mid = median(near) ?? p.latency
    const mad = median(near.map((v) => Math.abs(v - mid))) ?? 0
    const outlier = mad > 0 && Math.abs(p.latency - mid) > sigmas * 1.4826 * mad
    return outlier ? { ...p, latency: mid } : p
  })
}

function movingAverage(points: PingPoint[], window = 5): (number | null)[] {
  const half = window >> 1
  return points.map((p, i) => {
    if (p.latency === null) return null
    let sum = 0
    let weight = 0
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      const value = points[j].latency
      if (value === null) continue
      const w = half + 1 - Math.abs(j - i)
      sum += value * w
      weight += w
    }
    return weight > 0 ? sum / weight : p.latency
  })
}

export function NodeDetail({
  node,
  latency,
  onBack,
  showCost = true,
}: {
  node: Node
  latency?: Latency
  onBack: () => void
  showCost?: boolean
}) {
  const [tab, setTab] = useState<TabKey>("resources")
  const [ranges, setRanges] = useState<Record<TabKey, number>>({ resources: 6, latency: 6 })
  const hours = ranges[tab]
  const [smooth, setSmooth] = useState(false)
  const [smoothLine, setSmoothLine] = useState(true)
  const [hiddenProbes, setHiddenProbes] = useState<number[]>([])
  const [only, setOnly] = useState<number | null>(null)
  const [data, setData] = useState<History | null>(null)
  const [failed, setFailed] = useState("")

  useEffect(() => {
    let active = true
    setData(null)
    setFailed("")
    const points = Math.round(globalThis.innerWidth * (globalThis.devicePixelRatio || 1))
    const series = tab === "latency" ? "ping" : "metrics"
    fetchHistory(node.id, hours, series, points)
      .then((next) => {
        if (active) setData(next)
      })
      .catch((e: Error) => {
        if (active) {
          setFailed(e.message || "网络错误")
          setData({ metrics: [], ping: [], probes: {} })
        }
      })
    return () => {
      active = false
    }
  }, [node.id, hours, tab])

  const m = node.metrics
  const current = latencyText(latency)

  const pingSeries = useMemo(
    () =>
      [...new Set((data?.ping ?? []).map((p) => p.task_id))]
        .map((id) => {
          const points = (data?.ping ?? []).filter((p) => p.task_id === id)
          const values = points.map((p) => p.latency).filter((v): v is number => v !== null)
          let jitter: number | null = null
          if (values.length >= 2) {
            let sum = 0
            for (let i = 1; i < values.length; i++) sum += Math.abs(values[i] - values[i - 1])
            jitter = sum / (values.length - 1)
          }
          return {
            id,
            name: data?.probes?.[String(id)] ?? `探测 ${id}`,
            points,
            loss: data?.loss?.[String(id)] ?? 0,
            latest: points[points.length - 1]?.latency ?? null,
            avg: values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null,
            min: values.length > 0 ? Math.min(...values) : null,
            max: values.length > 0 ? Math.max(...values) : null,
            jitter,
          }
        })
        .filter((s) => s.points.length > 0),
    [data],
  )

  const metricRows = useMemo(() => (data?.metrics ?? []).map((p) => ({ ...p, ts: p.ts * 1000 })), [data])

  const tops = useMemo(() => {
    const max = (pick: (m: (typeof metricRows)[number]) => number) =>
      metricRows.reduce((hi, row) => Math.max(hi, pick(row)), 0)
    return {
      cpu: axisTop(max((row) => row.cpu), 4, 10, 100),
      rate: axisTop(max((row) => Math.max(row.net_rx, row.net_tx)), 1024, 1024),
    }
  }, [metricRows])

  const activeOnly = only !== null && pingSeries.some((s) => s.id === only) ? only : null

  const shownProbes = useMemo(
    () =>
      activeOnly !== null
        ? pingSeries.filter((s) => s.id === activeOnly)
        : pingSeries.filter((s) => !hiddenProbes.includes(s.id)),
    [pingSeries, hiddenProbes, activeOnly],
  )

  const style = (id: number) => PALETTE[pingSeries.findIndex((p) => p.id === id) % PALETTE.length]

  const pingRows = useMemo(() => {
    const rows = new Map<number, { ts: number } & Record<string, number | null>>()
    for (const s of pingSeries) {
      const smoothed = despike(s.points)
      const averaged = movingAverage(smooth ? smoothed : s.points)
      s.points.forEach((p, i) => {
        const row = rows.get(p.ts) ?? { ts: p.ts * 1000 }
        row[`t${s.id}`] = p.latency
        row[`s${s.id}`] = smoothed[i].latency
        row[`m${s.id}`] = averaged[i]
        row[`l${s.id}`] = p.loss ?? 0
        rows.set(p.ts, row)
      })
    }
    return [...rows.values()].sort((a, b) => a.ts - b.ts)
  }, [pingSeries, smooth])

  const timeAxis = (rows: { ts: number }[]) => ({
    dataKey: "ts",
    type: "number" as const,
    domain: ["dataMin", "dataMax"] as const,
    ticks: rows.length > 0 ? timeTicks(rows[0].ts, rows[rows.length - 1].ts) : undefined,
    tickFormatter: clockFor(hours),
    minTickGap: hours > 24 ? 72 : 40,
    ...AXIS,
  })

  const used = monthUsage(node)
  const cycle = CYCLES[node.billing_cycle] ?? node.billing_cycle
  const groups: FactGroup[] = []
  const group = (label: string, icon: IconType) => {
    const facts: FactRow[] = []
    groups.push({ label, icon, facts })
    // value 可以是节点（系统那一行要放发行版图标），title 单独给，不再拿 value 当提示文字
    return (name: string, value?: ReactNode, title?: string) => {
      if (value === undefined || value === null || value === "") return
      facts.push({ label: name, value, title: title ?? (typeof value === "string" ? value : undefined) })
    }
  }

  const hardware = group("硬件配置", Cpu)
  hardware(
    "系统",
    node.os ? (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <OsLabel os={node.os} withName />
        {node.kernel && <span className="min-w-0 truncate text-muted-foreground">{node.kernel}</span>}
      </span>
    ) : (
      node.kernel || ""
    ),
    [node.os ? osName(node.os) : "", node.kernel].filter(Boolean).join(" · "),
  )
  hardware("CPU", node.cpu_name ? `${cpuName(node.cpu_name)} × ${node.cpu_cores}` : node.cpu_cores > 0 ? `${node.cpu_cores} 核` : "")
  hardware("内存 / 硬盘", node.mem_total || node.disk_total ? `${bytes(node.mem_total)} / ${bytes(node.disk_total)}` : "")
  hardware("交换分区", node.swap_total > 0 ? pair(m?.swap_used ?? 0, node.swap_total) : "无")
  hardware("架构", [node.arch, node.virt && node.virt !== "none" ? node.virt : ""].filter(Boolean).join(" · "))

  const runtime = group("运行状态", Activity)
  runtime("负载 (1/5/15 分)", m ? m.load.map((v) => v.toFixed(2)).join("  ") : "")
  runtime("进程 / TCP / UDP", m ? `${m.procs} / ${m.tcp} / ${m.udp}` : "")
  runtime("在线时长", m ? duration(m.uptime) : "")
  runtime("Agent", node.agent_version && `v${node.agent_version.replace(/^v/, "")}`)

  const network = group("网络与流量", ArrowDownUp)
  network("今日流量", `↓ ${bytes(node.day_rx)} · ↑ ${bytes(node.day_tx)}`)
  network("本月流量", node.traffic_limit > 0 ? pair(used, node.traffic_limit) : `${bytes(used)} / ${FOREVER}`)
  network("累计流量", `↓ ${bytes(node.total_rx)} · ↑ ${bytes(node.total_tx)}`)
  network("主机名", node.hostname)
  network("IP", node.ip)

  const billing = group(showCost ? "费用与到期" : "到期", Wallet)
  if (showCost) {
    billing("续费", node.price > 0 ? `${money(node.price, node.currency)}${cycle ? ` / ${cycle}` : ""}` : "免费")
  }
  billing("到期", node.expires_at ? `${node.expires_at} · ${expiryLabel(daysUntil(node.expires_at))}` : "永不到期")

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="paper-sm press inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          返回
        </button>
        <h2 className="serif truncate text-lg font-semibold">{node.name}</h2>
        <CountryLabel code={node.country} name className="text-sm" />
        <StatusPill node={node} />
        {node.agent_version && (
          <Badge variant="outline" className="font-normal">
            agent {node.agent_version}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Cpu}
          label="CPU 使用率"
          value={m ? `${m.cpu.toFixed(1)}%` : "—"}
          sub={m ? `负载 ${m.load[0].toFixed(2)}` : undefined}
          tone={m ? loadTone(m.cpu) : "muted"}
        />
        <Stat
          icon={MemoryStick}
          label="内存 / 硬盘"
          value={m ? `${percent(m.mem_used, m.mem_total).toFixed(0)}% / ${percent(m.disk_used, m.disk_total).toFixed(0)}%` : "—"}
          sub={m ? `${bytes(m.mem_used)} / ${bytes(m.disk_used)}` : undefined}
        />
        <Stat
          icon={Network}
          label="TCP / UDP"
          value={m ? `${m.tcp} / ${m.udp}` : "—"}
          sub={m ? `${m.procs} 个进程` : undefined}
          tone="info"
        />
        <Stat
          icon={Activity}
          label="当前延迟"
          value={current.text}
          sub={
            latency
              ? [latency.probe, latency.jitter !== null ? `波动 ${Math.round(latency.jitter)} ms` : ""]
                  .filter(Boolean)
                  .join(" · ") || "无探测任务"
              : "无探测任务"
          }
          tone={current.tone}
        />
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="slot flex items-center gap-0.5 rounded-[4px] border p-0.5">
            {TABS.map((t) => (
              <Tab key={t.key} active={tab === t.key} title={t.label} onClick={() => setTab(t.key)}>
                {t.label}
              </Tab>
            ))}
          </div>
          <div className="slot flex items-center gap-0.5 rounded-[4px] border p-0.5">
            {RANGES_FOR[tab].map((r) => (
              <Tab
                key={r.hours}
                active={hours === r.hours}
                title={r.label}
                onClick={() => setRanges((all) => ({ ...all, [tab]: r.hours }))}
              >
                {r.label}
              </Tab>
            ))}
          </div>
          {tab === "latency" && (
            <div className="slot flex items-center gap-0.5 rounded-[4px] border p-0.5">
              <Tab active={smooth} title="削峰" onClick={() => setSmooth((v) => !v)}>
                削峰
              </Tab>
              <Tab active={smoothLine} title="平滑" onClick={() => setSmoothLine((v) => !v)}>
                平滑
              </Tab>
            </div>
          )}
          {tab === "latency" && pingSeries.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              曲线
              <Select
                aria-label="选择显示的延迟节点"
                value={activeOnly === null ? "all" : String(activeOnly)}
                onChange={(e) => setOnly(e.target.value === "all" ? null : Number(e.target.value))}
                className="paper-sm border-transparent bg-transparent"
              >
                <option value="all">全部探测</option>
                {pingSeries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>

        {!data ? (
          <Skeleton className="h-44 w-full" />
        ) : failed ? (
          <p className="py-8 text-center text-sm text-destructive" role="alert">
            读取历史数据失败：{failed}
          </p>
        ) : tab === "latency" ? (
          pingSeries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">这段时间没有延迟数据</p>
          ) : (
            <div className="space-y-3">
              <div className="paper rounded-xl border p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">网络延迟</h4>
                  <span className="tnum text-[11px] text-muted-foreground">
                    {shownProbes.length === 1
                      ? shownProbes[0].name
                      : `显示 ${shownProbes.length} / ${pingSeries.length} 个探测`}
                  </span>
                </div>
                <div className={cn("w-full text-muted-foreground", shownProbes.length === 1 ? "h-72" : "h-64")}>
                  {shownProbes.length === 0 ? (
                    <p className="grid h-full place-items-center text-sm">没有选中任何探测</p>
                  ) : (
                    <ResponsiveContainer>
                      <ComposedChart data={pingRows}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis {...timeAxis(pingRows)} fontSize={12} />
                        <YAxis unit="ms" width={60} domain={["auto", "auto"]} {...AXIS} fontSize={12} />
                        <Tooltip
                          labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                          formatter={(v, name, item) => {
                            const loss = Number(item?.payload?.[`l${String(item.dataKey).slice(1)}`] ?? 0)
                            return [`${Number(v)} ms${loss > 0 ? ` · 丢 ${loss}%` : ""}`, name]
                          }}
                          contentStyle={TOOLTIP_STYLE}
                          itemStyle={{ padding: 0 }}
                        />
                        {shownProbes.length === 1 && shownProbes[0].avg !== null && (
                          <ReferenceLine
                            y={shownProbes[0].avg}
                            stroke={style(shownProbes[0].id)}
                            strokeDasharray="4 4"
                            strokeOpacity={0.55}
                            label={{
                              value: `平均 ${Math.round(shownProbes[0].avg)} ms`,
                              position: "insideTopRight",
                              fontSize: 11,
                              fill: "var(--color-muted-foreground)",
                            }}
                          />
                        )}
                        {shownProbes.map((s) => (
                          <Line
                            key={s.id}
                            dataKey={`${smoothLine ? "m" : smooth ? "s" : "t"}${s.id}`}
                            name={s.name}
                            type={smoothLine ? "monotone" : "linear"}
                            stroke={style(s.id)}
                            {...SERIES}
                            strokeWidth={2}
                            activeDot={{ r: 3, strokeWidth: 0 }}
                            connectNulls
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="paper overflow-hidden rounded-xl border">
                <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                  <h4 className="text-xs font-medium text-muted-foreground">多节点延迟</h4>
                  <span className="text-[11px] text-muted-foreground">点击整行显示 / 隐藏曲线</span>
                </div>
                <div className={cn(PROBE_GRID, "grid items-center gap-x-3 px-4 py-1.5 text-[11px] text-muted-foreground")}>
                  <span>探测节点</span>
                  <span className="text-right">当前</span>
                  <span className="text-right">平均</span>
                  <span className="text-right">波动</span>
                  <span className="text-right">丢包</span>
                  <span className="text-right">仅看</span>
                </div>
                {pingSeries.map((s) => {
                  const shown = activeOnly === null ? !hiddenProbes.includes(s.id) : s.id === activeOnly
                  const toggle = () =>
                    activeOnly !== null
                      ? setOnly(s.id)
                      : setHiddenProbes((h) => (shown ? [...h, s.id] : h.filter((id) => id !== s.id)))
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={toggle}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
                      className={cn(
                        PROBE_GRID,
                        "grid cursor-pointer items-center gap-x-3 border-t border-border/60 px-4 py-2 text-xs transition",
                        shown ? "hover:bg-muted/50" : "opacity-40 hover:opacity-70",
                        activeOnly === s.id && "bg-primary/8",
                      )}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <svg width="16" height="6" className="shrink-0" aria-hidden>
                          <line x1="0" y1="3" x2="16" y2="3" stroke={style(s.id)} strokeWidth="2" />
                        </svg>
                        <span className="truncate font-medium">{s.name}</span>
                      </span>
                      <span className={cn("tnum text-right", TONE_TEXT[latencyTone(s.latest, s.loss)])}>
                        {s.latest === null ? "超时" : `${Math.round(s.latest)} ms`}
                      </span>
                      <span className={cn("tnum text-right", TONE_TEXT[latencyTone(s.avg, s.loss)])}>
                        {s.avg === null ? "—" : `${Math.round(s.avg)} ms`}
                      </span>
                      <span className={cn("tnum text-right", TONE_TEXT[jitterTone(s.jitter)])}>
                        {s.jitter === null ? "—" : `${Math.round(s.jitter)} ms`}
                      </span>
                      <span className={cn("tnum text-right", TONE_TEXT[lossTone(s.loss)])}>
                        {s.loss < 1 && s.loss > 0 ? "<1%" : `${Math.round(s.loss)}%`}
                      </span>
                      <span className="text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOnly(activeOnly === s.id ? null : s.id)
                          }}
                          title={activeOnly === s.id ? "取消仅看" : "只看这一条线路"}
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[11px] transition",
                            activeOnly === s.id
                              ? "border-primary/40 bg-primary/12 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {activeOnly === s.id ? "取消" : "仅看"}
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        ) : data.metrics.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">这段时间没有历史数据</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="CPU 使用率">
              <ResponsiveContainer>
                <AreaChart data={metricRows}>
                  <defs>
                    <linearGradient id="fill-cpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis {...timeAxis(metricRows)} />
                  <YAxis domain={[0, tops.cpu]} ticks={quarters(tops.cpu)} unit="%" width={Y_WIDTH} {...AXIS} />
                  <Tooltip
                    labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, "CPU"]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Area dataKey="cpu" name="CPU" stroke="var(--color-chart-1)" fill="url(#fill-cpu)" {...SERIES} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title={`内存 · ${bytes(node.mem_total)}`}>
              <ResponsiveContainer>
                <AreaChart data={metricRows}>
                  <defs>
                    <linearGradient id="fill-mem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis {...timeAxis(metricRows)} />
                  <YAxis domain={[0, node.mem_total]} ticks={quarters(node.mem_total)} tickFormatter={axisBytes} width={Y_WIDTH} {...AXIS} />
                  <Tooltip
                    labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                    formatter={(v) => bytes(Number(v))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Area dataKey="mem_used" name="内存" stroke="var(--color-chart-2)" fill="url(#fill-mem)" {...SERIES} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="网络速率">
              <ResponsiveContainer>
                <LineChart data={metricRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis {...timeAxis(metricRows)} />
                  <YAxis domain={[0, tops.rate]} ticks={quarters(tops.rate)} tickFormatter={axisBytes} unit="/s" width={Y_WIDTH} {...AXIS} />
                  <Tooltip
                    labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                    formatter={(v) => rate(Number(v))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Line dataKey="net_rx" name="下行" stroke="var(--color-info)" {...SERIES} />
                  <Line dataKey="net_tx" name="上行" stroke="var(--color-chart-4)" {...SERIES} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title={`硬盘 · ${bytes(node.disk_total)}`}>
              <ResponsiveContainer>
                <AreaChart data={metricRows}>
                  <defs>
                    <linearGradient id="fill-disk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis {...timeAxis(metricRows)} />
                  <YAxis domain={[0, node.disk_total]} ticks={quarters(node.disk_total)} tickFormatter={axisBytes} width={Y_WIDTH} {...AXIS} />
                  <Tooltip
                    labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                    formatter={(v) => bytes(Number(v))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Area dataKey="disk_used" name="硬盘" stroke="var(--color-chart-3)" fill="url(#fill-disk)" {...SERIES} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="grid gap-3 md:grid-cols-2">
          {groups
            .filter((item) => item.facts.length > 0)
            .map(({ label, icon: Icon, facts }) => (
              <section key={label} className="paper rounded-xl border p-4">
                <h4 className="flex items-center gap-2 text-muted-foreground">
                  <span className="grid size-6 shrink-0 place-items-center rounded-[3px] border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="label-caps text-[10px]">{label}</span>
                </h4>
                <dl className="mt-3 grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2">
                  {facts.map((fact) => (
                    <Fragment key={fact.label}>
                      <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                      <dd className="ink min-w-0 text-sm break-words" title={fact.title}>
                        {fact.value}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
              </section>
            ))}
        </div>

        {node.remark && (
          <p className="slot rounded-[3px] border px-3 py-2 text-sm whitespace-pre-wrap">{node.remark}</p>
        )}
      </div>
    </div>
  )
}
