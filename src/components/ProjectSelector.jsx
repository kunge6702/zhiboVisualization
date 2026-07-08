import { useState, useRef, useEffect } from 'react'

export function ProjectSelector({ projects, activeProjectId, onSelect, onRename, onDuplicate, onDelete, onCreate, onExport, onImport, onExportTopology }) {
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
