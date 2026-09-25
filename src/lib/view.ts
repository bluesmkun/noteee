import type { Node } from "./api.ts"
import { countryName, daysUntil, monthUsed, osName } from "./format.ts"

export type ViewMode = "grid" | "list"
export const VIEW_MODES = ["grid", "list"] as const

export type GroupKey = "none" | "country" | "status" | "os"
export const GROUP_KEYS = ["none", "country", "status", "os"] as const

export type SortKey = "default" | "name" | "cpu" | "mem" | "traffic" | "expiry"
export const SORT_KEYS = ["default", "name", "cpu", "mem", "traffic", "expiry"] as const

export type Status = "online" | "offline" | "pending"

export function statusOf(node: Node): Status {
  if (node.online) return "online"
  return node.cpu_cores > 0 || node.mem_total > 0 || node.last_seen > 0 ? "offline" : "pending"
}

export function deployed(node: Node): boolean {
  return node.cpu_cores > 0 || node.mem_total > 0 || node.disk_total > 0
}

export function monthUsage(node: Node): number {
  return monthUsed(node.month_rx, node.month_tx, node.traffic_mode)
}

const MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
}

export type Spend = { currency: string; amount: number }

export function monthlySpend(nodes: Node[]): Spend[] {
  const totals = new Map<string, number>()
  for (const node of nodes) {
    const months = MONTHS[node.billing_cycle]
    if (!months || node.price <= 0) continue
    const currency = node.currency || "USD"
    totals.set(currency, (totals.get(currency) ?? 0) + node.price / months)
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export function searchNodes(nodes: Node[], query: string): Node[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return nodes
  return nodes.filter((n) => {
    const hay = [
      n.name, n.country, countryName(n.country), n.os, osName(n.os), n.kernel, n.arch, n.virt,
      n.cpu_name, n.hostname, n.ip, n.remark, n.agent_version, n.billing_cycle, n.currency,
    ].filter(Boolean).join(" ").toLowerCase()
    return terms.every((term) => hay.includes(term))
  })
}

const ratio = (used: number, total: number) => (total > 0 ? used / total : -1)

export function sortNodes(nodes: Node[], key: SortKey): Node[] {
  const list = [...nodes]
  switch (key) {
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))
    case "cpu":
      return list.sort((a, b) => (b.metrics?.cpu ?? -1) - (a.metrics?.cpu ?? -1))
    case "mem":
      return list.sort((a, b) => ratio(b.metrics?.mem_used ?? 0, b.metrics?.mem_total ?? 0) - ratio(a.metrics?.mem_used ?? 0, a.metrics?.mem_total ?? 0))
    case "traffic":
      return list.sort((a, b) => monthUsage(b) - monthUsage(a))
    case "expiry":
      return list.sort((a, b) => (daysUntil(a.expires_at) ?? Infinity) - (daysUntil(b.expires_at) ?? Infinity))
    default:
      return list.sort((a, b) => a.sort - b.sort || a.id - b.id)
  }
}

export type Group = { key: string; label: string; code?: string; nodes: Node[] }

const STATUS_LABEL: Record<Status, string> = { online: "在线", offline: "离线", pending: "未接入" }

type Bucket = { key: string; label: string; code?: string }

function bucketOf(node: Node, by: Exclude<GroupKey, "none">): Bucket {
  if (by === "country") {
    const code = (node.country || "").trim().toUpperCase()
    return code ? { key: code, label: countryName(code), code } : { key: "ZZ", label: "未知地区" }
  }
  if (by === "status") {
    const status = statusOf(node)
    return { key: status, label: STATUS_LABEL[status] }
  }
  const name = node.os ? osName(node.os).split(" ")[0] : ""
  return name ? { key: name, label: name } : { key: "unknown", label: "等待上报" }
}

export function groupNodes(nodes: Node[], by: GroupKey): Group[] {
  if (by === "none") return nodes.length > 0 ? [{ key: "all", label: "", nodes }] : []
  const buckets = new Map<string, Group>()
  for (const node of nodes) {
    const bucket = bucketOf(node, by)
    const group = buckets.get(bucket.key)
    if (group) group.nodes.push(node)
    else buckets.set(bucket.key, { ...bucket, nodes: [node] })
  }
  const groups = [...buckets.values()]
  if (by === "status") {
    const order: Status[] = ["online", "offline", "pending"]
    return groups.sort((a, b) => order.indexOf(a.key as Status) - order.indexOf(b.key as Status))
  }
  return groups.sort((a, b) => b.nodes.length - a.nodes.length || a.label.localeCompare(b.label, "zh-Hans-CN"))
}
