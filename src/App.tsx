import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { Activity, Pin, SearchX, Wrench } from "lucide-react"

import { Appearance } from "@/components/Appearance"
import { NodeCard } from "@/components/NodeCard"
import { CARD_GRID, CountryLabel } from "@/components/Bits"
import { NodeRow } from "@/components/NodeRow"
import { Summary } from "@/components/Summary"
import { Toolbar } from "@/components/Toolbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, useLatency, useNodes, type Me, type Node } from "@/lib/api"
import { hasStored, readStored, useStoredState } from "@/lib/store"
import { DEFAULTS, loadConfig, PAPERS, VERSION, type Paper, type ThemeConfig } from "@/lib/theme"
import {
  GROUP_KEYS,
  groupNodes,
  searchNodes,
  sortNodes,
  SORT_KEYS,
  statusOf,
  VIEW_MODES,
  type Group,
} from "@/lib/view"

const loadDetail = () => import("@/components/NodeDetail").then((m) => ({ default: m.NodeDetail }))
const NodeDetail = lazy(loadDetail)

const DATE = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" })

function useNodeRoute() {
  const read = () => {
    const match = location.pathname.match(/^\/node\/(\d+)/)
    return match ? Number(match[1]) : null
  }
  const [id, setId] = useState(read)
  useEffect(() => {
    const sync = () => setId(read())
    addEventListener("popstate", sync)
    return () => removeEventListener("popstate", sync)
  }, [])
  return [
    id,
    (next: number | null) => {
      history.pushState({}, "", next === null ? "/" : `/node/${next}`)
      setId(next)
      scrollTo(0, 0)
    },
  ] as const
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme")
    return saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])
  return [dark, setDark] as const
}

/** 站点设置和 /api/me、/api/nodes 并行取，不排在它们后面 */
function useConfig(): [ThemeConfig, boolean] {
  const [config, setConfig] = useState<ThemeConfig>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let active = true
    loadConfig().then((next) => {
      if (!active) return
      setConfig(next)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])
  return [config, loaded]
}

/**
 * 纸张色调。站点设置里定的是默认值，访客在工具栏上选过之后以访客为准。
 *
 * 这里刻意不用 `useStoredState`：那个 hook 只要值一变就落盘，而「站点默认值生效」
 * 也是一次变化 —— 于是默认值被钉进 localStorage，站长以后改默认值就再也推不下去。
 * 只有访客真的点了色块才写盘。
 */
function usePaper(config: ThemeConfig) {
  const [chosen, setChosen] = useState<Paper | null>(() => readStored("noteee.paper", PAPERS))
  const paper = chosen ?? config.paper

  useEffect(() => {
    document.documentElement.dataset.paper = paper
  }, [paper])

  const choose = useCallback((value: Paper) => {
    setChosen(value)
    try {
      localStorage.setItem("noteee.paper", value)
    } catch {
      // 隐私模式下写不了，但本次会话里照样生效
    }
  }, [])

  return [paper, choose] as const
}

/** 公告按纯文本渲染（React 默认转义），不交给 innerHTML */
function Notice({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <div className="paper rise flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm">
      <Pin className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      <p className="min-w-0 whitespace-pre-wrap">{text}</p>
    </div>
  )
}

/** 页脚：本子最后一行的「页脚注」。虚线分隔 + 等宽小字，跟正文的纸感一致 */
function Footer({ nodes, updatedAt }: { nodes: Node[] | null; updatedAt: number | null }) {
  const list = nodes ?? []
  const online = list.filter((n) => statusOf(n) === "online").length
  const offline = list.filter((n) => statusOf(n) === "offline").length
  const pending = list.filter((n) => statusOf(n) === "pending").length
  return (
    <footer className="mx-auto max-w-[1500px] px-4 pb-7 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground">
        <span className="label-caps text-[10px] text-foreground/70">noteee</span>
        <span className="ink">v{VERSION}</span>
        <span className="hidden h-px flex-1 border-t border-dashed border-border/70 sm:block" />
        <span className="ink">
          共 {list.length} 个节点 · {online} 在线
          {offline > 0 && ` · ${offline} 离线`}
          {pending > 0 && ` · ${pending} 未接入`}
        </span>
        <span className="ink">
          最后更新 {updatedAt === null ? "—" : new Date(updatedAt).toLocaleTimeString("zh-CN", { hour12: false })}
        </span>
        <a
          href="https://github.com/bluesmkun/noteee"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
        >
          主题源码
        </a>
      </div>
    </footer>
  )
}

function GroupHeader({ group }: { group: Group }) {  const online = group.nodes.filter((n) => n.online).length
  return (
    <div className="flex items-center gap-2 px-1 pt-1">
      {group.code ? (
        <h2 className="serif flex items-center gap-1.5 text-[13px] font-semibold">
          <CountryLabel code={group.code} />
          {group.label}
        </h2>
      ) : (
        <h2 className="serif text-[13px] font-semibold">{group.label}</h2>
      )}
      <Badge variant="muted">{group.nodes.length}</Badge>
      <span className="ink text-[11px] text-muted-foreground">{online} 在线</span>
      <span className="h-px flex-1 border-t border-dashed border-border" />
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useTheme()
  const [config, configLoaded] = useConfig()
  const [me, setMe] = useState<Me | null>(null)
  const [meError, setMeError] = useState("")
  const { nodes, error, closed, updatedAt } = useNodes()
  const latency = useLatency(nodes)
  const [open, go] = useNodeRoute()

  const [view, setView] = useStoredState("noteee.view", "grid", VIEW_MODES)
  const [group, setGroup] = useStoredState("noteee.group", "none", GROUP_KEYS)
  const [sort, setSort] = useStoredState("noteee.sort", "default", SORT_KEYS)
  const [paper, choosePaper] = usePaper(config)
  const [query, setQuery] = useState("")

  const loadMe = useCallback(
    () =>
      api<Me>("/me")
        .then((next) => {
          setMe(next)
          setMeError("")
        })
        .catch((e: Error) => setMeError(e.message || "网络错误")),
    [],
  )

  useEffect(() => {
    loadMe()
    void loadDetail()
  }, [loadMe])

  useEffect(() => {
    if (closed) void loadMe()
  }, [closed, loadMe])

  useEffect(() => {
    if (me && !me.public_page && !me.authed) location.href = "/admin/"
  }, [me])

  // 站点设置的默认视图只在「读到了设置」且「访客没自己选过」时生效
  const [applied, setApplied] = useState(false)
  useEffect(() => {
    if (!configLoaded || applied) return
    setApplied(true)
    if (!hasStored("noteee.view")) setView(config.layout)
  }, [configLoaded, applied, config.layout, setView])

  const sorted = useMemo(() => sortNodes(nodes ?? [], sort), [nodes, sort])
  const filtered = useMemo(() => searchNodes(sorted, query), [sorted, query])
  const groups = useMemo(() => groupNodes(filtered, group), [filtered, group])
  const selected = (nodes ?? []).find((n) => n.id === open)

  useEffect(() => {
    document.title = [selected?.name, me?.site_name || "Monitor"].filter(Boolean).join(" · ")
  }, [selected?.name, me?.site_name])

  if (!me) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">
        {meError ? (
          <div className="space-y-3 text-center">
            <p role="alert">加载失败：{meError}</p>
            <Button onClick={loadMe}>重试</Button>
          </div>
        ) : (
          "加载中…"
        )}
      </div>
    )
  }

  if (!me.public_page && !me.authed) return null

  return (
    <div className="min-h-svh">
      {/* 吸顶栏不用 backdrop-blur：它每帧都要重新采样并模糊身后的内容，
          是全站最贵的一处绘制。改成 95% 不透明的纸色，观感几乎一样 */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <button className="flex items-center gap-2.5 transition-opacity hover:opacity-80" onClick={() => go(null)}>
            <span className="paper-sm relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[4px] border text-primary">
              <span className="absolute inset-y-0 left-1 w-px bg-destructive/45" />
              <Activity className="size-4" />
            </span>
            <span className="flex flex-col items-start">
              <span className="serif text-sm leading-none font-semibold">{me.site_name || "Monitor"}</span>
              <span className="ink mt-1 text-[10px] leading-none text-muted-foreground">
                节点在线状态 · {DATE.format(new Date())}
              </span>
            </span>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <a
              href="/admin/"
              title={me.authed ? "进入后台" : "登录"}
              className="paper-sm press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              <Wrench className="size-3.5 text-primary" />
              <span>{me.authed ? "进入后台" : "登录"}</span>
            </a>
            <Appearance dark={dark} onDark={setDark} paper={paper} onPaper={choosePaper} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 sm:px-6">
        <Notice text={config.notice} />

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {open !== null ? (
          !nodes ? (
            <Skeleton className="h-96" />
          ) : selected ? (
            <Suspense fallback={<Skeleton className="h-96" />}>
              <NodeDetail
                node={selected}
                latency={selected.online ? latency[selected.id] : undefined}
                onBack={() => go(null)}
                showCost={config.show_cost}
              />
            </Suspense>
          ) : (
            <p className="py-20 text-center text-sm text-muted-foreground">
              节点不存在或未公开。
              <button className="ml-1 underline" onClick={() => go(null)}>
                返回列表
              </button>
            </p>
          )
        ) : !nodes ? (
          <div className={CARD_GRID}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : (
          <>
            <Summary
              nodes={filtered}
              latency={latency}
              onOpen={(id) => go(id)}
              showMap={config.show_map}
              showLatency={config.show_latency}
              showCost={config.show_cost}
            />
            <Toolbar
              query={query}
              onQuery={setQuery}
              group={group}
              onGroup={setGroup}
              sort={sort}
              onSort={setSort}
              view={view}
              onView={setView}
            />

            {nodes.length === 0 ? (
              <p className="py-20 text-center text-sm text-muted-foreground">还没有节点</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-sm text-muted-foreground">
                <SearchX className="size-8 opacity-60" />
                没有匹配「{query}」的节点
                <Button variant="outline" onClick={() => setQuery("")}>
                  清空搜索
                </Button>
              </div>
            ) : (
              groups.map((groupItem) => (
                <section key={groupItem.key} className="space-y-3">
                  {groupItem.label && <GroupHeader group={groupItem} />}
                  {view === "grid" ? (
                    <div className={CARD_GRID}>
                      {groupItem.nodes.map((node) => (
                        <NodeCard
                          key={node.id}
                          node={node}
                          latency={node.online ? latency[node.id] : undefined}
                          onOpen={() => go(node.id)}
                          showLatency={config.show_latency}
                          showCost={config.show_cost}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groupItem.nodes.map((node) => (
                        <NodeRow
                          key={node.id}
                          node={node}
                          latency={node.online ? latency[node.id] : undefined}
                          onOpen={() => go(node.id)}
                          showLatency={config.show_latency}
                          showCost={config.show_cost}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ))
            )}
          </>
        )}
      </main>

      <Footer nodes={nodes} updatedAt={updatedAt} />
    </div>
  )
}
