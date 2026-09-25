import {
  axisBytes,
  axisTop,
  bytes,
  countryName,
  cpuName,
  daysUntil,
  duration,
  expiryLabel,
  expiryTone,
  flagOf,
  latencyTone,
  monthUsed,
  osName,
  pair,
  quarters,
  timeTicks,
  uptime,
} from "./format.ts"

let failed = 0
function eq(got: unknown, want: unknown, what: string) {
  const [a, b] = [JSON.stringify(got), JSON.stringify(want)]
  if (a !== b) {
    failed++
    console.error(`✗ ${what}\n    得到 ${a}\n    期望 ${b}`)
  }
}

eq(bytes(0), "0 B", "bytes(0)")
eq(bytes(0.5), "0 B", "bytes(0.5) 不能落到 UNITS[-1]")
eq(bytes(-1), "0 B", "bytes(负数)")
eq(bytes(1023), "1023 B", "bytes 在 B 档不带小数")
eq(bytes(1024), "1.00 KB", "bytes(1 KiB)")
eq(bytes(10 * 1024), "10.0 KB", "两位数留一位小数")
eq(bytes(100 * 1024), "100 KB", "三位数不留小数")
eq(bytes(1024, 1), "1.0 KB", "digits 覆盖默认档位")

eq(pair(300 * 1024 ** 2, 900 * 1024 ** 2), "300.00 / 900.00 MB", "同单位只写一次")
eq(pair(300 * 1024 ** 2, 3 * 1024 ** 3), "300 MB / 3.00 GB", "跨单位各写各的")

eq(axisBytes(3.2 * 1024 ** 3), "3.2 GB", "窄轴刻度保留一位")
eq(axisBytes(2 * 1024 ** 3), "2 GB", "整数刻度不写 .0")
eq(axisBytes(0), "0 B", "零刻度")

eq(axisTop(0.4, 4, 10, 100), 4, "闲置机器拿到地板值")
eq(axisTop(63, 4, 10, 100), 80, "63% -> 0/20/40/60/80")
eq(axisTop(200, 4, 10, 100), 100, "百分比封顶")
eq(axisTop(25_000_000, 1024, 1024), 32 * 1024 ** 2, "字节轴按 1024 取整")
eq(quarters(32 * 1024 ** 2).map(axisBytes), ["0 B", "8 MB", "16 MB", "24 MB", "32 MB"], "四条网格线都是整值")
eq(quarters(axisTop(2_621_440, 1024, 1024)).map(axisBytes),
  ["0 B", "1 MB", "2 MB", "3 MB", "4 MB"], "峰值 2.5 MB/s 的四条刻度")
eq(quarters(axisTop(1_258_291, 1024, 1024)).map(axisBytes),
  ["0 B", "512 KB", "1 MB", "1.5 MB", "2 MB"], "峰值 1.2 MB/s 的四条刻度")
for (const max of [3_000, 300_000, 3_000_000, 300_000_000]) {
  const top = axisTop(max, 1024, 1024)
  eq(top > max, true, `${max} B/s 的轴顶不能等于数据本身`)
  eq(top / max < 2, true, `${max} B/s 的轴顶不能浪费整块面板`)
}

{
  const day = 86_400_000
  const to = Date.now()
  const ticks = timeTicks(to - day, to)
  eq(ticks.length <= 8, true, `24 小时窗最多 8 个刻度（得到 ${ticks.length}）`)
  eq(
    ticks.every((t) => new Date(t).getMinutes() === 0 && new Date(t).getSeconds() === 0),
    true,
    "刻度落在整点上",
  )
  eq(
    ticks.every((t, i) => i === 0 || t - ticks[i - 1] === ticks[1] - ticks[0]),
    true,
    "刻度间距均匀",
  )
  eq(timeTicks(to, to - day), [], "反向区间不产出刻度")
}

{
  const at = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  eq(daysUntil(at(10)), 10, "十天后")
  eq(daysUntil(at(-3)), -3, "已过期为负")
  eq(daysUntil(null), null, "无到期日")
  eq(daysUntil("不是日期"), null, "无法解析的日期")
}

eq(uptime(0), "—", "没上报过就不写时长")
eq(uptime(90), "1 分", "不足一小时")
eq(uptime(3 * 3600 + 25 * 60), "3 小时 25 分", "不足一天")
eq(uptime(2 * 86400 + 5 * 3600), "2 天 5 小时", "超过一天不再写分钟")
eq(duration(90061), "1 天 1 小时", "duration 与 uptime 同档位")

eq(expiryLabel(null), "∞", "无到期日")
eq(expiryLabel(0), "今天到期", "当天到期")
eq(expiryLabel(12), "12 天后到期", "未来到期")
eq(expiryLabel(-2), "已过期 2 天", "已经过期")
eq(expiryTone(null), "muted", "无到期日不告警")
eq(expiryTone(30), "ok", "一个月外")
eq(expiryTone(5), "warn", "一周内提醒")
eq(expiryTone(-1), "bad", "过期告警")

eq(latencyTone(30), "ok", "低延迟")
eq(latencyTone(150), "warn", "中等延迟")
eq(latencyTone(320), "bad", "高延迟")
eq(latencyTone(null), "bad", "超时")
eq(latencyTone(40, 25), "bad", "高丢包")
eq(latencyTone(40, 2), "warn", "有丢包")

eq(monthUsed(10, 20, "up"), 20, "只算上行")
eq(monthUsed(10, 20, "down"), 10, "只算下行")
eq(monthUsed(10, 20, "max"), 20, "取较大方向")
eq(monthUsed(10, 20, "sum"), 30, "双向合计")
eq(monthUsed(10, 20, ""), 30, "未知模式按双向合计")

eq(osName("Debian GNU/Linux 12 (bookworm)"), "Debian 12", "发行版名去掉代号")
eq(cpuName("Intel(R) Xeon(R) CPU E5-2680 8-Core Processor"), "Intel Xeon E5-2680", "CPU 名去掉商标和核数")

eq(flagOf("JP"), "🇯🇵", "两位国家码")
eq(flagOf("jp"), "🇯🇵", "小写也认")
eq(flagOf("JPN"), "", "三位不认")
eq(flagOf(""), "", "空值不认")
eq(countryName("JP"), "日本", "国家码转中文名")
eq(countryName(""), "", "空值原样返回")
eq(countryName("Zzz"), "Zzz", "无法解析时原样返回")

if (failed) {
  console.error(`\n${failed} 项不通过`)
  throw new Error("format 校验未通过")
}
console.log("format 校验通过")
