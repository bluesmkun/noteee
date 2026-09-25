/// <reference types="node" />
import assert from "node:assert/strict"
import { mergeHours, safeNodes, summarizePing, type History, type Node, type PingPoint, type ProbeStat } from "./api.ts"

const node = { id: 1, metrics: { uptime: 100, cpu: 1, load: [0.1, 0.2, 0.3],
  mem_total: 1024, mem_used: 512, swap_total: 0, swap_used: 0, disk_total: 2048, disk_used: 1024,
  net_rx: 10, net_tx: 20, total_rx: 100, total_tx: 200, month_rx: 50, month_tx: 100,
  tcp: 3, udp: 4, procs: 20 } } as Node
assert.equal(safeNodes([node])[0], node)
for (const patch of [{ load: null }, { load: [1, "bad", 3] }, { cpu: "bad" }, { net_rx: Infinity }]) {
  const bad = { ...node, metrics: { ...node.metrics, ...patch } } as unknown as Node
  const result = safeNodes([bad, node])
  assert.equal(result[0].metrics, null)
  assert.equal(result[1], node)
}
console.log("坏报告不会拖垮整页")

function history(ping: PingPoint[], loss: Record<string, number> = {}): History {
  return { metrics: [], ping, probes: { "1": "东京", "2": "洛杉矶" }, loss }
}

const best = summarizePing(history([
  { task_id: 1, ts: 100, latency: 80 },
  { task_id: 1, ts: 200, latency: 60 },
  { task_id: 2, ts: 100, latency: 120 },
], { "1": 5 }))
assert.equal(best.latency, 60)
assert.equal(best.probe, "东京")
assert.equal(best.loss, 5)

const empty = summarizePing(history([]))
assert.equal(empty.none, true)
assert.equal(empty.latency, null)

const timeout = summarizePing(history([{ task_id: 3, ts: 1, latency: null }]))
assert.equal(timeout.latency, null)
assert.equal(timeout.loss, 100)

const lastWins = summarizePing(history([
  { task_id: 1, ts: 100, latency: 10 },
  { task_id: 1, ts: 200, latency: null },
]))
assert.equal(lastWins.latency, null)
assert.equal(lastWins.loss, 100)

const fastest = summarizePing(history([
  { task_id: 1, ts: 100, latency: 30 },
  { task_id: 2, ts: 100, latency: 40 },
]))
assert.equal(fastest.latency, 30)
assert.equal(fastest.probe, "东京")

console.log("延迟摘要取每个探测的最新样本")

const jittered = summarizePing(history([
  { task_id: 1, ts: 100, latency: 20 },
  { task_id: 1, ts: 200, latency: 40 },
  { task_id: 1, ts: 300, latency: 30 },
]))
assert.equal(jittered.jitter, 15)
assert.equal(jittered.probes.length, 1)
assert.equal(jittered.probes[0].min, 20)
assert.equal(jittered.probes[0].max, 40)
assert.equal(jittered.probes[0].latency, 30)

const multi = summarizePing(history([
  { task_id: 1, ts: 100, latency: 50 },
  { task_id: 2, ts: 100, latency: 80 },
  { task_id: 2, ts: 200, latency: null },
], { "2": 25 }))
assert.equal(multi.probes.length, 2)
assert.equal(multi.latency, 50)
assert.equal(multi.jitter, null)
const second = multi.probes.find((p) => p.id === 2)
assert.equal(second?.latency, null)
assert.equal(second?.loss, 25)

console.log("多探测摘要带波动、丢包与区间")

const hour = Math.floor(Date.now() / 1000 / 3600) * 3600
const hourly = summarizePing(history([
  { task_id: 1, ts: hour + 10, latency: 40 },
  { task_id: 1, ts: hour + 20, latency: 60 },
]))
assert.equal(hourly.probes[0].hours.length, 24)
assert.equal(hourly.probes[0].hours[23].latency, 50)
assert.equal(hourly.probes[0].hours[23].loss, 0)
assert.equal(hourly.probes[0].hours[0].latency, null)
assert.equal(hourly.probes[0].avgLatency, 50)

const hourlyLoss = summarizePing(history([
  { task_id: 2, ts: hour + 10, latency: 50, loss: 8 },
], { "2": 8 }))
assert.equal(hourlyLoss.probes[0].hours[23].loss, 8)
assert.equal(hourlyLoss.probes[0].avgLoss, 8)

console.log("小时聚合生成 24 格热力数据")

const merged = summarizePing(history([
  { task_id: 1, ts: hour + 10, latency: 40 },
  { task_id: 1, ts: hour + 20, latency: 60 },
  { task_id: 2, ts: hour + 10, latency: 120 },
  { task_id: 2, ts: hour + 20, latency: 80 },
]))
assert.equal(merged.hours.length, 24)
assert.equal(merged.hours[23].latency, 75)
assert.equal(merged.hours[0].latency, null)
assert.equal(merged.avgLatency, 75)
assert.equal(merged.avgLoss, 0)
assert.equal(merged.probes.length, 2)

const slot = (latency: number | null, loss: number | null) => ({ ts: hour, latency, loss })
const probe = (hours: { ts: number; latency: number | null; loss: number | null }[]): ProbeStat => ({
  id: 1, name: "p", latency: null, jitter: null, loss: 0, min: null, max: null, hours, avgLatency: null, avgLoss: null,
})
const averaged = mergeHours([probe([slot(20, 0)]), probe([slot(40, 20)]), probe([slot(null, null)])], [hour])
assert.equal(averaged[0].latency, 30)
assert.equal(averaged[0].loss, 10)

const gap = mergeHours([probe([slot(null, 6)])], [hour])
assert.equal(gap[0].latency, null)
assert.equal(gap[0].loss, 6)

console.log("多探测按小时均值合并为单条色带")

