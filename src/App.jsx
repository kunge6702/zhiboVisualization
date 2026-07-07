import { useState, useRef, useMemo, useEffect } from 'react'
import {
  DEVICE_TYPES, COLORS, CAT_COLORS, CAT_LABELS,
  INITIAL_DEVICES, INITIAL_CONNECTIONS, INITIAL_REQUIREMENTS,
} from './constants.js'
import { Icons } from './icons.jsx'
import { uid, initUidCounter, getPortPos, getConnPath, validateRequirements, isOccupied, getDeviceHeight, rectIntersect, buildTopologySVG } from './utils.js'

const STORAGE_KEY = 'signal-route-planner-v1'

/* ============ STORAGE HELPERS ============ */
let _loadWasCorrupt = false
function loadProjects() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    // First use: no data stored yet. Seed demo project silently.
    const defaultProject = [{
      id: uid('p'),
      name: '示例项目',
      devices: INITIAL_DEVICES.map(d => ({ ...d })),
      connections: INITIAL_CONNECTIONS.map(c => ({ ...c })),
      requirements: INITIAL_REQUIREMENTS.map(r => ({ ...r })),
    }]
    initUidCounter(defaultProject)
    return defaultProject
  }
  try {
    const data = JSON.parse(raw)
    if (data && data.projects && data.projects.length > 0) {
      initUidCounter(data.projects)
      return data.projects
    }
    // Stored but empty/invalid shape — treat as corrupt.
    _loadWasCorrupt = true
  } catch (e) {
    _loadWasCorrupt = true
  }
  const defaultProject = [{
    id: uid('p'),
    name: '示例项目',
    devices: INITIAL_DEVICES.map(d => ({ ...d })),
    connections: INITIAL_CONNECTIONS.map(c => ({ ...c })),
    requirements: INITIAL_REQUIREMENTS.map(r => ({ ...r })),
  }]
  initUidCounter(defaultProject)
  return defaultProject
}

function loadActiveProjectId() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (data && data.activeProjectId && data.projects &&
        data.projects.find(p => p.id === data.activeProjectId)) {
      return data.activeProjectId
    }
  } catch (e) {}
  return null
}

/* ============ PROJECT ARCHIVE VALIDATION ============ */
// Validates an imported JSON archive. Returns { ok: true } or { ok: false, reason }.
// Checks: archive shape, version, project sub-object, and that every device typeId exists in DEVICE_TYPES.
// Also verifies connection/requirement referential integrity against the imported device set.
export function validateProjectArchive(archive) {
  if (!archive || typeof archive !== 'object') return { ok: false, reason: '文件不是有效的 JSON 对象' }
  if (archive.kind !== 'signal-route-planner-project') return { ok: false, reason: '不是信号路由规划项目归档（kind 不匹配）' }
  if (archive.version !== 1) return { ok: false, reason: '不支持的归档版本：' + archive.version }
  const proj = archive.project
  if (!proj || typeof proj !== 'object') return { ok: false, reason: '归档缺少 project 字段' }
  if (typeof proj.name !== 'string') return { ok: false, reason: '项目缺少名称' }
  if (!Array.isArray(proj.devices)) return { ok: false, reason: '设备清单缺失或非数组' }
  if (!Array.isArray(proj.connections)) return { ok: false, reason: '连线清单缺失或非数组' }
  if (!Array.isArray(proj.requirements)) return { ok: false, reason: '需求清单缺失或非数组' }
  // Every device must reference a known typeId.
  for (const d of proj.devices) {
    if (!DEVICE_TYPES[d.typeId]) return { ok: false, reason: '未知设备类型：' + d.typeId }
  }
  // Referential integrity: connections reference imported device ids.
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

/* ============ PROJECT SELECTOR ============ */
function ProjectSelector({ projects, activeProjectId, onSelect, onRename, onDuplicate, onDelete, onCreate, onExport, onImport, onExportTopology }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  const current = projects.find(p => p.id === activeProjectId) || projects[0]

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  function startRename(project) {
    setEditingId(project.id)
    setEditValue(project.name)
    setDeletingId(null)
  }

  function confirmRename() {
    if (editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  function cancelRename() {
    setEditingId(null)
  }

  function closeDropdown() {
    setOpen(false)
    setEditingId(null)
    setDeletingId(null)
  }

  return (
    <div className="project-selector">
      <button className="project-current" onClick={() => { setOpen(!open); setDeletingId(null) }}>
        <span className="project-current-name">{current ? current.name : ''}</span>
        <svg className="project-caret" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="project-dropdown-overlay" onClick={closeDropdown} />
          <div className="project-dropdown">
            {projects.map(p => (
              <div key={p.id} className={'project-item' + (p.id === activeProjectId ? ' active' : '')}>
                {editingId === p.id ? (
                  <input
                    ref={inputRef}
                    className="project-rename-input"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={confirmRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
                      if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                    }}
                    onMouseDown={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span
                      className="project-item-name"
                      onClick={() => { onSelect(p.id); closeDropdown() }}
                      onDoubleClick={e => { e.stopPropagation(); startRename(p) }}
                    >
                      {p.name}
                    </span>
                    {deletingId === p.id ? (
                      <span
                        className="project-delete-confirm"
                        onClick={e => { e.stopPropagation(); onDelete(p.id); setDeletingId(null); }}
                      >
                        确认删除?
                      </span>
                    ) : (
                      <button
                        className="project-delete-btn"
                        onClick={e => { e.stopPropagation(); setDeletingId(p.id) }}
                        title="删除项目"
                      >
                        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
            <div className="project-dropdown-divider" />
            <div className="project-dropdown-actions">
              <button className="btn" onClick={() => { onCreate(); closeDropdown() }}>新建项目</button>
              <button className="btn" onClick={() => { onDuplicate(); closeDropdown() }}>复制当前项目</button>
              <button className="btn" onClick={() => { onExport(); closeDropdown() }} disabled={projects.length === 0}>导出归档</button>
              <button className="btn" onClick={() => { onExportTopology(); closeDropdown() }} disabled={projects.length === 0}>导出拓扑图</button>
              <button className="btn" onClick={() => fileInputRef.current && fileInputRef.current.click()}>导入归档</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0]
                  if (file) onImport(file)
                  e.target.value = ''
                  closeDropdown()
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ============ DEVICE NODE ============ */
function DeviceNode({ device, type, connections, connectingFrom, selected, onPortClick, onDragStart, onDelete, onRename }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(device.name)
  const nameInputRef = useRef(null)
  const cancelledRef = useRef(false)

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

/* ============ CONNECTION LAYER ============ */
function ConnectionLayer({ connections, devices, connectingFrom, mousePos, selectedConnection, onConnectionClick, onDeleteConnection }) {
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

/* ============ DEVICE LIBRARY ============ */
function DeviceLibrary({ onAdd, deviceCounts }) {
  const categories = {}
  Object.entries(DEVICE_TYPES).forEach(([typeId, type]) => {
    if (!categories[type.category]) categories[type.category] = []
    categories[type.category].push({ typeId, ...type })
  })
  return (
    <div className="library">
      <div className="panel-title">设备库</div>
      {Object.entries(categories).map(([catKey, catItems]) => (
        <div className="lib-cat" key={catKey}>
          <div className="lib-cat-title">{CAT_LABELS[catKey]}</div>
          {catItems.map(item => (
            <div className="lib-item" key={item.typeId} onClick={() => onAdd(item.typeId)}>
              <div className="lib-icon" style={{ color: CAT_COLORS[item.category] }}>{Icons[item.icon] || Icons[item.category]}</div>
              <div className="lib-info">
                <div className="lib-name">{item.label}</div>
                <div className="lib-ports">{item.inputs.length} in / {item.outputs.length} out</div>
              </div>
              {deviceCounts[item.typeId] > 0 && <span className="lib-badge">{deviceCounts[item.typeId]}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ============ REQUIREMENTS TAB ============ */
function RequirementsTab({ devices, connections, requirements, onAdd, onDelete }) {
  const [srcId, setSrcId] = useState('')
  const [dstId, setDstId] = useState('')
  const [sigType, setSigType] = useState('video')

  const getDeviceType = (deviceId) => {
    const dev = devices.find(d => d.id === deviceId)
    return dev ? DEVICE_TYPES[dev.typeId] : undefined
  }

  const validation = useMemo(() => {
    const results = validateRequirements(requirements, connections, getDeviceType)
    return requirements.map(req => {
      const result = results.find(r => r.requirementId === req.id) || { status: 'broken', route: null, conflictWith: null }
      return { ...req, ...result }
    })
  }, [requirements, connections, devices])

  function handleAdd() {
    if (!srcId || !dstId || srcId === dstId) return
    onAdd(srcId, dstId, sigType)
    setSrcId('')
    setDstId('')
  }

  return (
    <div>
      <div className="req-form">
        <div className="form-row">
          <label>起始设备</label>
          <select value={srcId} onChange={e => setSrcId(e.target.value)}>
            <option value="">选择设备...</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>目标设备</label>
          <select value={dstId} onChange={e => setDstId(e.target.value)}>
            <option value="">选择设备...</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>信号类型</label>
          <div className="signal-toggle">
            <button className={'sig-btn' + (sigType === 'video' ? ' active sig-video' : '')} onClick={() => setSigType('video')}>视频</button>
            <button className={'sig-btn' + (sigType === 'audio' ? ' active sig-audio' : '')} onClick={() => setSigType('audio')}>音频</button>
          </div>
        </div>
        <button className="btn btn-primary req-add" onClick={handleAdd} disabled={!srcId || !dstId || srcId === dstId}>
          添加信号需求
        </button>
      </div>

      <div className="req-list">
        {validation.length === 0 && <div className="empty-hint">暂无信号需求</div>}
        {validation.map(req => {
          const srcDev = devices.find(d => d.id === req.sourceDeviceId)
          const dstDev = devices.find(d => d.id === req.destDeviceId)
          if (!srcDev || !dstDev) return null
          // Port-level route -> device name chain (dedupe consecutive same-device entries).
          const routeNames = req.route ? req.route.map(p => {
            const d = devices.find(dd => dd.id === p.deviceId)
            return d ? d.name : '?'
          }).filter((name, i, arr) => i === 0 || name !== arr[i - 1]).join(' -> ') : null
          const status = req.status || 'broken'
          // For conflict, find the blocker requirement's label for the message.
          const blockerReq = req.conflictWith ? requirements.find(r => r.id === req.conflictWith) : null
          const blockerLabel = blockerReq
            ? (devices.find(d => d.id === blockerReq.sourceDeviceId)?.name || '?') + ' -> ' + (devices.find(d => d.id === blockerReq.destDeviceId)?.name || '?')
            : null
          return (
            <div key={req.id} className={'req-item ' + status}>
              <div className="req-header">
                <span className={'req-status ' + status} />
                <span className="req-desc">
                  {srcDev.name} -&gt; {dstDev.name}
                  <span className={'req-type ' + req.signalType}>{req.signalType === 'video' ? '视频' : '音频'}</span>
                </span>
                <button className="req-delete" onClick={() => onDelete(req.id)}>
                  <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {status === 'ok' && routeNames && (
                <div className="req-route">{routeNames}</div>
              )}
              {status === 'broken' && (
                <div className="req-broken">未找到完整路由</div>
              )}
              {status === 'conflict' && (
                <div className="req-conflict">端口冲突：与 [{blockerLabel || req.conflictWith}] 争抢端口</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============ WIRING PLAN TAB ============ */
function WiringPlanTab({ connections, devices, onExport, onExportTopology }) {
  const lines = connections.map((conn, i) => {
    const fromDev = devices.find(d => d.id === conn.fromDeviceId)
    const toDev = devices.find(d => d.id === conn.toDeviceId)
    if (!fromDev || !toDev) return null
    const fromPort = DEVICE_TYPES[fromDev.typeId].outputs[conn.fromPortIndex]
    const toPort = DEVICE_TYPES[toDev.typeId].inputs[conn.toPortIndex]
    if (!fromPort || !toPort) return null
    const num = String(i + 1).padStart(2, '0')
    const fromText = fromDev.name + ' . ' + fromPort.label
    const toText = toDev.name + ' . ' + toPort.label
    const padFrom = fromText.padEnd(28, ' ')
    return num + '  ' + padFrom + ' -->  ' + toText
  }).filter(Boolean)

  return (
    <div>
      <div className="wiring-header">
        <div>
          <div className="wiring-title">接线方案</div>
          <div className="wiring-count">共 {connections.length} 根连线</div>
        </div>
        <div className="wiring-actions">
          <button className="btn" onClick={onExportTopology} disabled={connections.length === 0}>导出拓扑图</button>
          <button className="btn btn-primary" onClick={onExport} disabled={connections.length === 0}>复制方案</button>
        </div>
      </div>
      <div className="wiring-section-title">连线清单</div>
      <pre className="wiring-list">{lines.join('\n') || '暂无连线'}</pre>
    </div>
  )
}

/* ============ APP ============ */
export default function App() {
  const [projects, setProjects] = useState(loadProjects)
  const [activeProjectId, setActiveProjectId] = useState(loadActiveProjectId)
  const [connectingFrom, setConnectingFrom] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [selectedConn, setSelectedConn] = useState(null)
  const [selectedDevices, setSelectedDevices] = useState(new Set())
  const [selBox, setSelBox] = useState(null)
  const [activeTab, setActiveTab] = useState('requirements')
  const [toast, setToast] = useState(null)
  const canvasRef = useRef(null)
  const toastTimerRef = useRef(null)

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0]
  const devices = currentProject.devices
  const connections = currentProject.connections
  const requirements = currentProject.requirements

  // Persist to localStorage
  useEffect(() => {
    try {
      const activeId = activeProjectId || (projects[0] && projects[0].id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, activeProjectId: activeId }))
    } catch (e) {
      // Quota exceeded or storage unavailable — surface to user, don't silently lose.
      showToast('保存失败，建议立即导出项目归档')
    }
  }, [projects, activeProjectId])

  // One-time: warn if local data was corrupt on load (ADR-0005 — informed failure).
  useEffect(() => {
    if (_loadWasCorrupt) {
      showToast('检测到本地数据损坏，已加载示例项目。原有数据无法恢复，请从导出的归档恢复')
    }
  }, [])

  // Sync activeProjectId if null or stale (e.g. first load)
  useEffect(() => {
    if (!activeProjectId || !projects.find(p => p.id === activeProjectId)) {
      if (projects.length > 0) setActiveProjectId(projects[0].id)
    }
  }, [projects, activeProjectId])

  // Escape key to cancel connection / deselect
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (connectingFrom) setConnectingFrom(null)
        if (selectedConn) setSelectedConn(null)
        if (selectedDevices.size > 0) setSelectedDevices(new Set())
        if (selBox) setSelBox(null)
        if (dragging) setDragging(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [connectingFrom, selectedConn, selectedDevices, selBox, dragging])

  const deviceCounts = useMemo(() => {
    const counts = {}
    devices.forEach(d => { counts[d.typeId] = (counts[d.typeId] || 0) + 1 })
    return counts
  }, [devices])

  function showToast(msg, type) {
    setToast({ msg, type: type || 'error' })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }

  function getCanvasPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function updateCurrentProject(updates) {
    setProjects(prev => prev.map(p =>
      p.id === currentProject.id ? { ...p, ...updates } : p
    ))
  }

  /* ----- PROJECT OPERATIONS ----- */
  function handleCreateProject() {
    const maxNum = projects.reduce((max, p) => {
      const m = p.name.match(/(\d+)$/)
      return Math.max(max, m ? parseInt(m[1]) : 0)
    }, 0)
    const newProject = {
      id: uid('p'),
      name: '新项目 ' + (maxNum + 1),
      devices: [],
      connections: [],
      requirements: [],
    }
    setProjects([...projects, newProject])
    setActiveProjectId(newProject.id)
    setConnectingFrom(null)
    setSelectedConn(null)
    setSelectedDevices(new Set())
    setDragging(null)
    setSelBox(null)
  }

  function handleDuplicateProject() {
    const current = currentProject
    const baseName = current.name + ' 副本'
    let finalName = baseName
    let counter = 2
    while (projects.some(p => p.name === finalName)) {
      finalName = baseName + ' ' + counter
      counter++
    }
    const newProject = {
      id: uid('p'),
      name: finalName,
      devices: JSON.parse(JSON.stringify(current.devices)),
      connections: JSON.parse(JSON.stringify(current.connections)),
      requirements: JSON.parse(JSON.stringify(current.requirements)),
    }
    setProjects([...projects, newProject])
    setActiveProjectId(newProject.id)
    setConnectingFrom(null)
    setSelectedConn(null)
    setSelectedDevices(new Set())
    setDragging(null)
    setSelBox(null)
  }

  function handleDeleteProject(projectId) {
    const remaining = projects.filter(p => p.id !== projectId)
    if (remaining.length === 0) {
      const newProject = {
        id: uid('p'),
        name: '新项目 1',
        devices: [],
        connections: [],
        requirements: [],
      }
      setProjects([newProject])
      setActiveProjectId(newProject.id)
    } else {
      setProjects(remaining)
      if (currentProject.id === projectId) {
        setActiveProjectId(remaining[0].id)
      }
    }
    setConnectingFrom(null)
    setSelectedConn(null)
    setSelectedDevices(new Set())
    setDragging(null)
    setSelBox(null)
  }

  function handleSelectProject(projectId) {
    setActiveProjectId(projectId)
    setConnectingFrom(null)
    setSelectedConn(null)
    setSelectedDevices(new Set())
    setDragging(null)
    setSelBox(null)
  }

  function handleRenameProject(projectId, newName) {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, name: newName } : p
    ))
  }

  /* ----- DEVICE OPERATIONS ----- */
  function handleAddDevice(typeId) {
    const type = DEVICE_TYPES[typeId]
    const sameType = devices.filter(d => d.typeId === typeId)
    const maxNum = sameType.reduce((max, d) => {
      const m = d.name.match(/(\d+)$/)
      return Math.max(max, m ? parseInt(m[1]) : 0)
    }, 0)
    const newDev = {
      id: uid('d'),
      typeId,
      name: type.label + ' ' + (maxNum + 1),
      x: 100 + Math.random() * 150,
      y: 100 + Math.random() * 150,
    }
    updateCurrentProject({ devices: [...devices, newDev] })
  }

  function handleRenameDevice(deviceId, newName) {
    updateCurrentProject({
      devices: devices.map(d =>
        d.id === deviceId ? { ...d, name: newName } : d
      )
    })
  }

  function handlePortClick(deviceId, portIndex, direction, signalType) {
    if (direction === 'out') {
      if (connectingFrom && connectingFrom.deviceId === deviceId && connectingFrom.portIndex === portIndex) {
        setConnectingFrom(null)
        return
      }
      if (isOccupied(connections, deviceId, portIndex, 'out')) {
        showToast('该输出端口已被占用')
        return
      }
      const device = devices.find(d => d.id === deviceId)
      const pos = getPortPos(device, portIndex, 'out')
      setConnectingFrom({ deviceId, portIndex, direction, signalType, x: pos.x, y: pos.y })
      setSelectedConn(null)
    } else {
      if (!connectingFrom) return
      if (connectingFrom.deviceId === deviceId) {
        showToast('不能连接到同一设备')
        setConnectingFrom(null)
        return
      }
      if (isOccupied(connections, deviceId, portIndex, 'in')) {
        showToast('该输入端口已被占用')
        setConnectingFrom(null)
        return
      }
      const targetDevice = devices.find(d => d.id === deviceId)
      const targetType = DEVICE_TYPES[targetDevice.typeId]
      const inputSignal = targetType.inputs[portIndex].signal
      if (inputSignal !== connectingFrom.signalType) {
        showToast('信号类型不匹配')
        setConnectingFrom(null)
        return
      }
      const newConn = {
        id: uid('c'),
        fromDeviceId: connectingFrom.deviceId,
        fromPortIndex: connectingFrom.portIndex,
        toDeviceId: deviceId,
        toPortIndex: portIndex,
        signalType: connectingFrom.signalType,
      }
      updateCurrentProject({ connections: [...connections, newConn] })
      setConnectingFrom(null)
    }
  }

  function handleDragStart(e, device) {
    e.stopPropagation()
    const pos = getCanvasPos(e)
    const isMultiSelected = selectedDevices.has(device.id) && selectedDevices.size > 1
    if (isMultiSelected) {
      const startPositions = {}
      devices.forEach(d => {
        if (selectedDevices.has(d.id)) {
          startPositions[d.id] = { x: d.x, y: d.y }
        }
      })
      setDragging({ type: 'group', id: device.id, startPositions, startMouseX: pos.x, startMouseY: pos.y })
    } else {
      if (!selectedDevices.has(device.id)) {
        setSelectedDevices(new Set())
      }
      setDragging({ type: 'single', id: device.id, offsetX: pos.x - device.x, offsetY: pos.y - device.y })
    }
    setConnectingFrom(null)
    setSelectedConn(null)
  }

  function handleMouseMove(e) {
    if (!canvasRef.current) return
    const pos = getCanvasPos(e)
    if (dragging) {
      if (dragging.type === 'group') {
        const dx = pos.x - dragging.startMouseX
        const dy = pos.y - dragging.startMouseY
        updateCurrentProject({
          devices: devices.map(d => {
            const start = dragging.startPositions[d.id]
            if (start) {
              return { ...d, x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy) }
            }
            return d
          })
        })
      } else {
        updateCurrentProject({
          devices: devices.map(d =>
            d.id === dragging.id
              ? { ...d, x: Math.max(0, pos.x - dragging.offsetX), y: Math.max(0, pos.y - dragging.offsetY) }
              : d
          )
        })
      }
    } else if (selBox) {
      setSelBox({ ...selBox, curX: pos.x, curY: pos.y })
      const rx = Math.min(selBox.startX, pos.x)
      const ry = Math.min(selBox.startY, pos.y)
      const rw = Math.abs(pos.x - selBox.startX)
      const rh = Math.abs(pos.y - selBox.startY)
      const newSelected = new Set(
        devices.filter(d => rectIntersect(d.x, d.y, 200, getDeviceHeight(d), rx, ry, rw, rh)).map(d => d.id)
      )
      setSelectedDevices(newSelected)
    } else if (connectingFrom) {
      setMousePos(pos)
    }
  }

  function handleMouseUp() {
    if (dragging) setDragging(null)
    if (selBox) {
      const dx = Math.abs(selBox.curX - selBox.startX)
      const dy = Math.abs(selBox.curY - selBox.startY)
      if (dx < 3 && dy < 3) {
        setSelectedDevices(new Set())
      }
      setSelBox(null)
    }
  }

  function handleCanvasMouseDown(e) {
    const pos = getCanvasPos(e)
    setSelBox({ startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y })
    setSelectedDevices(new Set())
    setConnectingFrom(null)
    setSelectedConn(null)
  }

  function handleCanvasClick() {
    if (connectingFrom) setConnectingFrom(null)
    if (selectedConn) setSelectedConn(null)
  }

  function handleDeleteDevice(deviceId) {
    updateCurrentProject({
      devices: devices.filter(d => d.id !== deviceId),
      connections: connections.filter(c => c.fromDeviceId !== deviceId && c.toDeviceId !== deviceId),
      requirements: requirements.filter(r => r.sourceDeviceId !== deviceId && r.destDeviceId !== deviceId),
    })
    if (connectingFrom && connectingFrom.deviceId === deviceId) setConnectingFrom(null)
    setSelectedConn(null)
    setSelectedDevices(prev => {
      const next = new Set(prev)
      next.delete(deviceId)
      return next
    })
  }

  function handleDeleteConnection(connId) {
    updateCurrentProject({
      connections: connections.filter(c => c.id !== connId)
    })
    setSelectedConn(null)
  }

  function handleAddRequirement(srcId, dstId, sigType) {
    updateCurrentProject({
      requirements: [...requirements, { id: uid('r'), sourceDeviceId: srcId, destDeviceId: dstId, signalType: sigType }]
    })
  }

  function handleDeleteRequirement(reqId) {
    updateCurrentProject({
      requirements: requirements.filter(r => r.id !== reqId)
    })
  }

  function handleExport() {
    const lines = connections.map((conn, i) => {
      const fromDev = devices.find(d => d.id === conn.fromDeviceId)
      const toDev = devices.find(d => d.id === conn.toDeviceId)
      if (!fromDev || !toDev) return null
      const fromPort = DEVICE_TYPES[fromDev.typeId].outputs[conn.fromPortIndex]
      const toPort = DEVICE_TYPES[toDev.typeId].inputs[conn.toPortIndex]
      if (!fromPort || !toPort) return null
      const num = String(i + 1).padStart(2, '0')
      return num + '  ' + fromDev.name + ' . ' + fromPort.label + '  -->  ' + toDev.name + ' . ' + toPort.label
    }).filter(Boolean)
    const text = '接线方案\n' + '='.repeat(50) + '\n连线清单 (共 ' + connections.length + ' 根)\n' + '.'.repeat(50) + '\n\n' + lines.join('\n') + '\n\n' + '='.repeat(50)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'info')
      }).catch(() => {
        showToast('复制失败，请手动选择文本')
      })
    }
  }

  /* ----- PROJECT ARCHIVE (export / import) — ADR-0005 ----- */
  function handleExportProject() {
    // Human-readable JSON of the current project's full state.
    const archive = {
      kind: 'signal-route-planner-project',
      version: 1,
      exportedAt: new Date().toISOString(),
      project: {
        name: currentProject.name,
        devices: currentProject.devices,
        connections: currentProject.connections,
        requirements: currentProject.requirements,
      },
    }
    const json = JSON.stringify(archive, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    const safeName = currentProject.name.replace(/[\\/:*?"<>|]/g, '_')
    a.href = url
    a.download = safeName + '_' + date + '.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('已导出项目归档', 'info')
  }

  function handleImportProject(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      let archive
      try {
        archive = JSON.parse(e.target.result)
      } catch (err) {
        showToast('导入失败：JSON 格式错误')
        return
      }
      const validation = validateProjectArchive(archive)
      if (!validation.ok) {
        showToast('导入失败：' + validation.reason)
        return
      }
      // Import as a new project with fresh ids to avoid collisions with existing projects.
      const imported = archive.project
      const idMap = {}
      const remapDevices = imported.devices.map(d => {
        const newId = uid('d')
        idMap[d.id] = newId
        return { ...d, id: newId }
      })
      const remapConnections = imported.connections.map(c => ({
        ...c,
        id: uid('c'),
        fromDeviceId: idMap[c.fromDeviceId] || c.fromDeviceId,
        toDeviceId: idMap[c.toDeviceId] || c.toDeviceId,
      }))
      const remapRequirements = imported.requirements.map(r => ({
        ...r,
        id: uid('r'),
        sourceDeviceId: idMap[r.sourceDeviceId] || r.sourceDeviceId,
        destDeviceId: idMap[r.destDeviceId] || r.destDeviceId,
      }))
      const baseName = imported.name + ' (导入)'
      let finalName = baseName
      let counter = 2
      while (projects.some(p => p.name === finalName)) {
        finalName = baseName + ' ' + counter
        counter++
      }
      const newProject = {
        id: uid('p'),
        name: finalName,
        devices: remapDevices,
        connections: remapConnections,
        requirements: remapRequirements,
      }
      setProjects([...projects, newProject])
      setActiveProjectId(newProject.id)
      setConnectingFrom(null)
      setSelectedConn(null)
      setSelectedDevices(new Set())
      setDragging(null)
      setSelBox(null)
      showToast('已导入项目：' + finalName, 'info')
    }
    reader.onerror = () => showToast('导入失败：无法读取文件')
    reader.readAsText(file)
  }

  /* ----- TOPOLOGY EXPORT (ADR-0006) ----- */
  function handleExportTopology() {
    if (devices.length === 0) {
      showToast('画布无设备，无法导出拓扑图')
      return
    }
    const getDeviceType = (deviceId) => {
      const dev = devices.find(d => d.id === deviceId)
      return dev ? DEVICE_TYPES[dev.typeId] : undefined
    }
    const svg = buildTopologySVG(devices, connections, getDeviceType)
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      // Render SVG onto canvas at 2x for crisp output.
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * scale
      canvas.height = img.naturalHeight * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) { showToast('拓扑图导出失败'); return }
        const pngUrl = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        const date = new Date().toISOString().slice(0, 10)
        const safeName = currentProject.name.replace(/[\\/:*?"<>|]/g, '_')
        a.href = pngUrl
        a.download = '拓扑图_' + safeName + '_' + date + '.png'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(pngUrl)
        showToast('已导出拓扑图', 'info')
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      showToast('拓扑图导出失败：SVG 渲染错误')
    }
    img.src = url
  }

  return (
    <div className="app">
      <div className="toolbar">
        <div className="brand">
          <span className="brand-mark">SR</span>
          <ProjectSelector
            projects={projects}
            activeProjectId={currentProject.id}
            onSelect={handleSelectProject}
            onRename={handleRenameProject}
            onDuplicate={handleDuplicateProject}
            onDelete={handleDeleteProject}
            onCreate={handleCreateProject}
            onExport={handleExportProject}
            onImport={handleImportProject}
            onExportTopology={handleExportTopology}
          />
        </div>
        <div className="toolbar-stats">
          <span>设备 <b>{devices.length}</b></span>
          <span>连线 <b>{connections.length}</b></span>
          <span>需求 <b>{requirements.length}</b></span>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={handleCreateProject}>新建项目</button>
        </div>
      </div>

      <DeviceLibrary onAdd={handleAddDevice} deviceCounts={deviceCounts} />

      <div className="canvas-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        <div className="canvas" ref={canvasRef} onMouseDown={handleCanvasMouseDown} onClick={handleCanvasClick}>
          <ConnectionLayer
            connections={connections}
            devices={devices}
            connectingFrom={connectingFrom}
            mousePos={mousePos}
            selectedConnection={selectedConn}
            onConnectionClick={setSelectedConn}
            onDeleteConnection={handleDeleteConnection}
          />
          {selBox && (
            <div className="selection-box" style={{
              left: Math.min(selBox.startX, selBox.curX),
              top: Math.min(selBox.startY, selBox.curY),
              width: Math.abs(selBox.curX - selBox.startX),
              height: Math.abs(selBox.curY - selBox.startY),
            }} />
          )}
          {devices.map(d => (
            <DeviceNode
              key={d.id}
              device={d}
              type={DEVICE_TYPES[d.typeId]}
              connections={connections}
              connectingFrom={connectingFrom}
              selected={selectedDevices.has(d.id)}
              onPortClick={handlePortClick}
              onDragStart={handleDragStart}
              onDelete={handleDeleteDevice}
              onRename={handleRenameDevice}
            />
          ))}
          {devices.length === 0 && (
            <div className="canvas-empty">
              {Icons.empty}
              <p>点击左侧设备库添加设备到画布</p>
            </div>
          )}
          {toast && (
            <div className={toast.type === 'info' ? 'info-toast' : 'error-toast'}>{toast.msg}</div>
          )}
        </div>
      </div>

      <div className="side-panel">
        <div className="tab-bar">
          <button className={'tab' + (activeTab === 'requirements' ? ' active' : '')} onClick={() => setActiveTab('requirements')}>信号需求</button>
          <button className={'tab' + (activeTab === 'wiring' ? ' active' : '')} onClick={() => setActiveTab('wiring')}>接线方案</button>
        </div>
        <div className="tab-content">
          {activeTab === 'requirements' ? (
            <RequirementsTab
              devices={devices}
              connections={connections}
              requirements={requirements}
              onAdd={handleAddRequirement}
              onDelete={handleDeleteRequirement}
            />
          ) : (
            <WiringPlanTab
              connections={connections}
              devices={devices}
              onExport={handleExport}
              onExportTopology={handleExportTopology}
            />
          )}
        </div>
      </div>
    </div>
  )
}
