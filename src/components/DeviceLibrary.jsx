import { DEVICE_TYPES, CAT_LABELS, CAT_COLORS } from '../constants.js'
import { Icons } from '../icons.jsx'

export function DeviceLibrary({ onAdd, deviceCounts }) {
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
