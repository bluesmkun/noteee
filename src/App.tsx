import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { Activity, Moon, Pin, SearchX, Sun, Wrench } from "lucide-react"

import { NodeCard } from "@/components/NodeCard"
import { CountryLabel } from "@/components/Bits"
import { NodeRow } from "@/components/NodeRow"
import { Summary } from "@/components/Summary"
import { Toolbar } from "@/components/Toolbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, useLatency, useNodes, type Me } from "@/lib/api"
import { hasStored, useStoredState } from "@/lib/store"
import { DEFAULTS, loadConfig, type ThemeConfig } from "@/lib/theme"
import { GROUP_KEYS, groupNodes, searchNodes, sortNodes, SORT_KEYS, VIEW_MODES, type Group } from "@/lib/view"

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
  return [dark, () => setDark((d) => !d)] as const
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
  useEffect(() => {
    document.documentElement.dataset.paper = config.paper
  }, [config.paper])
  return [config, loaded]
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

function GroupHeader({ group }: { group: Group }) {
  const online = group.nodes.filter((n) => n.online).length
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
  const [dark, toggleTheme] = useTheme()
  const [config, configLoaded] = useConfig()
  const [me, setMe] = useState<Me | null>(null)
  const [meError, setMeError] = useState("")
  const { nodes, error, closed } = useNodes()
  const latency = useLatency(nodes)
  const [open, go] = useNodeRoute()

  const [view, setView] = useStoredState("noteee.view", "grid", VIEW_MODES)
  const [group, setGroup] = useStoredState("noteee.group", "none", GROUP_KEYS)
  const [sort, setSort] = useStoredState("noteee.sort", "default", SORT_KEYS)
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
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-[6px]">
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
            <button
              onClick={toggleTheme}
              title="切换主题"
              className="paper-sm press grid size-8 shrink-0 place-items-center rounded-md border text-foreground/80 transition-colors hover:text-foreground"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
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
          <div className="card-grid grid gap-3" style={{ "--card-min": "320px" } as CSSProperties}>
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
                    <div
                      className="card-grid grid gap-3"
                      style={{ "--card-min": `${config.card_min}px` } as CSSProperties}
                    >
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
    </div>
  )
}
