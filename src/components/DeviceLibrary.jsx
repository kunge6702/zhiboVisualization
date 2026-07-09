import { CAT_LABELS, CAT_COLORS, BUILTIN_DEVICE_TYPES } from '../constants.js'
import { Icons } from '../icons.jsx'

export function DeviceLibrary({ onAdd, deviceCounts, deviceTypes, customDeviceTypes, onCreateDeviceType, onEditDeviceType, onDeleteDeviceType }) {
  const types = deviceTypes || BUILTIN_DEVICE_TYPES
  const customKeys = customDeviceTypes ? Object.keys(customDeviceTypes) : []

  // Group by category. Separate built-in from custom for display.
  const categories = {}
  Object.entries(types).forEach(([typeId, type]) => {
    if (customKeys.includes(typeId)) return // custom shown in its own section
    if (!categories[type.category]) categories[type.category] = []
    categories[type.category].push({ typeId, ...type })
  })

  const customList = customKeys.map(typeId => ({ typeId, ...customDeviceTypes[typeId] }))

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
      {customList.length > 0 && (
        <div className="lib-cat">
          <div className="lib-cat-title">自定义设备</div>
          {customList.map(item => (
            <div className="lib-item" key={item.typeId} onClick={() => onAdd(item.typeId)}>
              <div className="lib-icon" style={{ color: CAT_COLORS[item.category] }}>{Icons[item.icon] || Icons[item.category]}</div>
              <div className="lib-info">
                <div className="lib-name">{item.label}</div>
                <div className="lib-ports">{item.inputs.length} in / {item.outputs.length} out</div>
              </div>
              {deviceCounts[item.typeId] > 0 && <span className="lib-badge">{deviceCounts[item.typeId]}</span>}
              <div className="lib-item-actions">
                <button className="lib-item-edit" onClick={(e) => { e.stopPropagation(); onEditDeviceType(item.typeId) }} title="编辑">✎</button>
                <button className="lib-item-edit" onClick={(e) => { e.stopPropagation(); onDeleteDeviceType(item.typeId) }} title="删除">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="lib-cat">
        <button className="btn lib-add-custom" onClick={onCreateDeviceType}>+ 新建设备类型</button>
      </div>
    </div>
  )
}
