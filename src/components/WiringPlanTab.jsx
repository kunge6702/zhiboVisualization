import { DEVICE_TYPES } from '../constants.js'

export function WiringPlanTab({ connections, devices, onExport, onExportTopology }) {
  const lines = connections.map((conn, i) => {
    const fromDev = devices.find(d => d.id === conn.fromDeviceId)
    const toDev = devices.find(d => d.id === conn.toDeviceId)
    if (!fromDev || !toDev) return null
    const fromType = DEVICE_TYPES[fromDev.typeId]
    const toType = DEVICE_TYPES[toDev.typeId]
    if (!fromType || !toType) return null
    const fromPort = fromType.outputs[conn.fromPortIndex]
    const toPort = toType.inputs[conn.toPortIndex]
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
