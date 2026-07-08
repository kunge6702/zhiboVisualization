import { useState, useRef, useEffect } from 'react'
import { COLORS, CAT_COLORS } from '../constants.js'
import { Icons } from '../icons.jsx'
import { isOccupied } from '../utils.js'

export function DeviceNode({ device, type, connections, connectingFrom, selected, onPortClick, onDragStart, onDelete, onRename }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(device.name)
  const nameInputRef = useRef(null)
  const cancelledRef = useRef(false)

  // Defensive: if typeId is invalid (shouldn't happen after sanitize, but guard against white screen).
  if (!type) return null
  const accentColor = CAT_COLORS[type.category]
  const maxPorts = Math.max(type.inputs.length, type.outputs.length)

  useEffect(() => {
    if (editing && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editing])

  function handleNameDoubleClick(e) {
    e.stopPropagation()
    e.preventDefault()
    setEditValue(device.name)
    setEditing(true)
  }

  function confirmName() {
    if (!cancelledRef.current && editValue.trim()) {
      onRename(device.id, editValue.trim())
    }
    cancelledRef.current = false
    setEditing(false)
  }

  function cancelName() {
    cancelledRef.current = true
    setEditing(false)
  }

  const rows = []
  for (let i = 0; i < maxPorts; i++) {
    const inPort = type.inputs[i]
    const outPort = type.outputs[i]
    rows.push(
      <div className="port-row" key={i}>
        <div className="port-side in">
          {inPort && (
            <>
              <div
                className={'port-circle' + (isOccupied(connections, device.id, i, 'in') ? ' occupied' : '')}
                style={{ '--pc': COLORS[inPort.signal] }}
                onClick={(e) => { e.stopPropagation(); onPortClick(device.id, i, 'in', inPort.signal) }}
              />
              <span className="port-label">{inPort.label}</span>
            </>
          )}
        </div>
        <div className="port-side out">
          {outPort && (
            <>
              <span className="port-label">{outPort.label}</span>
              <div
                className={'port-circle' + (isOccupied(connections, device.id, i, 'out') ? ' occupied' : '') + (connectingFrom && connectingFrom.deviceId === device.id && connectingFrom.portIndex === i ? ' connecting' : '')}
                style={{ '--pc': COLORS[outPort.signal] }}
                onClick={(e) => { e.stopPropagation(); onPortClick(device.id, i, 'out', outPort.signal) }}
              />
            </>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className={'device-node' + (selected ? ' selected' : '')} style={{ left: device.x, top: device.y }}>
      <div className="device-accent" style={{ background: accentColor }} />
      <div className="device-header" onMouseDown={(e) => onDragStart(e, device)}>
        <div className="device-icon" style={{ color: accentColor }}>{Icons[type.icon] || Icons[type.category]}</div>
        {editing ? (
          <input
            ref={nameInputRef}
            className="device-name-input"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={confirmName}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmName() }
              if (e.key === 'Escape') { e.preventDefault(); cancelName() }
            }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div className="device-name" onDoubleClick={handleNameDoubleClick}>{device.name}</div>
        )}
        <button className="device-delete" onClick={(e) => { e.stopPropagation(); onDelete(device.id) }}>
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="device-ports" onMouseDown={e => e.stopPropagation()}>{rows}</div>
    </div>
  )
}
