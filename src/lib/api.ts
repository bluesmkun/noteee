import { useEffect, useMemo, useState } from "react"

export type Metrics = {
  uptime: number
  cpu: number
  load: [number, number, number]
  mem_total: number
  mem_used: number
  swap_total: number
  swap_used: number
  disk_total: number
  disk_used: number
  net_rx: number
  net_tx: number
  total_rx: number
  total_tx: number
  month_rx: number
  month_tx: number
  tcp: number
  udp: number
  procs: number
}

export type Node = {
  id: number
  name: string
  sort: number
  public: boolean
  online: boolean
  country: string
  last_seen: number
  metrics: Metrics | null
  os: string
  kernel: string
  arch: string
  virt: string
  cpu_name: string
  cpu_cores: number
  mem_total: number
  swap_total: number
  disk_total: number
  agent_version: string
  price: number
  currency: string
  billing_cycle: string
  expires_at: string | null
  traffic_limit: number
  traffic_mode: string
  traffic_reset_day: number
  total_rx: number
  total_tx: number
  month_rx: number
  month_tx: number
  month_start: string
  day_rx: number
  day_tx: number
  hostname?: string
  ip?: string
  remark?: string
}

export type Me = {
  authed: boolean
  github: boolean
  site_name: string
  public_page: boolean
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers,
  })
  if (!res.ok) throw new ApiError(res.status, (await res.text()) || res.statusText)
  return res.status === 204 ? (undefined as T) : res.json()
}

const KEEP = 60
export const speedHistory: { rx: number; tx: number }[] = []

function sample(nodes: Node[]) {
  const live = nodes.filter((n) => n.online && n.metrics)
  speedHistory.push({
    rx: live.reduce((s, n) => s + n.metrics!.net_rx, 0),
    tx: live.reduce((s, n) => s + n.metrics!.net_tx, 0),
  })
  if (speedHistory.length > KEEP) speedHistory.shift()
}

export function safeNodes(nodes: Node[]): Node[] {
  const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0
  const fields = ["uptime", "cpu", "mem_total", "mem_used", "swap_total", "swap_used", "disk_total", "disk_used",
    "net_rx", "net_tx", "total_rx", "total_tx", "month_rx", "month_tx", "tcp", "udp", "procs"] as const
  return nodes.map((node) => {
    const m = node.metrics
    return !m || (fields.every((key) => number(m[key])) && Array.isArray(m.load) && m.load.length === 3 && m.load.every(number))
      ? node : { ...node, metrics: null }
  })
}

export function useNodes() {
  const [nodes, setNodes] = useState<Node[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    let socket: WebSocket | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const receive = (list: Node[]) => {
      const safe = safeNodes(list)
      sample(safe)
      setNodes(safe)
      setError(null)
      setClosed(false)
    }

    const fetchOnce = () =>
      api<{ nodes: Node[] }>("/nodes")
        .then((d) => receive(d.nodes))
        .catch((e: Error) => {
          setError(e.message)
          if (e instanceof ApiError && e.status === 401) setClosed(true)
        })

    fetchOnce()

    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`
    const connect = () => {
      try {
        socket = new WebSocket(url)
      } catch {
        poll ??= setInterval(fetchOnce, 5000)
        return
      }
      socket.onmessage = (event) => {
        receive(JSON.parse(event.data).nodes)
        if (poll) {
          clearInterval(poll)
          poll = null
        }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        if (stopped) return
        poll ??= setInterval(fetchOnce, 5000)
        retry = setTimeout(connect, 5000)
      }
    }
    connect()

    return () => {
      stopped = true
      socket?.close()
      if (poll) clearInterval(poll)
      if (retry) clearTimeout(retry)
    }
  }, [])

  return { nodes, error, closed }
}

export type MetricPoint = {
  ts: number
  cpu: number
  mem_used: number
  disk_used: number
  net_rx: number
  net_tx: number
}

export type PingPoint = {
  task_id: number
  ts: number
  latency: number | null
  band?: [number, number]
  loss?: number
}

export type History = {
  metrics: MetricPoint[]
  ping: PingPoint[]
  probes: Record<string, string>
  loss?: Record<string, number>
}

export function fetchHistory(
  id: number,
  hours: number,
  series: "metrics" | "ping",
  points = 240,
): Promise<History> {
  const query = new URLSearchParams({ hours: String(hours), series, points: String(points) })
  return api<History>(`/nodes/${id}/metrics?${query}`)
}

export type LatencyHour = {
  ts: number
  latency: number | null
  loss: number | null
}

export type ProbeStat = {
  id: number
  name: string
  latency: number | null
  jitter: number | null
  loss: number
  min: number | null
  max: number | null
  hours: LatencyHour[]
  avgLatency: number | null
  avgLoss: number | null
}

export type Latency = {
  latency: number | null
  loss: number
  probe: string
  jitter: number | null
  probes: ProbeStat[]
  /** 所有探测按小时聚合后的单条 24 小时序列 */
  hours: LatencyHour[]
  avgLatency: number | null
  avgLoss: number | null
  none?: boolean
  failed?: boolean
}

export type LatencyMap = Record<number, Latency>

function jitterOf(values: (number | null)[]): number | null {
  const clean = values.filter((v): v is number => v !== null)
  if (clean.length < 2) return null
  let sum = 0
  for (let i = 1; i < clean.length; i++) sum += Math.abs(clean[i] - clean[i - 1])
  return sum / (clean.length - 1)
}

export const HOUR_BUCKETS = 24
const HOUR_SECONDS = 3600

/** 24 个小时桶的时间戳，最后一格是当前小时。 */
function hourSlots(count = HOUR_BUCKETS): number[] {
  const nowHour = Math.floor(Date.now() / 1000 / HOUR_SECONDS) * HOUR_SECONDS
  return Array.from({ length: count }, (_, i) => nowHour - (count - 1 - i) * HOUR_SECONDS)
}

function hourlyBuckets(points: PingPoint[], fallbackLoss: number, slots: number[]): LatencyHour[] {
  const byHour = new Map<number, { lat: number; latN: number; loss: number; lossN: number }>()
  for (const p of points) {
    const hour = Math.floor(p.ts / HOUR_SECONDS) * HOUR_SECONDS
    const row = byHour.get(hour) ?? { lat: 0, latN: 0, loss: 0, lossN: 0 }
    if (p.latency !== null) {
      row.lat += p.latency
      row.latN++
    }
    row.loss += p.loss ?? fallbackLoss
    row.lossN++
    byHour.set(hour, row)
  }
  return slots.map((ts) => {
    const row = byHour.get(ts)
    return {
      ts,
      latency: row && row.latN > 0 ? row.lat / row.latN : null,
      loss: row && row.lossN > 0 ? row.loss / row.lossN : null,
    }
  })
}

/** 把多个探测按小时求均值，合成单条 24 小时热力序列。 */
export function mergeHours(probes: ProbeStat[], slots: number[]): LatencyHour[] {
  return slots.map((ts, i) => {
    let latSum = 0
    let latN = 0
    let lossSum = 0
    let lossN = 0
    for (const probe of probes) {
      const hour = probe.hours[i]
      if (!hour) continue
      if (hour.latency !== null) {
        latSum += hour.latency
        latN++
      }
      if (hour.loss !== null) {
        lossSum += hour.loss
        lossN++
      }
    }
    return {
      ts,
      latency: latN > 0 ? latSum / latN : null,
      loss: lossN > 0 ? lossSum / lossN : null,
    }
  })
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null
}

export function summarizePing(history: History): Latency {
  const sorted = [...(history.ping ?? [])].sort((a, b) => a.ts - b.ts)
  const byProbe = new Map<number, PingPoint[]>()
  for (const p of sorted) {
    const list = byProbe.get(p.task_id)
    if (list) list.push(p)
    else byProbe.set(p.task_id, [p])
  }

  const slots = hourSlots()
  const probes: ProbeStat[] = []
  for (const [id, points] of byProbe) {
    const values = points.map((p) => p.latency)
    const clean = values.filter((v): v is number => v !== null)
    const loss = history.loss?.[String(id)] ?? (points[points.length - 1]?.latency === null ? 100 : 0)
    const hours = hourlyBuckets(points, loss, slots)
    const lats = hours.map((h) => h.latency).filter((v): v is number => v !== null)
    const losses = hours.map((h) => h.loss).filter((v): v is number => v !== null)
    probes.push({
      id,
      name: history.probes?.[String(id)] ?? `探测 ${id}`,
      latency: points[points.length - 1]?.latency ?? null,
      jitter: jitterOf(values),
      loss,
      min: clean.length > 0 ? Math.min(...clean) : null,
      max: clean.length > 0 ? Math.max(...clean) : null,
      hours,
      avgLatency: mean(lats),
      avgLoss: mean(losses),
    })
  }

  const hours = mergeHours(probes, slots)
  const avgLatency = mean(hours.map((h) => h.latency).filter((v): v is number => v !== null))
  const avgLoss = mean(hours.map((h) => h.loss).filter((v): v is number => v !== null))

  const alive = probes.filter((p) => p.latency !== null)
  const pick = alive.reduce<ProbeStat | null>(
    (best, p) => (best === null || (p.latency as number) < (best.latency as number) ? p : best),
    null,
  )

  if (probes.length === 0) {
    return { latency: null, loss: 0, probe: "", jitter: null, probes, hours, avgLatency, avgLoss, none: true }
  }
  if (!pick) {
    const first = probes[0]
    return { latency: null, loss: 100, probe: first.name, jitter: first.jitter, probes, hours, avgLatency, avgLoss }
  }
  return {
    latency: pick.latency,
    loss: pick.loss,
    probe: pick.name,
    jitter: pick.jitter,
    probes,
    hours,
    avgLatency,
    avgLoss,
  }
}

const REFRESH_MS = 60_000
const CONCURRENCY = 2

export function useLatency(nodes: Node[] | null): LatencyMap {
  const [stats, setStats] = useState<LatencyMap>({})
  const ids = useMemo(
    () => (nodes ?? []).filter((n) => n.online).map((n) => n.id).sort((a, b) => a - b).join(","),
    [nodes],
  )

  useEffect(() => {
    if (!ids) return
    const targets = ids.split(",").map(Number).filter((id) => Number.isFinite(id))
    const queue: number[] = []
    let running = 0
    let stopped = false

    const pump = () => {
      if (stopped) return
      while (running < CONCURRENCY && queue.length > 0) {
        const id = queue.shift()!
        running++
        fetchHistory(id, 24, "ping", 288)
          .then((history) => {
            if (!stopped) setStats((s) => ({ ...s, [id]: summarizePing(history) }))
          })
          .catch(() => {
            if (!stopped)
              setStats((s) => ({
                ...s,
                [id]: { latency: null, loss: 0, probe: "", jitter: null, probes: [], hours: [], avgLatency: null, avgLoss: null, failed: true },
              }))
          })
          .finally(() => {
            running--
            pump()
          })
      }
    }

    const enqueue = () => {
      for (const id of targets) if (!queue.includes(id)) queue.push(id)
      pump()
    }

    enqueue()
    const timer = setInterval(enqueue, REFRESH_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [ids])

  return stats
}
