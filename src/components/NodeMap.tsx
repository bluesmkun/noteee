import { memo, useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, Globe, X } from "lucide-react"

import { SectionTitle, StatusDot } from "@/components/Bits"
import type { Node } from "@/lib/api"
import { countryName } from "@/lib/format"
import { LAND_POSITIONS, placeOf } from "@/lib/geo"
import { cn } from "@/lib/utils"

type Tone = "all" | "some" | "none"

type Place = { code: string; label: string; x: number; y: number; nodes: Node[]; online: number }

/** 全部在线沿用主题色，部分离线橙色，全部离线红色。 */
const DOT_TEXT: Record<Tone, string> = {
  all: "text-primary",
  some: "text-warn",
  none: "text-destructive",
}

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: "all", label: "全部在线" },
  { tone: "some", label: "部分离线" },
  { tone: "none", label: "全部离线" },
]

function toneOf(place: Place): Tone {
  if (place.online === place.nodes.length) return "all"
  return place.online === 0 ? "none" : "some"
}

/** 点阵陆地是纯静态的，单独抽出来 memo 掉——否则每次节点快照推送（每 2 秒）
 *  都要重新协调近千个 circle，白白占用主线程 */
const Land = memo(function Land() {
  return (
    <g className="fill-muted-foreground/25">
      {LAND_POSITIONS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.05} />
      ))}
    </g>
  )
})

export function NodeMap({
  nodes,
  onOpen,
  className,
}: {
  nodes: Node[]
  onOpen?: (id: number) => void
  className?: string
}) {
  const places = useMemo(() => {
    const grouped = new Map<string, Place>()
    for (const node of nodes) {
      const code = (node.country || "").trim().toUpperCase()
      const point = code ? placeOf(code) : null
      if (!point) continue
      const place = grouped.get(code)
      if (place) place.nodes.push(node)
      else grouped.set(code, { code, label: countryName(code), x: point[0], y: point[1], nodes: [node], online: 0 })
    }
    for (const place of grouped.values()) place.online = place.nodes.filter((n) => n.online).length
    return [...grouped.values()]
  }, [nodes])

  const [selected, setSelected] = useState<string | null>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // 点击弹层与亮点之外的任意位置、或按 Esc 关闭地区节点列表
  useEffect(() => {
    if (selected === null) return
    const close = () => setSelected(null)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target) return close()
      if (popRef.current?.contains(target)) return // 点在弹层内部
      if (target.closest("[data-place]")) return // 点在别的亮点上，交给它自己切换
      close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [selected])

  const active = places.find((place) => place.code === selected) ?? null
  const mapped = places.reduce((sum, place) => sum + place.nodes.length, 0)
  const online = places.reduce((sum, place) => sum + place.online, 0)
  const offline = mapped - online

  return (
    <div className={cn("rise paper relative flex flex-col overflow-hidden rounded-xl border p-3.5 pt-4", className)}>
      <span className="tape pointer-events-none absolute -top-2 left-1/2 h-3 w-12 -translate-x-1/2 rotate-1 rounded-[1px]" />
      <div className="relative flex items-center gap-2">
        <SectionTitle icon={Globe}>节点分布</SectionTitle>
        <span className="ink ml-auto text-[10px] text-muted-foreground">
          {mapped} 个节点 · {places.length} 个地区
        </span>
      </div>
      <div className="relative mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground">
        <span className="ink">
          在线 <span className="text-ok">{online}</span>
          {offline > 0 && (
            <>
              {" · "}离线 <span className="text-destructive">{offline}</span>
            </>
          )}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {LEGEND.map((item) => (
            <span key={item.tone} className="inline-flex items-center gap-1">
              <span className={cn("size-1.5 shrink-0 rounded-full bg-current", DOT_TEXT[item.tone])} />
              {item.label}
            </span>
          ))}
        </span>
      </div>
      <div className="relative mt-2 min-h-36 flex-1 lg:min-h-60">
        <svg
          viewBox="0 0 360 144"
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label="节点分布世界地图"
        >
          <Land />
          {places.map((place) => {
            const picked = active?.code === place.code
            const tone = toneOf(place)
            return (
              <g
                key={place.code}
                data-place={place.code}
                className={cn(
                  DOT_TEXT[tone],
                  "cursor-pointer transition-opacity",
                  selected !== null && !picked && "opacity-40",
                )}
                onClick={() => setSelected(picked ? null : place.code)}
              >
                <title>{`${place.label} · ${place.nodes.length} 个节点 · ${place.online} 在线 / ${place.nodes.length - place.online} 离线\n${place.nodes.map((n) => n.name).join("、")}`}</title>
                <circle cx={place.x} cy={place.y} r={picked ? 7 : 5.2} fill="currentColor" fillOpacity={0.18} />
                {picked && (
                  <circle
                    cx={place.x}
                    cy={place.y}
                    r={4.1}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.7}
                    strokeWidth={0.9}
                  />
                )}
                <circle cx={place.x} cy={place.y} r={2.4} fill="currentColor" className="map-dot" />
              </g>
            )
          })}
        </svg>
        {mapped === 0 && (
          <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">暂无可定位的节点</p>
        )}
        {active && (
          <div
            ref={popRef}
            className="paper absolute inset-x-1 bottom-1 rounded-lg border p-1.5"
          >
            <div className="flex items-center justify-between gap-2 px-1.5 pb-1 text-[11px] text-muted-foreground">
              <span className="ink truncate">
                {active.label} · {active.nodes.length} 个节点 · {active.online} 在线
              </span>
              <button
                onClick={() => setSelected(null)}
                title="关闭"
                className="grid size-4 shrink-0 place-items-center rounded-[3px] transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
            <div className="max-h-28 space-y-0.5 overflow-y-auto">
              {active.nodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onOpen?.(node.id)}
                  className="flex w-full items-center gap-2 rounded-[3px] px-2 py-1 text-left text-xs transition hover:bg-muted/70"
                >
                  <StatusDot node={node} />
                  <span className="min-w-0 flex-1 truncate">{node.name}</span>
                  <span className={cn("shrink-0 text-[10px]", node.online ? "text-ok" : "text-destructive")}>
                    {node.online ? "在线" : "离线"}
                  </span>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
