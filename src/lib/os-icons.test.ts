/// <reference types="node" />
import assert from "node:assert/strict"
import { OS_ICONS, osShortName, osSlug, osVersion } from "./os-icons.ts"

// 真实 hub 上会出现的 os 串（agent 报的是 /etc/os-release 的 PRETTY_NAME 一类）
const CASES: [string, string | null, string][] = [
  ["Debian GNU/Linux 12", "debian", "12"],
  ["Debian 12", "debian", "12"],
  ["Ubuntu 22.04.4 LTS", "ubuntu", "22.04.4 LTS"],
  ["CentOS Linux 7 (Core)", "centos", "7"],
  ["CentOS Stream 9", "centos", "Stream 9"],
  ["Rocky Linux 9.3", "rockylinux", "9.3"],
  ["AlmaLinux 9.3", "almalinux", "9.3"],
  ["Alpine Linux 3.19", "alpinelinux", "3.19"],
  ["Arch Linux", "archlinux", ""],
  ["Manjaro Linux", "manjaro", ""],
  ["Fedora Linux 39", "fedora", "39"],
  ["openSUSE Leap 15.5", "opensuse", "Leap 15.5"],
  ["Red Hat Enterprise Linux 9.3", "redhat", "9.3"],
  ["Windows Server 2019", "windows", "2019"],
  ["Windows 11 Pro", "windows", "11 Pro"],
  ["FreeBSD 13.2", "freebsd", "13.2"],
  ["NixOS 23.11", "nixos", "23.11"],
  ["Gentoo", "gentoo", ""],
  ["Linux Mint 21.3", "linuxmint", "21.3"],
  ["Raspbian GNU/Linux 11", "raspberrypi", "11"],
  ["Zorin OS 17", "zorin", "17"],
  ["Proxmox VE 8.1", "proxmox", "VE 8.1"],
  ["OpenWrt 23.05", "openwrt", "23.05"],
  ["TrueNAS SCALE 23.10", "truenas", "SCALE 23.10"],
]

for (const [os, slug, version] of CASES) {
  assert.equal(osSlug(os), slug, `识别发行版失败：${os}`)
  assert.equal(osVersion(os), version, `提取版本号失败：${os}`)
}

// 认不出来就老实返回 null，不要硬套别的发行版图标
assert.equal(osSlug("Oracle Linux Server 8.9"), "linux", "未知发行版兜底成通用 Linux")
assert.equal(osSlug("SomeWeirdOS 1.0"), null)
assert.equal(osSlug(""), null)
assert.equal(osSlug(undefined), null)
assert.equal(osSlug(null), null)
assert.equal(osVersion(""), "")
assert.equal(osVersion(null), "")

// 认出来的 slug 必须真有图标，否则渲染出一个空 svg
for (const [, slug] of CASES) {
  if (slug) assert.ok(OS_ICONS[slug], `缺图标：${slug}`)
}

assert.equal(osShortName("Debian GNU/Linux 12"), "Debian")
assert.equal(osShortName("Red Hat Enterprise Linux 9.3"), "RHEL")
assert.equal(osShortName("SomeWeirdOS 1.0"), "SomeWeirdOS 1.0")

console.log("发行版图标识别与版本提取校验通过")
