import React, { useState, useEffect } from 'react'
import { fmt } from './ui.jsx'

export default function PathBar({ info, currentPath, onPathChange, onRefresh, onToggleSidebar, sidebarOpen, loading, inputRef }) {
  const [inputVal, setInputVal] = useState(currentPath || '')

  useEffect(() => {
    if (currentPath) setInputVal(currentPath)
  }, [currentPath])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = inputVal.trim()
    if (!trimmed) return
    if (trimmed !== currentPath) {
      onPathChange(trimmed)
    } else {
      onRefresh()
    }
  }

  const isLoad = inputVal.trim() !== currentPath

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 20px',
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 'var(--radius-xl)', marginBottom: 20,
      fontFamily: 'var(--font-mono)', fontSize: 13,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <span style={{
        background: 'var(--gradient-accent)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        fontSize: 16, flexShrink: 0,
      }}>◈</span>

      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder="s3://bucket/path/to/table.delta"
          disabled={loading}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 14,
            opacity: loading ? 0.5 : 1,
          }}
        />
        <button
          type="button"
          onClick={onToggleSidebar}
          disabled={loading}
          title={sidebarOpen ? 'Close browser' : 'Browse S3'}
          style={{
            background: sidebarOpen ? 'rgba(45,212,191,0.2)' : 'rgba(45,212,191,0.1)',
            border: `1px solid ${sidebarOpen ? 'rgba(45,212,191,0.5)' : 'rgba(45,212,191,0.3)'}`,
            borderRadius: 'var(--radius)', padding: '4px 10px', cursor: 'pointer',
            color: 'var(--teal)', fontSize: 12, fontFamily: 'var(--font-sans)',
            fontWeight: 500, opacity: loading ? 0.5 : 1,
          }}
        >
          {sidebarOpen ? '✕ browser' : '▸ browse'}
        </button>
        <button type="submit" disabled={loading || !inputVal.trim()} style={{
          background: isLoad
            ? 'linear-gradient(135deg, rgba(45,212,191,0.15), rgba(96,165,250,0.15))'
            : 'var(--surface3)',
          border: isLoad ? '1px solid rgba(45,212,191,0.3)' : '1px solid var(--border2)',
          borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer',
          color: isLoad ? 'var(--teal)' : 'var(--muted2)',
          fontSize: 12, fontFamily: 'var(--font-sans)', opacity: loading ? 0.5 : 1,
        }}>
          {loading ? '...' : isLoad ? '→ load' : '↻ refresh'}
        </button>
      </form>

      {info && <>
        <Pill label={`v${info.version}`} color="var(--teal)" />
        {info.num_files != null && <Pill label={`${info.num_files} files`} color="var(--blue)" />}
        {info.total_size_bytes != null && <Pill label={fmt(info.total_size_bytes, { bytes: true })} color="var(--purple)" />}
        {info.partition_columns?.length > 0 &&
          <Pill label={`partitioned by ${info.partition_columns.join(', ')}`} color="var(--amber)" />}
      </>}
    </div>
  )
}

function Pill({ label, color }) {
  return (
    <span style={{
      fontSize: 11, padding: '4px 10px',
      background: color + '20', color, borderRadius: 99,
      fontWeight: 500, whiteSpace: 'nowrap',
      border: '1px solid ' + color + '4d',
    }}>{label}</span>
  )
}
