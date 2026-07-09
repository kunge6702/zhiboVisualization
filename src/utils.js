import { HEADER_HEIGHT, PORT_PADDING, PORT_ROW, DEVICE_WIDTH, COLORS, CAT_COLORS, BUILTIN_DEVICE_TYPES } from './constants.js'

let _idc = 100
export function uid(p) {
  return p + (++_idc)
}

export function initUidCounter(projects) {
  let maxNum = 100
  const re = /^(?:d|c|r|p)(\d+)$/
  const checkId = (id) => {
    const m = id.match(re)
    if (m) maxNum = Math.max(maxNum, parseInt(m[1]))
  }
  for (const project of projects) {
    checkId(project.id)
    project.devices.forEach(d => checkId(d.id))
    project.connections.forEach(c => checkId(c.id))
    project.requirements.forEach(r => checkId(r.id))
  }
  _idc = maxNum
}

export function getPortPos(device, portIndex, direction) {
  const x = direction === 'in' ? device.x : device.x + 200
  const y = device.y + HEADER_HEIGHT + PORT_PADDING + portIndex * PORT_ROW + PORT_ROW / 2
  return { x, y }
}

export function getConnPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1)
  const off = Math.max(40, dx * 0.4)
  return 'M ' + x1 + ',' + y1 + ' C ' + (x1 + off) + ',' + y1 + ' ' + (x2 - off) + ',' + y2 + ' ' + x2 + ',' + y2
}

const portKey = (deviceId, portIndex, direction) => deviceId + ':' + portIndex + ':' + direction

/**
 * Port-level route search with port consumption.
 *
 * Node = { deviceId, portIndex, direction }.
 * Edges: connection (out -> in) + intra-device jump (in -> same-signal out).
 * "Auto-routing" devices (multiple out-ports of the same signal, e.g. the switcher's 3 video OUTs)
 * are handled implicitly: the BFS simply enumerates every free same-signal out-port when jumping
 * through a device, so an available OUT is auto-selected. No explicit device flag needed.
 *
 * @param connections    array of { fromDeviceId, fromPortIndex, toDeviceId, toPortIndex, signalType }
 * @param sourceId       starting device id
 * @param destId         target device id
 * @param signalType     'video' | 'audio'
 * @param getDeviceType  (deviceId) => DEVICE_TYPES entry; used to enumerate a device's out-ports by signal
 * @param occupied       Set of "deviceId:portIndex:direction" consumed by prior requirements (mutated on success)
 * @returns port-level path [{ deviceId, portIndex, direction }] or null
 */
export function findRoute(connections, sourceId, destId, signalType, getDeviceType, occupied) {
  const occ = occupied || new Set()
  const isFree = (deviceId, portIndex, direction) => !occ.has(portKey(deviceId, portIndex, direction))

  const queue = []
  const visited = new Set()

  // Seed: the source device's own free out-ports of matching signal.
  const srcType = getDeviceType(sourceId)
  if (srcType) {
    srcType.outputs.forEach((port, index) => {
      if (port.signal !== signalType || !isFree(sourceId, index, 'out')) return
      const k = portKey(sourceId, index, 'out')
      if (visited.has(k)) return
      visited.add(k)
      queue.push({
        deviceId: sourceId, portIndex: index, direction: 'out',
        path: [{ deviceId: sourceId, portIndex: index, direction: 'out' }],
      })
    })
  }

  while (queue.length > 0) {
    const node = queue.shift()
    if (node.direction === 'out') {
      // Follow the connection leaving this out-port to an in-port.
      const conn = connections.find(c =>
        c.fromDeviceId === node.deviceId && c.fromPortIndex === node.portIndex && c.signalType === signalType
      )
      if (!conn) continue
      const inKey = portKey(conn.toDeviceId, conn.toPortIndex, 'in')
      if (!isFree(conn.toDeviceId, conn.toPortIndex, 'in') || visited.has(inKey)) continue
      visited.add(inKey)
      const newPath = [...node.path, { deviceId: conn.toDeviceId, portIndex: conn.toPortIndex, direction: 'in' }]
      if (conn.toDeviceId === destId) {
        for (const p of newPath) occ.add(portKey(p.deviceId, p.portIndex, p.direction))
        return newPath
      }
      queue.push({ deviceId: conn.toDeviceId, portIndex: conn.toPortIndex, direction: 'in', path: newPath })
    } else {
      // In-port: jump to same device's free out-ports of matching signal (intra-device routing).
      const devType = getDeviceType(node.deviceId)
      if (!devType) continue
      devType.outputs.forEach((port, index) => {
        if (port.signal !== signalType) return
        const outKey = portKey(node.deviceId, index, 'out')
        if (!isFree(node.deviceId, index, 'out') || visited.has(outKey)) return
        visited.add(outKey)
        queue.push({
          deviceId: node.deviceId, portIndex: index, direction: 'out',
          path: [...node.path, { deviceId: node.deviceId, portIndex: index, direction: 'out' }],
        })
      })
    }
  }
  return null
}

/**
 * Batch-validate requirements against shared port capacity.
 *
 * Returns [{ requirementId, status: 'ok'|'broken'|'conflict', route, conflictWith }]
 * - broken:   no path exists topologically (device-level reachability fails)
 * - conflict: path exists but ports are consumed by a prior requirement
 * - ok:       port-level route found; its ports are reserved in the shared occupied set
 *
 * @param getDeviceType  (deviceId) => DEVICE_TYPES entry
 */
export function validateRequirements(requirements, connections, getDeviceType) {
  const occupied = new Set()
  const results = []
  for (const req of requirements) {
    if (!deviceReachable(connections, req.sourceDeviceId, req.destDeviceId, req.signalType)) {
      results.push({ requirementId: req.id, status: 'broken', route: null, conflictWith: null })
      continue
    }
    const route = findRoute(connections, req.sourceDeviceId, req.destDeviceId, req.signalType, getDeviceType, occupied)
    if (route) {
      results.push({ requirementId: req.id, status: 'ok', route, conflictWith: null })
    } else {
      const blocker = findBlocker(priorOkRoutes(results), connections, req, getDeviceType)
      results.push({ requirementId: req.id, status: 'conflict', route: null, conflictWith: blocker })
    }
  }
  return results
}

// Collect [{ requirementId, route }] for all prior ok results, in order.
function priorOkRoutes(results) {
  return results.filter(r => r.status === 'ok' && r.route).map(r => ({ requirementId: r.requirementId, route: r.route }))
}

// Device-level reachability — distinguishes "broken" (no path at all) from "conflict" (path blocked).
function deviceReachable(connections, sourceId, destId, signalType) {
  const visited = new Set([sourceId])
  const queue = [sourceId]
  while (queue.length > 0) {
    const id = queue.shift()
    if (id === destId) return true
    for (const conn of connections) {
      if (conn.fromDeviceId === id && conn.signalType === signalType && !visited.has(conn.toDeviceId)) {
        visited.add(conn.toDeviceId)
        queue.push(conn.toDeviceId)
      }
    }
  }
  return false
}

// Find the first prior ok requirement whose port consumption blocks `req`'s route.
// Replays consumption incrementally: consume routes[0..i], then test if req can still route.
// The first i where req can't route after consuming routes[0..i] is the blocker.
function findBlocker(priorRoutes, connections, req, getDeviceType) {
  const replayOccupied = new Set()
  for (const prior of priorRoutes) {
    for (const p of prior.route) replayOccupied.add(portKey(p.deviceId, p.portIndex, p.direction))
    const testRoute = findRoute(connections, req.sourceDeviceId, req.destDeviceId, req.signalType, getDeviceType, new Set(replayOccupied))
    if (!testRoute) return prior.requirementId
  }
  return null
}

export function isOccupied(connections, deviceId, portIndex, direction) {
  return connections.some(c =>
    direction === 'out'
      ? c.fromDeviceId === deviceId && c.fromPortIndex === portIndex
      : c.toDeviceId === deviceId && c.toPortIndex === portIndex
  )
}

export function getDeviceHeight(device, deviceTypes) {
  const types = deviceTypes || BUILTIN_DEVICE_TYPES
  const type = types[device.typeId]
  if (!type) return HEADER_HEIGHT + PORT_PADDING * 2 + PORT_ROW
  const maxPorts = Math.max(type.inputs.length, type.outputs.length)
  return HEADER_HEIGHT + PORT_PADDING * 2 + maxPorts * PORT_ROW
}

export function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}

/**
 * Build a standalone SVG string for the topology export (ADR-0006).
 * Simplified visual: device rectangles + port dots + connection curves + wire numbers.
 * Wire numbers match WiringPlanTab's String(i+1).padStart(2,'0') ordering.
 *
 * @param devices        project devices array
 * @param connections    project connections array
 * @param getDeviceType  (deviceId) => DEVICE_TYPES entry
 * @returns SVG string (with xmlns, sized to fit all devices + margin)
 */
export function buildTopologySVG(devices, connections, getDeviceType) {
  if (devices.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#0a0e14"/><text x="200" y="100" fill="#5a6577" font-family="sans-serif" font-size="14" text-anchor="middle">暂无设备</text></svg>'
  }

  // Compute bounds to size the SVG.
  let maxX = 0, maxY = 0
  for (const d of devices) {
    const h = getDeviceHeight(d)
    if (d.x + DEVICE_WIDTH > maxX) maxX = d.x + DEVICE_WIDTH
    if (d.y + h > maxY) maxY = d.y + h
  }
  const MARGIN = 40
  const W = maxX + MARGIN
  const H = maxY + MARGIN

  const parts = []
  // Background (matches canvas --bg-0).
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">')
  parts.push('<rect width="' + W + '" height="' + H + '" fill="#0a0e14"/>')

  // Connections first (so device rectangles draw on top of curve endpoints).
  connections.forEach((conn, i) => {
    const fromDev = devices.find(d => d.id === conn.fromDeviceId)
    const toDev = devices.find(d => d.id === conn.toDeviceId)
    if (!fromDev || !toDev) return
    const fromPos = getPortPos(fromDev, conn.fromPortIndex, 'out')
    const toPos = getPortPos(toDev, conn.toPortIndex, 'in')
    const path = getConnPath(fromPos.x, fromPos.y, toPos.x, toPos.y)
    const color = COLORS[conn.signalType] || COLORS.video
    parts.push('<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2"/>')
    // Wire number at midpoint, matching WiringPlanTab ordering.
    const num = String(i + 1).padStart(2, '0')
    const midX = (fromPos.x + toPos.x) / 2
    const midY = (fromPos.y + toPos.y) / 2
    parts.push('<circle cx="' + midX + '" cy="' + midY + '" r="11" fill="#0a0e14" stroke="' + color + '" stroke-width="1.5"/>')
    parts.push('<text x="' + midX + '" y="' + (midY + 4) + '" fill="' + color + '" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">' + num + '</text>')
  })

  // Devices.
  for (const d of devices) {
    const type = getDeviceType(d.id)
    if (!type) continue
    const h = getDeviceHeight(d)
    const accent = CAT_COLORS[type.category] || '#8893a7'
    // Device body.
    parts.push('<rect x="' + d.x + '" y="' + d.y + '" width="' + DEVICE_WIDTH + '" height="' + h + '" rx="6" fill="#141b26" stroke="#2e3a4f" stroke-width="1"/>')
    // Accent bar.
    parts.push('<rect x="' + d.x + '" y="' + d.y + '" width="3" height="' + h + '" fill="' + accent + '"/>')
    // Device name.
    parts.push('<text x="' + (d.x + 14) + '" y="' + (d.y + 23) + '" fill="#dde4f0" font-family="sans-serif" font-size="13" font-weight="600">' + escapeXML(d.name) + '</text>')

    // Ports: in on left edge, out on right edge.
    const maxPorts = Math.max(type.inputs.length, type.outputs.length)
    for (let i = 0; i < maxPorts; i++) {
      const inPort = type.inputs[i]
      const outPort = type.outputs[i]
      const y = d.y + HEADER_HEIGHT + PORT_PADDING + i * PORT_ROW + PORT_ROW / 2
      if (inPort) {
        const c = COLORS[inPort.signal] || COLORS.video
        parts.push('<circle cx="' + d.x + '" cy="' + y + '" r="4" fill="' + c + '"/>')
        parts.push('<text x="' + (d.x + 10) + '" y="' + (y + 3) + '" fill="#8893a7" font-family="monospace" font-size="9">' + escapeXML(inPort.label) + '</text>')
      }
      if (outPort) {
        const c = COLORS[outPort.signal] || COLORS.video
        parts.push('<circle cx="' + (d.x + DEVICE_WIDTH) + '" cy="' + y + '" r="4" fill="' + c + '"/>')
        parts.push('<text x="' + (d.x + DEVICE_WIDTH - 10) + '" y="' + (y + 3) + '" fill="#8893a7" font-family="monospace" font-size="9" text-anchor="end">' + escapeXML(outPort.label) + '</text>')
      }
    }
  }

  parts.push('</svg>')
  return parts.join('')
}

function escapeXML(s) {
  return String(s).replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]))
}

/**
 * Sanitize a project: drop devices whose typeId no longer exists in DEVICE_TYPES,
 * cascading the removal to their connections and requirements.
 * Returns { project, dropped } where `dropped` is the count of removed devices.
 * Does not mutate the input.
 */
export function sanitizeProject(project, deviceTypes) {
  const types = deviceTypes || BUILTIN_DEVICE_TYPES
  const validDevices = project.devices.filter(d => types[d.typeId])
  const dropped = project.devices.length - validDevices.length
  if (dropped === 0) return { project, dropped: 0 }
  const validIds = new Set(validDevices.map(d => d.id))
  return {
    project: {
      ...project,
      devices: validDevices,
      connections: project.connections.filter(c => validIds.has(c.fromDeviceId) && validIds.has(c.toDeviceId)),
      requirements: project.requirements.filter(r => validIds.has(r.sourceDeviceId) && validIds.has(r.destDeviceId)),
    },
    dropped,
  }
}

/**
 * Validate an imported project archive (ADR-0005).
 * Pure function - no JSX dependency, lives here so it can be unit-tested.
 *
 * @returns { ok: true } or { ok: false, reason: string }
 */
export function validateProjectArchive(archive, deviceTypes) {
  const types = deviceTypes || BUILTIN_DEVICE_TYPES
  if (!archive || typeof archive !== 'object') return { ok: false, reason: '文件不是有效的 JSON 对象' }
  if (archive.kind !== 'signal-route-planner-project') return { ok: false, reason: '不是信号路由规划项目归档（kind 不匹配）' }
  if (archive.version !== 1) return { ok: false, reason: '不支持的归档版本：' + archive.version }
  const proj = archive.project
  if (!proj || typeof proj !== 'object') return { ok: false, reason: '归档缺少 project 字段' }
  if (typeof proj.name !== 'string') return { ok: false, reason: '项目缺少名称' }
  if (!Array.isArray(proj.devices)) return { ok: false, reason: '设备清单缺失或非数组' }
  if (!Array.isArray(proj.connections)) return { ok: false, reason: '连线清单缺失或非数组' }
  if (!Array.isArray(proj.requirements)) return { ok: false, reason: '需求清单缺失或非数组' }
  for (const d of proj.devices) {
    if (!types[d.typeId]) return { ok: false, reason: '未知设备类型：' + d.typeId }
  }
  const deviceIds = new Set(proj.devices.map(d => d.id))
  for (const c of proj.connections) {
    if (!deviceIds.has(c.fromDeviceId)) return { ok: false, reason: '连线引用了不存在的设备：' + c.fromDeviceId }
    if (!deviceIds.has(c.toDeviceId)) return { ok: false, reason: '连线引用了不存在的设备：' + c.toDeviceId }
  }
  for (const r of proj.requirements) {
    if (!deviceIds.has(r.sourceDeviceId)) return { ok: false, reason: '需求引用了不存在的设备：' + r.sourceDeviceId }
    if (!deviceIds.has(r.destDeviceId)) return { ok: false, reason: '需求引用了不存在的设备：' + r.destDeviceId }
  }
  return { ok: true }
}
