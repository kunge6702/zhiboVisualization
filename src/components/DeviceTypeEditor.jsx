import { useState, useEffect, useRef } from 'react'
import { CAT_LABELS } from '../constants.js'

const CATEGORIES = Object.keys(CAT_LABELS)

export function DeviceTypeEditor({ mode, existingType, onSave, onCancel }) {
  const [label, setLabel] = useState(existingType?.label || '')
  const [category, setCategory] = useState(existingType?.category || 'source')
  const [inputs, setInputs] = useState(existingType?.inputs?.map(p => ({ ...p })) || [])
  const [outputs, setOutputs] = useState(existingType?.outputs?.map(p => ({ ...p })) || [])
  const labelRef = useRef(null)

  useEffect(() => {
    if (labelRef.current) {
      labelRef.current.focus()
      labelRef.current.select()
    }
  }, [])

  function addInput() {
    setInputs([...inputs, { label: 'IN ' + (inputs.length + 1), signal: 'video' }])
  }
  function addOutput() {
    setOutputs([...outputs, { label: 'OUT ' + (outputs.length + 1), signal: 'video' }])
  }
  function updateInput(i, field, value) {
    setInputs(inputs.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }
  function updateOutput(i, field, value) {
    setOutputs(outputs.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }
  function removeInput(i) {
    setInputs(inputs.filter((_, idx) => idx !== i))
  }
  function removeOutput(i) {
    setOutputs(outputs.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    if (!label.trim()) return
    onSave({
      typeId: existingType?.typeId,
      label: label.trim(),
      category,
      inputs,
      outputs,
    })
  }

  return (
    <div className="device-type-editor-overlay" onMouseDown={onCancel}>
      <div className="device-type-editor" onMouseDown={e => e.stopPropagation()}>
        <div className="dte-title">{existingType ? '编辑设备类型' : '新建设备类型'}</div>
        <div className="dte-field">
          <label>名称</label>
          <input ref={labelRef} value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
            placeholder="如：索尼A7S3" />
        </div>
        <div className="dte-field">
          <label>类目</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="dte-ports-section">
          <div className="dte-ports-title">
            输入端口
            <button className="dte-add-port" onClick={addInput}>+ 添加</button>
          </div>
          {inputs.length === 0 && <div className="dte-empty-ports">无输入端口</div>}
          {inputs.map((p, i) => (
            <div className="dte-port-row" key={i}>
              <input className="dte-port-label" value={p.label} onChange={e => updateInput(i, 'label', e.target.value)} />
              <select className="dte-port-signal" value={p.signal} onChange={e => updateInput(i, 'signal', e.target.value)}>
                <option value="video">视频</option>
                <option value="audio">音频</option>
              </select>
              <button className="dte-remove-port" onClick={() => removeInput(i)}>×</button>
            </div>
          ))}
        </div>
        <div className="dte-ports-section">
          <div className="dte-ports-title">
            输出端口
            <button className="dte-add-port" onClick={addOutput}>+ 添加</button>
          </div>
          {outputs.length === 0 && <div className="dte-empty-ports">无输出端口</div>}
          {outputs.map((p, i) => (
            <div className="dte-port-row" key={i}>
              <input className="dte-port-label" value={p.label} onChange={e => updateOutput(i, 'label', e.target.value)} />
              <select className="dte-port-signal" value={p.signal} onChange={e => updateOutput(i, 'signal', e.target.value)}>
                <option value="video">视频</option>
                <option value="audio">音频</option>
              </select>
              <button className="dte-remove-port" onClick={() => removeOutput(i)}>×</button>
            </div>
          ))}
        </div>
        <div className="dte-actions">
          <button className="btn" onClick={onCancel}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!label.trim()}>保存</button>
        </div>
      </div>
    </div>
  )
}
