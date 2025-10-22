import React, { useRef, useState } from 'react'

const FileInputTest: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])

  return (
    <div style={{ padding: '2rem', color: 'white' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Minimal File Input Test</h1>

      <button
        onClick={() => inputRef.current?.click()}
        style={{ padding: '0.5rem 1rem', background: '#2563eb', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer' }}
      >
        Open File Dialog
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.json"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        style={{ position: 'absolute', left: -9999 }}
      />

      <div style={{ marginTop: '1rem' }}>
        <div>Selected: {files.length}</div>
        <ul style={{ marginTop: 8 }}>
          {files.map((f, i) => (
            <li key={i}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default FileInputTest


