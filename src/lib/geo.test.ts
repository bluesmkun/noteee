/// <reference types="node" />
import assert from "node:assert/strict"
import { LAND_POSITIONS, placeOf, project } from "./geo.ts"

assert.deepEqual(project(0, 0), [180, 84])
assert.deepEqual(project(84, -180), [0, 0])
assert.deepEqual(project(-60, 180), [360, 144])
assert.deepEqual(project(120, 0), [180, 0], "超出范围的纬度会被裁剪")

const jp = placeOf("jp")
assert.ok(jp && Math.abs(jp[0] - (138 + 180)) < 1 && Math.abs(jp[1] - (84 - 36)) < 1)
assert.equal(placeOf(""), null)
assert.equal(placeOf("ZZ"), null)
assert.ok(LAND_POSITIONS.length > 500)

console.log("地图投影与点阵校验通过")
