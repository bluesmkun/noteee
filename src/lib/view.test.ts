/// <reference types="node" />
import assert from "node:assert/strict"
import type { Node } from "./api.ts"
import { groupNodes, monthlySpend, searchNodes, sortNodes, statusOf } from "./view.ts"

const make = (patch: Partial<Node>): Node => ({
  id: 1, name: "node", sort: 0, public: true, online: false, country: "", last_seen: 0, metrics: null,
  os: "", kernel: "", arch: "", virt: "none", cpu_name: "", cpu_cores: 0, mem_total: 0, swap_total: 0,
  disk_total: 0, agent_version: "", price: 0, currency: "USD", billing_cycle: "", expires_at: null,
  traffic_limit: 0, traffic_mode: "sum", traffic_reset_day: 1, total_rx: 0, total_tx: 0, month_rx: 0,
  month_tx: 0, month_start: "", day_rx: 0, day_tx: 0, ...patch,
})

assert.equal(statusOf(make({})), "pending")
assert.equal(statusOf(make({ last_seen: 1 })), "offline")
assert.equal(statusOf(make({ online: true })), "online")

{
  const nodes = [
    make({ id: 1, name: "东京-01", country: "JP", os: "Debian GNU/Linux 12 (bookworm)" }),
    make({ id: 2, name: "LA-02", country: "US", os: "Ubuntu 22.04.3 LTS" }),
    make({ id: 3, name: "Tokyo-03", country: "JP", os: "Alpine Linux" }),
  ]
  assert.deepEqual(searchNodes(nodes, "").map((n) => n.id), [1, 2, 3])
  assert.deepEqual(searchNodes(nodes, "东京").map((n) => n.id), [1])
  assert.deepEqual(searchNodes(nodes, "jp").map((n) => n.id), [1, 3], "国家码参与搜索")
  assert.deepEqual(searchNodes(nodes, "debian").map((n) => n.id), [1], "系统名参与搜索")
  assert.deepEqual(searchNodes(nodes, "jp 01").map((n) => n.id), [1], "多个关键词同时命中")
  assert.deepEqual(searchNodes(nodes, "消失").map((n) => n.id), [])
}

{
  const nodes = [make({ id: 1, sort: 2, name: "b" }), make({ id: 2, sort: 1, name: "a" })]
  assert.deepEqual(sortNodes(nodes, "default").map((n) => n.id), [2, 1])
  assert.deepEqual(sortNodes(nodes, "name").map((n) => n.id), [2, 1])
}

{
  const nodes = [
    make({ id: 1, online: true, country: "JP" }),
    make({ id: 2, online: false, last_seen: 5, country: "US" }),
    make({ id: 3, online: true, country: "JP" }),
  ]
  const byCountry = groupNodes(nodes, "country")
  assert.deepEqual(byCountry.map((g) => g.label), ["日本", "美国"])
  assert.equal(byCountry[0].code, "JP")
  assert.deepEqual(byCountry[0].nodes.map((n) => n.id), [1, 3])

  const byStatus = groupNodes(nodes, "status")
  assert.deepEqual(byStatus.map((g) => g.key), ["online", "offline"])

  const byOs = groupNodes(nodes, "os")
  assert.equal(byOs[0].label, "等待上报")

  const flat = groupNodes(nodes, "none")
  assert.equal(flat.length, 1)
  assert.equal(flat[0].nodes.length, 3)
}

{
  const nodes = [
    make({ id: 1, price: 12, currency: "USD", billing_cycle: "yearly" }),
    make({ id: 2, price: 6, currency: "USD", billing_cycle: "quarterly" }),
    make({ id: 3, price: 100, currency: "CNY", billing_cycle: "once" }),
    make({ id: 4, price: 0, currency: "EUR", billing_cycle: "monthly" }),
  ]
  assert.deepEqual(monthlySpend(nodes), [{ currency: "USD", amount: 3 }])
}
console.log("搜索、排序与分组校验通过")
