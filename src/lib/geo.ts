import { COUNTRY_POINTS, LAND } from "./geo-data.ts"

export const MAP_W = 360
export const MAP_H = 144
export const MAP_TOP = 84
export const MAP_BOTTOM = -60

export function project(lat: number, lon: number): [number, number] {
  const clamped = Math.max(MAP_BOTTOM, Math.min(MAP_TOP, lat))
  return [lon + 180, MAP_TOP - clamped]
}

export function placeOf(code: string): [number, number] | null {
  const point = COUNTRY_POINTS[(code || "").trim().toUpperCase()]
  return point ? project(point[0], point[1]) : null
}

export const LAND_POSITIONS: [number, number][] = (() => {
  const rows = LAND.length
  const cols = LAND[0]?.length ?? 0
  const out: [number, number][] = []
  for (let y = 0; y < rows; y++) {
    const line = LAND[y]
    for (let x = 0; x < line.length; x++) {
      if (line[x] === "1") out.push([((x + 0.5) * MAP_W) / cols, ((y + 0.5) * MAP_H) / rows])
    }
  }
  return out
})()
