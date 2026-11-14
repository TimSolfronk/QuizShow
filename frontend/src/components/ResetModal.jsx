import { useState } from 'react'

export default function ResetModal({ files, currentFileId, onCancel, onConfirm }) {
  const [selected, setSelected] = useState(currentFileId ?? files[0]?.id ?? null)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!selected || busy) return
    setBusy(true)
    try {
      await onConfirm(selected)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Reset board &amp; load question set</h2>
        <p className="modal-text">
          This resets all team scores to $500 and re-enables every question.
          Team names are kept. Choose which question file to load:
        </p>

        <div className="file-list">
          {files.map(file => (
            <label
              key={file.id}
              className={`file-option ${selected === file.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="question-file"
                checked={selected === file.id}
                onChange={() => setSelected(file.id)}
              />
              <span className="file-name">{file.name}</span>
              <span className="file-id">{file.id}.json</span>
            </label>
          ))}
          {files.length === 0 && (
            <p className="modal-text">
              No question files found. Add JSON files to the <code>questions/</code> folder.
            </p>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!selected || busy || files.length === 0}
            onClick={confirm}
          >
            {busy ? 'Loading…' : 'Reset & load'}
          </button>
        </div>
      </div>
    </div>
  )
}
