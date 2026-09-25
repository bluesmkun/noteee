import type { ReactNode } from "react"
import { Activity, ArrowDown, ArrowDownUp, ArrowUp, Database, Wallet } from "lucide-react"

import { type IconType } from "@/components/Bits"
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

/**
 * 概览卡在**手机上排 2 列**（4 张卡一屏看完），节点卡仍是 1 列 ——
 * 手机上卡片只有 170px 上下宽，节点卡那套信息塞不进两列。
 * sm 起两边完全一致（2 / 3 / 4 列），列边界仍然严格对齐。
 */
const SUMMARY_GRID = "grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

/**
 * 概览卡。三件事必须一起成立，否则卡片就会「一块大一块小」：
 *   1. 卡片自己 h-full + flex-col —— 多出来的高度变成留白，而不是把卡片撑得参差不齐
 *   2. lg 起靠栅格 auto-rows-fr 等高；窄屏靠 min-h 等高（那时地图整行铺满，不能开 auto-rows-fr）
 *   3. sm 起与节点卡共用列宽 —— 上下两组的列边界严格对齐
 */
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
    // min-h 只在窄屏起作用：那时没有 auto-rows-fr，靠它让四张卡等高
    // （最矮的「平均延迟」和最高的「实时网速」差 50px）。
    // lg 起交回给 auto-rows-fr，卡片恢复按内容高度，不会平白多出空白。
    <div className="rise paper relative flex h-full min-h-[10rem] flex-col overflow-hidden rounded-xl border p-3.5 pt-4 lg:min-h-0">
      <span className="tape pointer-events-none absolute -top-2 left-1/2 h-3 w-12 -translate-x-1/2 rounded-[1px]" />
      {/* 窄屏卡片窄，居中排更整齐；sm 起恢复左对齐（与节点卡一致） */}
      <div className="relative flex shrink-0 items-center justify-center gap-2 text-muted-foreground sm:justify-start">
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-[3px] border", BUBBLE[tone])}>
          <Icon className="size-3.5" />
        </span>
        <span className="label-caps text-[10px]">{label}</span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-1 pt-1 text-center sm:items-stretch sm:text-left">
        {children}
      </div>
    </div>
  )
}

/** 上下行。宽屏用两列等宽栅格（两列起点固定，↓ 和 ↑ 的数值才对齐，
 *  也和上面那行大数字左对齐）；窄屏卡片只有 170px，一行塞不下两段，改成上下两行居中 */
function Flow({ down, up, className }: { down: string; up: string; className?: string }) {
  return (
    <div
      className={cn(
        "ink grid justify-items-center gap-x-3 sm:grid-cols-2 sm:justify-items-stretch",
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-1">
        <ArrowDown className="size-3 shrink-0 text-info" />
        <span className="truncate">{down}</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1">
        <ArrowUp className="size-3 shrink-0 text-chart-4" />
        <span className="truncate">{up}</span>
      </span>
    </div>
  )
}

function Spark({ series }: { series: { values: number[]; className: string }[] }) {
  // 页面刚打开时 speedHistory 只有一个样本，polyline 画不出线，
  // 卡片里就是一大片空白。复制一份凑够两个点，至少画出一条平的基线。
  const filled = series.map((s) =>
    s.values.length >= 2 ? s.values : s.values.length === 1 ? [s.values[0], s.values[0]] : [0, 0],
  )
  const top = Math.max(...filled.flat(), 1)
  const width = Math.max(...filled.map((v) => v.length), 2) - 1
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      {filled.map((values, i) => (
        <polyline
          key={i}
          className={series[i].className}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          points={values.map((v, x) => `${(x / width) * 100},${23 - (v / top) * 22}`).join(" ")}
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
  const dayRx = nodes.reduce((sum, n) => sum + n.day_rx, 0)
  const dayTx = nodes.reduce((sum, n) => sum + n.day_tx, 0)
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
    // auto-rows-fr 只在 lg 起用：那时地图钉在右侧、纵向跨两行，需要各行等高才不会「一块大一块小」。
    // 窄屏（2 列）地图是整行铺满、自己占一行，一旦也开 auto-rows-fr，
    // 地图那一行的高度（244px）会把 4 张概览卡一起拉成 244 —— 手机上一屏只看得下两张半。
    <div className={cn(SUMMARY_GRID, "lg:auto-rows-fr")}>
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
        <div className="ink truncate text-[11px] text-muted-foreground">
          {nodes.length === 0 ? "还没有节点" : `本月 ↓ ${bytes(monthRx)} · ↑ ${bytes(monthTx)}`}
        </div>
        <div className="ink truncate text-[10px] text-muted-foreground/80">
          今日 ↓ {bytes(dayRx)} · ↑ {bytes(dayTx)}
        </div>
      </Tile>

      <Tile icon={ArrowDownUp} label="实时网速" tone="info">
        <div className="ink text-xl font-semibold">{rate(now.rx + now.tx)}</div>
        <Flow down={rate(now.rx)} up={rate(now.tx)} className="text-[11px]" />
        {/* 固定高度：给 flex-1 + h-full 的话，SVG 会按 viewBox 比例（100:24）撑出
            78px 的固有高度，把整行顶到 190px，概览卡和地图卡都跟着虚胖 */}
        <div className="flex h-7 w-full shrink-0 items-end sm:h-10">
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
          <div className="truncate text-[11px] text-muted-foreground">
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
          <div className="truncate text-[11px] text-muted-foreground">
            {spend.length === 0
              ? "暂无付费节点"
              : spend.length === 1
                ? "按账单周期折算"
                : `另有 ${spend.slice(1).map((s) => money(s.amount, s.currency)).join(" · ")}`}
          </div>
        </Tile>
      )}

      {showMap && (
        // 四张概览卡铺在左侧 2 列 × 2 行，地图钉在第 3 列起、纵向跨两行：
        //   lg（3 列）→ 地图占第 3 列 1 格；xl（4 列）→ 地图占 3、4 两列。
        // 两种列数下左侧都刚好是 2 × 2 = 4 格，一张不多一张不少。
        // 窄屏（1~2 列）退回整行铺满，排在概览卡之后。
        //
        // 用 [grid-column:...] 而不是 col-start-3 + col-span-2：
        // col-span-* 是 `grid-column: span N / span N` 的简写，会把 col-start-* 设的起始线一起重置，
        // 结果地图跑到第 1 列去了（实测过）。写成简写一次性给全就没这个坑。
        <NodeMap
          nodes={nodes}
          onOpen={onOpen}
          className="col-span-full lg:[grid-column:3/span_1] lg:[grid-row:1/span_2] xl:[grid-column:3/span_2]"
        />
      )}
    </div>
  )
}
