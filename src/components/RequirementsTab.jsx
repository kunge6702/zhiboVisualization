import { useState, useMemo } from 'react'
import { DEVICE_TYPES } from '../constants.js'
import { validateRequirements } from '../utils.js'

export function RequirementsTab({ devices, connections, requirements, onAdd, onDelete }) {
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
