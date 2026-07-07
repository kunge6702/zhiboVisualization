import { HEADER_HEIGHT, PORT_PADDING, PORT_ROW, DEVICE_TYPES } from './constants.js'

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

export function getDeviceHeight(device) {
  const type = DEVICE_TYPES[device.typeId]
  if (!type) return HEADER_HEIGHT + PORT_PADDING * 2 + PORT_ROW
  const maxPorts = Math.max(type.inputs.length, type.outputs.length)
  return HEADER_HEIGHT + PORT_PADDING * 2 + maxPorts * PORT_ROW
}

export function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}
