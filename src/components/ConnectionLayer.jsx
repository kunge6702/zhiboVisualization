import { COLORS } from '../constants.js'
import { getPortPos, getConnPath } from '../utils.js'

export function ConnectionLayer({ connections, devices, connectingFrom, mousePos, selectedConnection, onConnectionClick, onDeleteConnection }) {
  return (
    <svg className="connection-layer" width="2400" height="1600">
      {connections.map(conn => {
        const fromDev = devices.find(d => d.id === conn.fromDeviceId)
        const toDev = devices.find(d => d.id === conn.toDeviceId)
        if (!fromDev || !toDev) return null
        const fromPos = getPortPos(fromDev, conn.fromPortIndex, 'out')
        const toPos = getPortPos(toDev, conn.toPortIndex, 'in')
        const path = getConnPath(fromPos.x, fromPos.y, toPos.x, toPos.y)
        const color = COLORS[conn.signalType]
        const isSel = selectedConnection === conn.id
        const midX = (fromPos.x + toPos.x) / 2
        const midY = (fromPos.y + toPos.y) / 2
        return (
          <g key={conn.id}>
            <path className="conn-hit" d={path} fill="none" stroke="transparent" strokeWidth={20}
              onMouseDown={e => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onConnectionClick(conn.id) }} />
            <path d={path} fill="none" stroke={color} strokeWidth={isSel ? 3 : 2}
              className={'conn-line' + (isSel ? ' conn-selected' : '')}
              style={isSel ? { filter: 'drop-shadow(0 0 8px ' + color + ')' } : {}} />
            {isSel && (
              <g className="conn-delete-btn" transform={'translate(' + midX + ',' + midY + ')'}>
                <circle r={16} fill="transparent" pointerEvents="all"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDeleteConnection(conn.id) }} />
                <circle r={10} fill={COLORS.err} pointerEvents="none" />
                <text textAnchor="middle" dy="4" fill="white" fontSize="14" fontWeight="bold"
                  pointerEvents="none">x</text>
              </g>
            )}
          </g>
        )
      })}
      {connectingFrom && (
        <path d={getConnPath(connectingFrom.x, connectingFrom.y, mousePos.x, mousePos.y)}
          fill="none" stroke={COLORS[connectingFrom.signalType]} strokeWidth={2}
          strokeDasharray="4 4" opacity={0.5} />
      )}
    </svg>
  )
}
