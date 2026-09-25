import manifest from "../../theme.json"

/**
 * 站点级设置（公告、纸张色调、显示哪些区块）存在 hub 里，由站长在面板或本主题
 * 自带的设置界面里改。访客自己的偏好（深浅色、视图、排序）不属于这里，走 localStorage。
 */

type Field = {
  key: string
  type: string
  default: unknown
  options?: { value: string }[]
  min?: number
  max?: number
}

/** 和面板同一套取值检查。保存的值可能来自这个主题的旧版本，对不上就当没保存过 */
function fits(field: Field, value: unknown): boolean {
  switch (field.type) {
    case "boolean":
      return typeof value === "boolean"
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= (field.min ?? -Infinity) &&
        value <= (field.max ?? Infinity)
      )
    case "select":
      return !!field.options?.some((option) => option.value === value)
    default:
      return typeof value === "string"
  }
}

/** 分组标题（type 为 title）不存值 */
export const fields = (manifest.config as Field[]).filter((field) => field.type !== "title")

export const SHORT = manifest.short

export type Paper = "cream" | "mint" | "kraft"
export type Layout = "grid" | "list"

export type ThemeConfig = {
  notice: string
  layout: Layout
  paper: Paper
  card_min: number
  show_map: boolean
  show_latency: boolean
  show_cost: boolean
}

export const DEFAULTS = Object.fromEntries(
  fields.map((field) => [field.key, field.default]),
) as unknown as ThemeConfig

/** 从没保存过、断网、hub 太旧（404）或公开页关闭（401）一律按默认值渲染，不报错也不提示 */
export async function loadConfig(): Promise<ThemeConfig> {
  let saved: Record<string, unknown> = {}
  try {
    const res = await fetch(`/api/themes/${SHORT}/config`)
    if (res.ok) saved = (await res.json()) as Record<string, unknown>
  } catch {
    // 断网同样按默认值
  }
  const pick = (field: Field) => (fits(field, saved[field.key]) ? saved[field.key] : field.default)
  return Object.fromEntries(fields.map((field) => [field.key, pick(field)])) as unknown as ThemeConfig
}

/** 接在 loadConfig 之后：站长登录时才能保存（主题要已装在 hub 上），失败要让站长看到 */
export async function saveConfig(values: Record<string, unknown>): Promise<void> {
  const url = `/api/themes/${SHORT}/config`
  // 先读 hub 里原始的那份，不是 loadConfig() 合并过默认值的结果
  const read = await fetch(url)
  if (!read.ok) throw new Error(await read.text())
  const next = (await read.json()) as Record<string, unknown>
  // 只改声明过的项，其余 key 原样留下；等于默认值的删掉
  for (const field of fields) {
    if (values[field.key] === field.default) delete next[field.key]
    else next[field.key] = values[field.key]
  }
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  })
  if (!res.ok) throw new Error(await res.text())
}
