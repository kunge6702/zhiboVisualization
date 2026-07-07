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

export function findRoute(connections, sourceId, destId, signalType) {
  const visited = new Set([sourceId])
  const queue = [{ id: sourceId, path: [sourceId] }]
  while (queue.length > 0) {
    const { id, path } = queue.shift()
    if (id === destId) return path
    const outgoing = connections.filter(c => c.fromDeviceId === id && c.signalType === signalType)
    for (const conn of outgoing) {
      if (!visited.has(conn.toDeviceId)) {
        visited.add(conn.toDeviceId)
        queue.push({ id: conn.toDeviceId, path: [...path, conn.toDeviceId] })
      }
    }
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
