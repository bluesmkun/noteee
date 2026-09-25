const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"]

const unitOf = (n: number) => Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1)

export function bytes(n: number, digits?: number): string {
  if (!n || n < 1) return "0 B"
  const i = unitOf(n)
  const v = n / 1024 ** i
  return `${v.toFixed(i === 0 ? 0 : (digits ?? (v >= 100 ? 0 : v >= 10 ? 1 : 2)))} ${UNITS[i]}`
}

export function pair(used: number, total: number): string {
  if (used > 0 && total > 0 && unitOf(used) === unitOf(total)) {
    const i = unitOf(total)
    const f = (n: number) => (n / 1024 ** i).toFixed(i === 0 ? 0 : 2)
    return `${f(used)} / ${f(total)} ${UNITS[i]}`
  }
  return `${bytes(used)} / ${bytes(total)}`
}

export function axisBytes(v: number): string {
  if (!v || v < 0) return "0 B"
  const unit = Math.min(Math.floor(Math.log(v) / Math.log(1024)), 5)
  return bytes(v, v / 1024 ** unit >= 100 ? 0 : 1).replace(".0 ", " ")
}

export function rate(n: number): string {
  return `${bytes(n, 1)}/s`
}

export function percent(used: number, total: number): number {
  return total > 0 ? Math.min(100, (used / total) * 100) : 0
}

export function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return d > 0 ? `${d} 天 ${h} 小时` : h > 0 ? `${h} 小时 ${m} 分` : `${m} 分`
}

export function uptime(seconds: number): string {
  return seconds > 0 ? duration(seconds) : "—"
}

export function daysUntil(date?: string | null): number | null {
  if (!date) return null
  const target = new Date(`${date}T00:00:00`).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86400000)
}

export const FOREVER = "∞"

export function expiryLabel(days: number | null): string {
  if (days === null) return FOREVER
  if (days < 0) return `已过期 ${-days} 天`
  return days === 0 ? "今天到期" : `${days} 天后到期`
}

const SYMBOLS: Record<string, string> = { USD: "$", CNY: "¥", EUR: "€", GBP: "£", JPY: "¥" }

export function money(amount: number, currency: string): string {
  return `${SYMBOLS[currency] ?? ""}${amount.toFixed(2)}${SYMBOLS[currency] ? "" : ` ${currency}`}`
}

export const CYCLES: Record<string, string> = {
  monthly: "月付",
  quarterly: "季付",
  semiannual: "半年付",
  yearly: "年付",
  biennial: "两年付",
  triennial: "三年付",
  once: "一次性",
}

export function osName(name: string): string {
  return name.replace("GNU/Linux ", "").replace(/\s*\([^)]*\)\s*$/, "")
}

export function cpuName(name: string): string {
  return name
    .replace(/\((R|TM|r|tm)\)/g, "")
    .replace(/\s+(CPU|Processor)\b/g, "")
    .replace(/\s+\d+-Core\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function monthUsed(rx: number, tx: number, mode: string): number {
  switch (mode) {
    case "up":
      return tx
    case "down":
      return rx
    case "max":
      return Math.max(rx, tx)
    default:
      return rx + tx
  }
}

export type Tone = "ok" | "warn" | "bad" | "muted"

export function loadTone(pct: number): Tone {
  return pct >= 90 ? "bad" : pct >= 75 ? "warn" : "ok"
}

export function latencyTone(ms: number | null, loss = 0): Tone {
  if (ms === null) return "bad"
  if (loss >= 20 || ms >= 300) return "bad"
  if (loss > 0 || ms >= 120) return "warn"
  return "ok"
}

export function jitterTone(ms: number | null): Tone {
  if (ms === null) return "muted"
  return ms <= 8 ? "ok" : ms <= 25 ? "warn" : "bad"
}

export function lossTone(pct: number): Tone {
  return pct <= 0 ? "ok" : pct < 5 ? "warn" : "bad"
}

export function expiryTone(days: number | null): Tone {
  if (days === null) return "muted"
  if (days < 0) return "bad"
  return days <= 7 ? "warn" : "ok"
}

/** 到期风险分级：none = 还早或永不到期，soon = 30 天内，critical = 7 天内或已过期 */
export type ExpiryRisk = "none" | "soon" | "critical"

export function expiryRisk(days: number | null): ExpiryRisk {
  if (days === null) return "none"
  if (days < 0 || days <= 7) return "critical"
  return days <= 30 ? "soon" : "none"
}

const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080].map((m) => m * 60_000)

export function timeTicks(from: number, to: number, count = 8): number[] {
  const step = TICK_STEPS.find((s) => (to - from) / s <= count) ?? TICK_STEPS[TICK_STEPS.length - 1]
  const zone = new Date(from).getTimezoneOffset() * 60_000
  const ticks: number[] = []
  for (let t = Math.ceil((from - zone) / step) * step + zone; t <= to; t += step) ticks.push(t)
  return ticks
}

const LADDER: Record<number, number[]> = {
  10: [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10],
  1024: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
}

export function axisTop(max: number, floor: number, base = 10, cap = Infinity): number {
  const target = Math.min(cap, Math.max(max, floor)) / 4
  const scale = base ** Math.floor(Math.log(target) / Math.log(base))
  const step = LADDER[base].map((m) => m * scale).find((n) => n >= target)
  return Math.min(cap, (step ?? target) * 4)
}

export function quarters(top: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => top * f)
}

const HHMM = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" })

const MDHHMM = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function clock(ms: number): string {
  return HHMM.format(ms)
}

export function clockFor(hours: number): (ms: number) => string {
  return hours <= 24 ? clock : (ms: number) => MDHHMM.format(ms)
}

export function flagOf(code: string): string {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ""
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

let regions: Intl.DisplayNames | null | undefined

export function countryName(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return code
  if (regions === undefined) {
    try {
      regions = new Intl.DisplayNames(["zh-CN"], { type: "region" })
    } catch {
      regions = null
    }
  }
  try {
    return regions?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
