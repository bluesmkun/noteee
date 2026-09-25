import { LayoutGrid, List, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { GROUP_KEYS, type GroupKey, SORT_KEYS, type SortKey, VIEW_MODES, type ViewMode } from "@/lib/view"

const GROUP_LABEL: Record<GroupKey, string> = {
  none: "不分组",
  country: "按地区",
  status: "按状态",
  os: "按系统",
}

const SORT_LABEL: Record<SortKey, string> = {
  default: "默认排序",
  name: "按名称",
  cpu: "按 CPU",
  mem: "按内存",
  traffic: "按流量",
  expiry: "按到期",
}

const VIEW_ICON: Record<ViewMode, typeof LayoutGrid> = { grid: LayoutGrid, list: List }

export function Toolbar({
  query,
  onQuery,
  group,
  onGroup,
  sort,
  onSort,
  view,
  onView,
}: {
  query: string
  onQuery: (value: string) => void
  group: GroupKey
  onGroup: (value: GroupKey) => void
  sort: SortKey
  onSort: (value: SortKey) => void
  view: ViewMode
  onView: (value: ViewMode) => void
}) {
  return (
    <div className="paper flex flex-wrap items-center gap-2 rounded-xl border p-2">
      <div className="relative w-full sm:w-60">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="搜索名称、地区、系统、CPU…"
          aria-label="搜索节点"
          className="h-8 pl-8 text-xs"
        />
        {query && (
          <button
            onClick={() => onQuery("")}
            title="清空"
            className="absolute top-1/2 right-1.5 grid size-4 -translate-y-1/2 place-items-center rounded-[3px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="hidden flex-1 sm:block" />

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <Select value={group} onChange={(e) => onGroup(e.target.value as GroupKey)} aria-label="分组" variant="track">
          {GROUP_KEYS.map((key) => (
            <option key={key} value={key}>
              {GROUP_LABEL[key]}
            </option>
          ))}
        </Select>

        <Select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="排序" variant="track">
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </Select>

        <div className="slot flex items-center gap-0.5 rounded-[4px] border p-0.5">
          {VIEW_MODES.map((mode) => {
            const Icon = VIEW_ICON[mode]
            return (
              <button
                key={mode}
                onClick={() => onView(mode)}
                title={mode === "grid" ? "卡片视图" : "列表视图"}
                className={cn(
                  "grid size-7 place-items-center rounded-[3px] transition",
                  view === mode ? "paper-sm text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
