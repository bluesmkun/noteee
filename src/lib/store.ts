import { useEffect, useRef, useState } from "react"

function read<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    raw = null
  }
  return raw && (valid as readonly string[]).includes(raw) ? (raw as T) : fallback
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    return
  }
}

/** 访客是否已经自己选过。用来判断站点设置的默认值还能不能生效 */
export function hasStored(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

export function useStoredState<T extends string>(key: string, fallback: T, valid: readonly T[]) {
  const [value, setValue] = useState<T>(() => read(key, fallback, valid))
  const mounted = useRef(false)
  useEffect(() => {
    // 首次渲染不落盘：这时站点设置（默认视图）可能还没读完，
    // 先写进去会把默认值钉死，站长在面板上改的默认视图就再也生效不了
    if (!mounted.current) {
      mounted.current = true
      return
    }
    save(key, value)
  }, [key, value])
  return [value, setValue] as const
}
